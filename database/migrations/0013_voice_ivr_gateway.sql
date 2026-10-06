-- iCamp Build 010
-- Inbound/outbound voice and IVR gateway foundation.

create table icamp_private.voice_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations(id)
    on update cascade
    on delete restrict,
  campground_id uuid not null,
  endpoint_id uuid not null,
  provider_key text not null
    check (provider_key ~ '^[a-z][a-z0-9_-]{1,63}$'),
  provider_number_reference text not null
    check (char_length(provider_number_reference) between 1 and 240),
  route_key text not null default 'main'
    check (route_key ~ '^[a-z][a-z0-9._-]{1,79}$'),
  staff_transfer_endpoint_id uuid,
  inbound_enabled boolean not null default true,
  outbound_enabled boolean not null default true,
  sandbox_mode boolean not null default true,
  lifecycle_state text not null default 'active'
    check (lifecycle_state in ('active', 'inactive')),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  row_version bigint not null default 1 check (row_version >= 1),
  constraint voice_lines_campground_fk
    foreign key (organization_id, campground_id)
    references public.campgrounds(organization_id, id)
    on update cascade
    on delete restrict,
  constraint voice_lines_endpoint_scope_fk
    foreign key (campground_id, endpoint_id)
    references icamp_private.communication_endpoints(campground_id, id)
    on update cascade
    on delete restrict,
  constraint voice_lines_staff_transfer_scope_fk
    foreign key (campground_id, staff_transfer_endpoint_id)
    references icamp_private.communication_endpoints(campground_id, id)
    on update cascade
    on delete restrict,
  constraint voice_lines_provider_number_unique
    unique (provider_key, provider_number_reference),
  constraint voice_lines_campground_endpoint_unique
    unique (campground_id, endpoint_id)
);

create table icamp_private.voice_calls (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations(id)
    on update cascade
    on delete restrict,
  campground_id uuid not null,
  line_id uuid not null
    references icamp_private.voice_lines(id)
    on update cascade
    on delete restrict,
  dispatch_id uuid not null
    references icamp_private.communication_dispatches(id)
    on update cascade
    on delete restrict,
  remote_endpoint_id uuid,
  provider_key text not null
    check (provider_key ~ '^[a-z][a-z0-9_-]{1,63}$'),
  provider_call_reference text not null
    check (char_length(provider_call_reference) between 1 and 240),
  direction text not null
    check (direction in ('inbound', 'outbound')),
  route_key text not null
    check (route_key ~ '^[a-z][a-z0-9._-]{1,79}$'),
  call_state text not null default 'ringing'
    check (
      call_state in (
        'ringing',
        'in_progress',
        'transferring',
        'completed',
        'failed'
      )
    ),
  transfer_state text not null default 'none'
    check (
      transfer_state in (
        'none',
        'requested',
        'completed',
        'fallback',
        'failed'
      )
    ),
  last_error_code text
    check (
      last_error_code is null
      or char_length(last_error_code) between 1 and 120
    ),
  last_error_summary text
    check (
      last_error_summary is null
      or char_length(last_error_summary) between 1 and 500
    ),
  started_at timestamptz not null default statement_timestamp(),
  answered_at timestamptz,
  ended_at timestamptz,
  updated_at timestamptz not null default statement_timestamp(),
  row_version bigint not null default 1 check (row_version >= 1),
  constraint voice_calls_campground_fk
    foreign key (organization_id, campground_id)
    references public.campgrounds(organization_id, id)
    on update cascade
    on delete restrict,
  constraint voice_calls_remote_endpoint_scope_fk
    foreign key (campground_id, remote_endpoint_id)
    references icamp_private.communication_endpoints(campground_id, id)
    on update cascade
    on delete restrict,
  constraint voice_calls_dispatch_unique
    unique (dispatch_id),
  constraint voice_calls_provider_reference_unique
    unique (provider_key, provider_call_reference),
  constraint voice_calls_terminal_time_check
    check (
      call_state not in ('completed', 'failed')
      or ended_at is not null
    )
);

create table icamp_private.voice_ivr_sessions (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null
    references icamp_private.voice_calls(id)
    on update cascade
    on delete restrict,
  route_key text not null
    check (route_key ~ '^[a-z][a-z0-9._-]{1,79}$'),
  state_key text not null
    check (state_key ~ '^[a-z][a-z0-9._-]{1,79}$'),
  session_state text not null default 'active'
    check (
      session_state in (
        'active',
        'transferred',
        'completed',
        'failed'
      )
    ),
  retry_count integer not null default 0
    check (retry_count between 0 and 5),
  max_retries integer not null default 3
    check (max_retries between 1 and 5),
  context jsonb not null default '{}'::jsonb
    check (jsonb_typeof(context) = 'object'),
  expires_at timestamptz not null,
  started_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  row_version bigint not null default 1 check (row_version >= 1),
  constraint voice_ivr_sessions_call_unique unique (call_id),
  constraint voice_ivr_sessions_retry_check
    check (retry_count <= max_retries)
);

create table icamp_private.voice_ivr_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null
    references icamp_private.voice_ivr_sessions(id)
    on update cascade
    on delete restrict,
  event_type text not null
    check (event_type ~ '^[a-z][a-z0-9._-]{1,79}$'),
  from_state text
    check (
      from_state is null
      or from_state ~ '^[a-z][a-z0-9._-]{1,79}$'
    ),
  to_state text not null
    check (to_state ~ '^[a-z][a-z0-9._-]{1,79}$'),
  action_key text not null
    check (action_key ~ '^[a-z][a-z0-9._-]{1,79}$'),
  occurred_at timestamptz not null default statement_timestamp()
);

create index voice_lines_scope_state_idx
  on icamp_private.voice_lines (
    organization_id,
    campground_id,
    lifecycle_state
  );

create index voice_lines_staff_transfer_idx
  on icamp_private.voice_lines (
    campground_id,
    staff_transfer_endpoint_id
  )
  where staff_transfer_endpoint_id is not null;

create index voice_calls_scope_state_idx
  on icamp_private.voice_calls (
    organization_id,
    campground_id,
    call_state,
    started_at desc
  );

create index voice_calls_line_state_idx
  on icamp_private.voice_calls (
    line_id,
    call_state,
    started_at desc
  );

create index voice_calls_remote_endpoint_idx
  on icamp_private.voice_calls (
    campground_id,
    remote_endpoint_id
  )
  where remote_endpoint_id is not null;

create index voice_ivr_sessions_state_idx
  on icamp_private.voice_ivr_sessions (
    session_state,
    expires_at
  );

create index voice_ivr_events_session_time_idx
  on icamp_private.voice_ivr_events (
    session_id,
    occurred_at desc
  );

create or replace function icamp_private.validate_voice_line_endpoints()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  line_endpoint_kind text;
  transfer_endpoint_kind text;
begin
  select endpoint_kind
    into line_endpoint_kind
  from icamp_private.communication_endpoints
  where id = new.endpoint_id
    and campground_id = new.campground_id;

  if line_endpoint_kind is distinct from 'phone' then
    raise exception using
      errcode = '23514',
      message = 'Voice line endpoint must be a phone endpoint';
  end if;

  if new.staff_transfer_endpoint_id is not null then
    select endpoint_kind
      into transfer_endpoint_kind
    from icamp_private.communication_endpoints
    where id = new.staff_transfer_endpoint_id
      and campground_id = new.campground_id;

    if transfer_endpoint_kind is distinct from 'phone' then
      raise exception using
        errcode = '23514',
        message = 'Voice staff transfer endpoint must be a phone endpoint';
    end if;
  end if;

  return new;
end;
$$;

create trigger voice_lines_endpoint_guard
before insert or update of campground_id, endpoint_id, staff_transfer_endpoint_id
on icamp_private.voice_lines
for each row execute function icamp_private.validate_voice_line_endpoints();

create trigger voice_lines_touch_row
before update on icamp_private.voice_lines
for each row execute function icamp_private.touch_row();

create trigger voice_calls_touch_row
before update on icamp_private.voice_calls
for each row execute function icamp_private.touch_row();

create trigger voice_ivr_sessions_touch_row
before update on icamp_private.voice_ivr_sessions
for each row execute function icamp_private.touch_row();

create or replace function icamp_private.prevent_voice_ivr_event_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception using
    errcode = '55000',
    message = 'Voice IVR events are append-only and cannot be updated or deleted';
end;
$$;

create trigger voice_ivr_events_append_only
before update or delete on icamp_private.voice_ivr_events
for each row execute function icamp_private.prevent_voice_ivr_event_mutation();

revoke all on icamp_private.voice_lines from public;
revoke all on icamp_private.voice_calls from public;
revoke all on icamp_private.voice_ivr_sessions from public;
revoke all on icamp_private.voice_ivr_events from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on icamp_private.voice_lines from anon';
    execute 'revoke all on icamp_private.voice_calls from anon';
    execute 'revoke all on icamp_private.voice_ivr_sessions from anon';
    execute 'revoke all on icamp_private.voice_ivr_events from anon';
  end if;

  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on icamp_private.voice_lines from authenticated';
    execute 'revoke all on icamp_private.voice_calls from authenticated';
    execute 'revoke all on icamp_private.voice_ivr_sessions from authenticated';
    execute 'revoke all on icamp_private.voice_ivr_events from authenticated';
  end if;
end
$$;

comment on table icamp_private.voice_lines is
  'Campground phone-line/provider bindings. Endpoint values and provider credentials remain private.';
comment on table icamp_private.voice_calls is
  'Provider-neutral voice call metadata. Raw audio, transcripts, DTMF and provider webhook bodies are excluded.';
comment on table icamp_private.voice_ivr_sessions is
  'Current IVR state-machine position. Context must contain only non-secret routing metadata.';
comment on table icamp_private.voice_ivr_events is
  'Append-only semantic IVR transitions. Never store keypad digits, PINs, payment data or transcripts here.';
