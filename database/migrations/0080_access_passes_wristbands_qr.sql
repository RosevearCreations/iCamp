-- iCamp Build 061
-- Passes, Wristbands & QR Codes.
--
-- The active delivery queue intentionally assigns the historical roadmap's
-- wristband/QR/pass scope to Build 061. Build 056 remains the canonical access
-- credential authority. Raw bearer validation tokens are never stored.

create table public.access_passes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  pass_number text not null
    check (pass_number ~ '^AP-[A-Z0-9]{8,40}$'),
  credential_id uuid not null,
  presentation_kind text not null
    check (presentation_kind in ('qr_code','printed_pass','wristband')),
  link_kind text not null
    check (link_kind in ('visitor','vehicle_pass','event','day_use')),
  visitor_registration_id uuid,
  vehicle_pass_id uuid,
  event_reference text
    check (
      event_reference is null
      or char_length(trim(event_reference)) between 1 and 160
    ),
  day_use_reference text
    check (
      day_use_reference is null
      or char_length(trim(day_use_reference)) between 1 and 160
    ),
  subject_label text not null
    check (char_length(trim(subject_label)) between 1 and 240),
  validation_fingerprint text not null
    check (validation_fingerprint ~ '^[a-f0-9]{64}$'),
  validation_hint text not null
    check (char_length(trim(validation_hint)) between 4 and 80),
  source_channel text not null default 'staff'
    check (source_channel in ('web','staff','ivr','sms','system')),
  idempotency_key text not null
    check (char_length(trim(idempotency_key)) between 8 and 200),
  issued_by_user_id uuid not null
    references icamp_private.user_accounts(id)
    on update cascade
    on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  constraint access_passes_scope_id_unique
    unique (organization_id,campground_id,id),
  constraint access_passes_scope_number_unique
    unique (organization_id,campground_id,pass_number),
  constraint access_passes_scope_credential_unique
    unique (organization_id,campground_id,credential_id),
  constraint access_passes_validation_unique
    unique (campground_id,validation_fingerprint),
  constraint access_passes_idempotency_unique
    unique (campground_id,idempotency_key),
  constraint access_passes_campground_fk
    foreign key (organization_id,campground_id)
    references public.campgrounds(organization_id,id)
    on update cascade
    on delete restrict,
  constraint access_passes_credential_fk
    foreign key (organization_id,campground_id,credential_id)
    references public.access_credentials(organization_id,campground_id,id)
    on update cascade
    on delete restrict,
  constraint access_passes_visitor_fk
    foreign key (organization_id,campground_id,visitor_registration_id)
    references public.visitor_registrations(organization_id,campground_id,id)
    on update cascade
    on delete restrict,
  constraint access_passes_vehicle_pass_fk
    foreign key (organization_id,campground_id,vehicle_pass_id)
    references public.vehicle_passes(organization_id,campground_id,id)
    on update cascade
    on delete restrict,
  constraint access_passes_link_shape_check
    check (
      (
        link_kind='visitor'
        and visitor_registration_id is not null
        and vehicle_pass_id is null
        and event_reference is null
        and day_use_reference is null
      )
      or
      (
        link_kind='vehicle_pass'
        and visitor_registration_id is null
        and vehicle_pass_id is not null
        and event_reference is null
        and day_use_reference is null
      )
      or
      (
        link_kind='event'
        and visitor_registration_id is null
        and vehicle_pass_id is null
        and event_reference is not null
        and day_use_reference is null
      )
      or
      (
        link_kind='day_use'
        and visitor_registration_id is null
        and vehicle_pass_id is null
        and event_reference is null
        and day_use_reference is not null
      )
    )
);

create index access_passes_visitor_fk_idx
  on public.access_passes(organization_id,campground_id,visitor_registration_id)
  where visitor_registration_id is not null;

create index access_passes_vehicle_fk_idx
  on public.access_passes(organization_id,campground_id,vehicle_pass_id)
  where vehicle_pass_id is not null;

create index access_passes_issued_by_idx
  on public.access_passes(issued_by_user_id);

create index access_passes_link_lookup_idx
  on public.access_passes(campground_id,link_kind,presentation_kind,created_at desc);

create table public.access_pass_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  campground_id uuid not null,
  pass_id uuid not null,
  event_kind text not null
    check (event_kind in (
      'issued','validated','validation_denied','revoked','expired_observed'
    )),
  validation_outcome text
    check (
      validation_outcome is null
      or validation_outcome in (
        'valid','not_yet_valid','expired','revoked','source_inactive'
      )
    ),
  actor_user_id uuid
    references icamp_private.user_accounts(id)
    on update cascade
    on delete set null,
  source_channel text not null default 'system'
    check (source_channel in ('web','staff','ivr','sms','system')),
  reason text
    check (reason is null or char_length(trim(reason)) between 1 and 500),
  event_metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(event_metadata)='object'),
  occurred_at timestamptz not null default statement_timestamp(),
  constraint access_pass_events_scope_pass_fk
    foreign key (organization_id,campground_id,pass_id)
    references public.access_passes(organization_id,campground_id,id)
    on update cascade
    on delete restrict,
  constraint access_pass_events_validation_shape_check
    check (
      (
        event_kind in ('validated','validation_denied')
        and validation_outcome is not null
      )
      or
      (
        event_kind not in ('validated','validation_denied')
        and validation_outcome is null
      )
    )
);

create index access_pass_events_pass_idx
  on public.access_pass_events(
    organization_id,campground_id,pass_id,occurred_at desc
  );

create index access_pass_events_actor_idx
  on public.access_pass_events(actor_user_id)
  where actor_user_id is not null;

create unique index access_pass_events_expired_once_idx
  on public.access_pass_events(pass_id,event_kind)
  where event_kind='expired_observed';

create or replace function icamp_private.validate_access_pass_insert()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  credential record;
  visitor record;
  vehicle_pass record;
  expected_type text;
  lock_reference text;
  duplicate_count integer;
begin
  select
    c.credential_type,
    c.secret_fingerprint,
    c.status,
    c.valid_from,
    c.valid_until
  into credential
  from public.access_credentials c
  where c.organization_id=new.organization_id
    and c.campground_id=new.campground_id
    and c.id=new.credential_id;

  if not found then
    raise exception 'Access pass requires a credential in the same campground scope';
  end if;

  expected_type := case new.presentation_kind
    when 'qr_code' then 'qr_pass'
    when 'printed_pass' then 'printed_pass'
    when 'wristband' then 'wristband'
  end;

  if credential.credential_type <> expected_type then
    raise exception 'Access pass presentation kind must match its credential type';
  end if;

  if credential.status <> 'active' then
    raise exception 'Access pass cannot be issued from a revoked credential';
  end if;

  if credential.valid_until is null then
    raise exception 'Access passes require a bounded credential expiry';
  end if;

  if new.presentation_kind='qr_code'
     and credential.secret_fingerprint <> new.validation_fingerprint then
    raise exception 'QR credential fingerprint must match the pass validation fingerprint';
  end if;

  if new.link_kind='visitor' then
    select
      v.registration_status,
      v.valid_from,
      v.valid_until
    into visitor
    from public.visitor_registrations v
    where v.organization_id=new.organization_id
      and v.campground_id=new.campground_id
      and v.id=new.visitor_registration_id;

    if not found or visitor.registration_status <> 'active' then
      raise exception 'Visitor-linked access pass requires an active visitor registration';
    end if;

    if credential.valid_from < visitor.valid_from
       or credential.valid_until > visitor.valid_until then
      raise exception 'Visitor-linked access pass validity must remain inside the visitor registration window';
    end if;

    lock_reference := new.visitor_registration_id::text;
  elsif new.link_kind='vehicle_pass' then
    select
      v.pass_status,
      v.valid_from,
      v.valid_until
    into vehicle_pass
    from public.vehicle_passes v
    where v.organization_id=new.organization_id
      and v.campground_id=new.campground_id
      and v.id=new.vehicle_pass_id;

    if not found or vehicle_pass.pass_status <> 'active' then
      raise exception 'Vehicle-linked access pass requires an active vehicle pass';
    end if;

    if credential.valid_from < vehicle_pass.valid_from
       or credential.valid_until > vehicle_pass.valid_until then
      raise exception 'Vehicle-linked access pass validity must remain inside the vehicle pass window';
    end if;

    lock_reference := new.vehicle_pass_id::text;
  elsif new.link_kind='event' then
    lock_reference := new.event_reference;
  else
    lock_reference := new.day_use_reference;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      new.campground_id::text || ':' || new.link_kind || ':' ||
      new.presentation_kind || ':' || lock_reference,
      0
    )
  );

  select count(*) into duplicate_count
  from public.access_passes p
  join public.access_credentials c
    on c.organization_id=p.organization_id
   and c.campground_id=p.campground_id
   and c.id=p.credential_id
  where p.campground_id=new.campground_id
    and p.presentation_kind=new.presentation_kind
    and p.link_kind=new.link_kind
    and c.status='active'
    and c.valid_until > statement_timestamp()
    and (
      (new.link_kind='visitor' and p.visitor_registration_id=new.visitor_registration_id)
      or
      (new.link_kind='vehicle_pass' and p.vehicle_pass_id=new.vehicle_pass_id)
      or
      (new.link_kind='event' and p.event_reference=new.event_reference)
      or
      (new.link_kind='day_use' and p.day_use_reference=new.day_use_reference)
    );

  if duplicate_count > 0 then
    raise exception 'An active access pass of this presentation kind already exists for the linked source';
  end if;

  return new;
end;
$$;

create trigger access_passes_validate_insert
before insert on public.access_passes
for each row execute function icamp_private.validate_access_pass_insert();

create or replace function icamp_private.reject_access_pass_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'Access pass presentation records are immutable';
end;
$$;

create trigger access_passes_reject_mutation
before update or delete on public.access_passes
for each row execute function icamp_private.reject_access_pass_mutation();

create or replace function icamp_private.reject_access_pass_event_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'Access pass events are append-only';
end;
$$;

create trigger access_pass_events_reject_mutation
before update or delete on public.access_pass_events
for each row execute function icamp_private.reject_access_pass_event_mutation();

alter table public.access_passes enable row level security;
alter table public.access_passes force row level security;
alter table public.access_pass_events enable row level security;
alter table public.access_pass_events force row level security;

revoke all on public.access_passes from public;
revoke all on public.access_pass_events from public;

grant select,insert on public.access_passes to icamp_app;
grant select,insert on public.access_pass_events to icamp_app;

do $revoke_data_api$
begin
  if exists (select 1 from pg_roles where rolname='anon') then
    execute 'revoke all on public.access_passes from anon';
    execute 'revoke all on public.access_pass_events from anon';
  end if;
  if exists (select 1 from pg_roles where rolname='authenticated') then
    execute 'revoke all on public.access_passes from authenticated';
    execute 'revoke all on public.access_pass_events from authenticated';
  end if;
end
$revoke_data_api$;

create policy access_passes_read
on public.access_passes
for select
to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'access.credential.issue')
  or icamp_private.has_campground_permission(campground_id,'access.credential.revoke')
  or icamp_private.has_campground_permission(campground_id,'access.events.read')
);

create policy access_passes_insert
on public.access_passes
for insert
to icamp_app
with check (
  icamp_private.has_campground_permission(campground_id,'access.credential.issue')
  and issued_by_user_id =
    nullif((select current_setting('icamp.user_id',true)),'')::uuid
);

create policy access_pass_events_read
on public.access_pass_events
for select
to icamp_app
using (
  icamp_private.has_campground_permission(campground_id,'access.credential.issue')
  or icamp_private.has_campground_permission(campground_id,'access.credential.revoke')
  or icamp_private.has_campground_permission(campground_id,'access.events.read')
);

create policy access_pass_events_insert
on public.access_pass_events
for insert
to icamp_app
with check (
  (
    icamp_private.has_campground_permission(campground_id,'access.credential.issue')
    or icamp_private.has_campground_permission(campground_id,'access.credential.revoke')
    or icamp_private.has_campground_permission(campground_id,'access.events.record')
  )
  and (
    actor_user_id is null
    or actor_user_id =
      nullif((select current_setting('icamp.user_id',true)),'')::uuid
  )
);

alter policy visitor_registrations_read
on public.visitor_registrations
using (
  icamp_private.has_campground_permission(campground_id,'visitor.read')
  or icamp_private.has_campground_permission(campground_id,'visitor.register')
  or icamp_private.has_campground_permission(campground_id,'payment.read')
  or icamp_private.has_campground_permission(campground_id,'access.credential.issue')
  or icamp_private.has_campground_permission(campground_id,'access.credential.revoke')
);

alter policy vehicle_passes_read
on public.vehicle_passes
using (
  icamp_private.has_campground_permission(campground_id,'vehicle.read')
  or icamp_private.has_campground_permission(campground_id,'vehicle.pass.issue')
  or icamp_private.has_campground_permission(campground_id,'payment.read')
  or icamp_private.has_campground_permission(campground_id,'access.credential.issue')
  or icamp_private.has_campground_permission(campground_id,'access.credential.revoke')
);

comment on table public.access_passes is
  'Build 061 immutable QR/printed/wristband presentation records over Build 056 access credentials. Only one-way bearer-token fingerprints and masked hints are stored.';

comment on table public.access_pass_events is
  'Build 061 append-only issuance, validation, denial, revocation and expiration-observation evidence for access pass presentations.';
