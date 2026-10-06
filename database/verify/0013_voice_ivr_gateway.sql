-- Build 010 voice/IVR schema verification.
\set ON_ERROR_STOP on

do $$
begin
  if to_regclass('icamp_private.voice_lines') is null then
    raise exception 'Missing voice_lines';
  end if;
  if to_regclass('icamp_private.voice_calls') is null then
    raise exception 'Missing voice_calls';
  end if;
  if to_regclass('icamp_private.voice_ivr_sessions') is null then
    raise exception 'Missing voice_ivr_sessions';
  end if;
  if to_regclass('icamp_private.voice_ivr_events') is null then
    raise exception 'Missing voice_ivr_events';
  end if;
  if to_regclass('icamp_private.voice_lines_scope_state_idx') is null then
    raise exception 'Missing voice line scope/state index';
  end if;
  if to_regclass('icamp_private.voice_calls_line_state_idx') is null then
    raise exception 'Missing voice call line/state index';
  end if;

  if has_schema_privilege('public', 'icamp_private', 'USAGE') then
    raise exception 'PUBLIC must not have USAGE on icamp_private';
  end if;
end
$$;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    if has_table_privilege('anon', 'icamp_private.voice_calls', 'SELECT') then
      raise exception 'anon must not read private voice calls';
    end if;
  end if;

  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    if has_table_privilege(
      'authenticated',
      'icamp_private.voice_ivr_sessions',
      'SELECT'
    ) then
      raise exception 'authenticated must not read private IVR sessions';
    end if;
  end if;
end
$$;

begin;

insert into public.organizations (name, slug)
values ('Build 010 Verify Org', 'build-010-verify-org')
returning id as voice_verify_org
\gset

insert into public.campgrounds (organization_id, name, slug, timezone)
values (
  :'voice_verify_org',
  'Build 010 Verify Camp',
  'build-010-verify-camp',
  'America/Toronto'
)
returning id as voice_verify_camp
\gset

insert into icamp_private.communication_endpoints (
  organization_id,
  campground_id,
  endpoint_kind,
  endpoint_value,
  display_hint,
  verified_at
)
values
  (
    :'voice_verify_org',
    :'voice_verify_camp',
    'phone',
    '+15555551001',
    'campground line ending 1001',
    statement_timestamp()
  ),
  (
    :'voice_verify_org',
    :'voice_verify_camp',
    'phone',
    '+15555551002',
    'staff line ending 1002',
    statement_timestamp()
  )
returning id
\gset

select id as voice_verify_line_endpoint
from icamp_private.communication_endpoints
where campground_id = :'voice_verify_camp'
  and endpoint_value = '+15555551001'
\gset

select id as voice_verify_staff_endpoint
from icamp_private.communication_endpoints
where campground_id = :'voice_verify_camp'
  and endpoint_value = '+15555551002'
\gset

insert into icamp_private.voice_lines (
  organization_id,
  campground_id,
  endpoint_id,
  provider_key,
  provider_number_reference,
  staff_transfer_endpoint_id,
  sandbox_mode
)
values (
  :'voice_verify_org',
  :'voice_verify_camp',
  :'voice_verify_line_endpoint',
  'mock',
  'mock-number-1001',
  :'voice_verify_staff_endpoint',
  true
)
returning id as voice_verify_line
\gset

insert into icamp_private.communication_dispatches (
  organization_id,
  campground_id,
  direction,
  channel,
  purpose,
  idempotency_key,
  delivery_state
)
values (
  :'voice_verify_org',
  :'voice_verify_camp',
  'inbound',
  'voice',
  'operational',
  'build010-schema-inbound',
  'submitted'
)
returning id as voice_verify_dispatch
\gset

insert into icamp_private.voice_calls (
  organization_id,
  campground_id,
  line_id,
  dispatch_id,
  provider_key,
  provider_call_reference,
  direction,
  route_key,
  call_state
)
values (
  :'voice_verify_org',
  :'voice_verify_camp',
  :'voice_verify_line',
  :'voice_verify_dispatch',
  'mock',
  'mock-call-build010',
  'inbound',
  'main',
  'ringing'
)
returning id as voice_verify_call
\gset

insert into icamp_private.voice_ivr_sessions (
  call_id,
  route_key,
  state_key,
  expires_at
)
values (
  :'voice_verify_call',
  'main',
  'main_menu',
  statement_timestamp() + interval '15 minutes'
)
returning id as voice_verify_session
\gset

insert into icamp_private.voice_ivr_events (
  session_id,
  event_type,
  from_state,
  to_state,
  action_key
)
values (
  :'voice_verify_session',
  'call.started',
  null,
  'main_menu',
  'prompt.main'
)
returning id as voice_verify_event
\gset

savepoint ivr_event_append_only_check;
\set ON_ERROR_STOP off
update icamp_private.voice_ivr_events
set action_key = 'mutation.must.fail'
where id = :'voice_verify_event';
\set ivr_event_mutation_sqlstate :SQLSTATE
\set ON_ERROR_STOP on
rollback to savepoint ivr_event_append_only_check;

select (:'ivr_event_mutation_sqlstate' = '55000') as ivr_event_append_only_ok
\gset

\if :ivr_event_append_only_ok
\else
  \quit 1
\endif

rollback;
