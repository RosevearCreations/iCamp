-- iCamp Build 059
-- Manual Gate Open/Close Override.
--
-- High-risk, permission-controlled manual access-device commands with required
-- reason, recent re-authentication, rate limiting, append-only request/provider
-- evidence and complete audit integration at the server layer.

create table public.gate_override_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  device_id uuid not null,
  command text not null
    check (command in ('open','close')),
  actor_user_id uuid not null
    references icamp_private.user_accounts(id)
    on update cascade
    on delete restrict,
  actor_session_id uuid not null
    references icamp_private.auth_sessions(id)
    on update cascade
    on delete restrict,
  reason text not null
    check (char_length(trim(reason)) between 8 and 500),
  source_channel text not null
    check (source_channel in ('web','staff','ivr','sms')),
  request_id text not null
    check (char_length(trim(request_id)) between 8 and 160),
  reauthenticated_at timestamptz not null,
  assurance_level text not null
    check (assurance_level in ('aal1','aal2')),
  provider_code text
    check (
      provider_code is null
      or provider_code ~ '^[a-z][a-z0-9_-]{1,63}$'
    ),
  provider_device_reference text
    check (
      provider_device_reference is null
      or char_length(trim(provider_device_reference)) between 1 and 240
    ),
  requested_at timestamptz not null default statement_timestamp(),
  constraint gate_override_requests_scope_device_fk
    foreign key (organization_id,campground_id,device_id)
    references public.access_devices(organization_id,campground_id,id)
    on update cascade
    on delete restrict,
  constraint gate_override_requests_scope_request_unique
    unique (campground_id,request_id),
  constraint gate_override_requests_scope_id_unique
    unique (organization_id,campground_id,id),
  constraint gate_override_requests_provider_pair_check
    check (
      (provider_code is null and provider_device_reference is null)
      or
      (provider_code is not null and provider_device_reference is not null)
    )
);

create index gate_override_requests_scope_device_fk_idx
  on public.gate_override_requests(
    organization_id,campground_id,device_id
  );

create index gate_override_requests_actor_rate_idx
  on public.gate_override_requests(
    campground_id,device_id,actor_user_id,requested_at desc
  );

create index gate_override_requests_session_idx
  on public.gate_override_requests(actor_session_id);

create table public.gate_override_outcomes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  request_id uuid not null,
  outcome text not null
    check (outcome in (
      'dispatched','succeeded','failed','rejected','timeout','unsupported'
    )),
  provider_command_reference text
    check (
      provider_command_reference is null
      or char_length(trim(provider_command_reference)) between 1 and 240
    ),
  provider_status text
    check (
      provider_status is null
      or char_length(trim(provider_status)) between 1 and 120
    ),
  provider_message text
    check (
      provider_message is null
      or char_length(trim(provider_message)) between 1 and 500
    ),
  provider_metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(provider_metadata)='object'),
  occurred_at timestamptz not null default statement_timestamp(),
  constraint gate_override_outcomes_scope_request_fk
    foreign key (organization_id,campground_id,request_id)
    references public.gate_override_requests(
      organization_id,campground_id,id
    )
    on update cascade
    on delete restrict
);


create index gate_override_outcomes_scope_request_fk_idx
  on public.gate_override_outcomes(
    organization_id,campground_id,request_id
  );

create unique index gate_override_outcomes_terminal_unique
  on public.gate_override_outcomes(request_id)
  where outcome in ('succeeded','failed','rejected','timeout','unsupported');

create or replace function icamp_private.prevent_gate_override_evidence_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception using
    errcode = '55000',
    message = 'Gate override evidence is append-only and cannot be updated or deleted';
end;
$$;

create trigger gate_override_requests_append_only
before update or delete on public.gate_override_requests
for each row execute function icamp_private.prevent_gate_override_evidence_mutation();

create trigger gate_override_outcomes_append_only
before update or delete on public.gate_override_outcomes
for each row execute function icamp_private.prevent_gate_override_evidence_mutation();

create or replace function icamp_private.validate_gate_override_request()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  device_row record;
  session_row record;
  required_permission text;
  recent_count integer;
begin
  select
    d.is_active,
    d.capabilities,
    d.provider_code,
    d.provider_device_reference
  into device_row
  from public.access_devices d
  where d.organization_id=new.organization_id
    and d.campground_id=new.campground_id
    and d.id=new.device_id;

  if not found then
    raise exception 'Access device does not exist in this campground';
  end if;

  if device_row.is_active is distinct from true then
    raise exception 'Inactive access devices cannot receive manual override commands';
  end if;

  if new.command='open'
    and not ('remote_open'=any(device_row.capabilities)) then
    raise exception 'Access device does not declare remote_open capability';
  end if;

  if new.command='close'
    and not ('remote_close'=any(device_row.capabilities)) then
    raise exception 'Access device does not declare remote_close capability';
  end if;

  if new.provider_code is distinct from device_row.provider_code
    or new.provider_device_reference is distinct from device_row.provider_device_reference then
    raise exception 'Provider mapping snapshot must match the registered access device';
  end if;

  select
    s.user_id,
    s.assurance_level,
    s.reauthenticated_at,
    s.expires_at,
    s.revoked_at
  into session_row
  from icamp_private.auth_sessions s
  where s.id=new.actor_session_id;

  if not found
    or session_row.user_id is distinct from new.actor_user_id
    or session_row.revoked_at is not null
    or session_row.expires_at <= statement_timestamp() then
    raise exception 'Active actor session is required for manual gate override';
  end if;

  if session_row.reauthenticated_at < statement_timestamp() - interval '10 minutes' then
    raise exception 'Recent re-authentication is required for manual gate override';
  end if;

  if new.reauthenticated_at is distinct from session_row.reauthenticated_at
    or new.assurance_level is distinct from session_row.assurance_level then
    raise exception 'Re-authentication evidence must match the active actor session';
  end if;

  required_permission :=
    case new.command
      when 'open' then 'gate.override.open'
      else 'gate.override.close'
    end;

  if not exists (
    select 1
    from icamp_private.campground_assignments a
    join icamp_private.campground_assignment_roles ar
      on ar.assignment_id=a.id
    join icamp_private.roles r
      on r.id=ar.role_id
     and r.lifecycle_state='active'
    join icamp_private.role_permissions rp
      on rp.role_id=r.id
    where a.user_id=new.actor_user_id
      and a.campground_id=new.campground_id
      and a.assignment_state='active'
      and a.starts_at <= statement_timestamp()
      and (a.ends_at is null or a.ends_at > statement_timestamp())
      and rp.permission_key=required_permission
  ) then
    raise exception 'Actor is not authorized for requested gate override command';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      new.campground_id::text || ':' ||
      new.device_id::text || ':' ||
      new.actor_user_id::text,
      59
    )
  );

  select count(*) into recent_count
  from public.gate_override_requests r
  where r.campground_id=new.campground_id
    and r.device_id=new.device_id
    and r.actor_user_id=new.actor_user_id
    and r.requested_at >= statement_timestamp() - interval '60 seconds';

  if recent_count >= 3 then
    raise exception 'Manual gate override rate limit exceeded';
  end if;

  return new;
end;
$$;

create trigger gate_override_requests_validate
before insert on public.gate_override_requests
for each row execute function icamp_private.validate_gate_override_request();

alter table public.gate_override_requests enable row level security;
alter table public.gate_override_requests force row level security;
alter table public.gate_override_outcomes enable row level security;
alter table public.gate_override_outcomes force row level security;

revoke all on public.gate_override_requests from public;
revoke all on public.gate_override_outcomes from public;

grant select on public.gate_override_requests to icamp_app;
grant select on public.gate_override_outcomes to icamp_app;

do $revoke_data_api$
begin
  if exists (select 1 from pg_roles where rolname='anon') then
    execute 'revoke all on public.gate_override_requests from anon';
    execute 'revoke all on public.gate_override_outcomes from anon';
  end if;
  if exists (select 1 from pg_roles where rolname='authenticated') then
    execute 'revoke all on public.gate_override_requests from authenticated';
    execute 'revoke all on public.gate_override_outcomes from authenticated';
  end if;
end
$revoke_data_api$;

create policy gate_override_requests_read on public.gate_override_requests
for select to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'gate.state.read')
  or icamp_private.has_campground_permission(campground_id,'access.events.read')
);

create policy gate_override_outcomes_read on public.gate_override_outcomes
for select to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'gate.state.read')
  or icamp_private.has_campground_permission(campground_id,'access.events.read')
);

comment on table public.gate_override_requests is
  'Build 059 append-only high-risk manual gate override requests. Commands require specific permission, explicit reason, recent re-authentication and per-actor/device rate limiting.';

comment on table public.gate_override_outcomes is
  'Build 059 append-only normalized provider outcome evidence for manual gate overrides. Provider secrets and raw command credentials are prohibited.';

comment on function icamp_private.validate_gate_override_request() is
  'Build 059 database enforcement for active device capability, actor session freshness, command-specific permission and 3-per-60-second actor/device rate limit.';
