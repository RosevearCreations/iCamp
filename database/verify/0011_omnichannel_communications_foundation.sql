-- Build 009 omnichannel communications schema verification.
\set ON_ERROR_STOP on

do $$
begin
  if to_regclass('icamp_private.communication_endpoints') is null then
    raise exception 'Missing communication_endpoints';
  end if;
  if to_regclass('icamp_private.communication_preferences') is null then
    raise exception 'Missing communication_preferences';
  end if;
  if to_regclass('icamp_private.communication_consents') is null then
    raise exception 'Missing communication_consents';
  end if;
  if to_regclass('icamp_private.communication_dispatches') is null then
    raise exception 'Missing communication_dispatches';
  end if;
  if to_regclass('icamp_private.communication_attempts') is null then
    raise exception 'Missing communication_attempts';
  end if;
  if to_regclass('icamp_private.communication_provider_events') is null then
    raise exception 'Missing communication_provider_events';
  end if;

  if to_regclass('icamp_private.communication_dispatches_scope_state_idx') is null then
    raise exception 'Missing communication dispatch scope/state index';
  end if;

  if has_schema_privilege('public', 'icamp_private', 'USAGE') then
    raise exception 'PUBLIC must not have USAGE on icamp_private';
  end if;
end
$$;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    if has_table_privilege('anon', 'icamp_private.communication_endpoints', 'SELECT') then
      raise exception 'anon must not read communication endpoints';
    end if;
  end if;

  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    if has_table_privilege('authenticated', 'icamp_private.communication_dispatches', 'SELECT') then
      raise exception 'authenticated must not read communication dispatch metadata';
    end if;
  end if;
end
$$;

begin;

insert into public.organizations (name, slug)
values ('Build 009 Verify Org', 'build-009-verify-org')
returning id as comm_verify_org
\gset

insert into public.campgrounds (organization_id, name, slug, timezone)
values (
  :'comm_verify_org',
  'Build 009 Verify Camp',
  'build-009-verify-camp',
  'America/Toronto'
)
returning id as comm_verify_camp
\gset

insert into icamp_private.communication_endpoints (
  organization_id,
  campground_id,
  endpoint_kind,
  endpoint_value,
  display_hint,
  verified_at
)
values (
  :'comm_verify_org',
  :'comm_verify_camp',
  'phone',
  '+15555550123',
  'phone ending 0123',
  statement_timestamp()
)
returning id as comm_verify_endpoint
\gset

insert into icamp_private.communication_preferences (
  endpoint_id,
  purpose,
  channel,
  preference_state,
  source
)
values (
  :'comm_verify_endpoint',
  'operational',
  'sms',
  'enabled',
  'user'
);

insert into icamp_private.communication_consents (
  endpoint_id,
  purpose,
  channel,
  consent_state,
  evidence_source,
  evidence_reference
)
values (
  :'comm_verify_endpoint',
  'marketing',
  'sms',
  'withdrawn',
  'user',
  'build-009-schema-proof'
)
returning id as comm_verify_consent
\gset

insert into icamp_private.communication_dispatches (
  organization_id,
  campground_id,
  endpoint_id,
  direction,
  channel,
  purpose,
  idempotency_key
)
values (
  :'comm_verify_org',
  :'comm_verify_camp',
  :'comm_verify_endpoint',
  'outbound',
  'sms',
  'operational',
  'build009-schema-dispatch'
)
returning id as comm_verify_dispatch
\gset

insert into icamp_private.communication_attempts (
  dispatch_id,
  attempt_number,
  provider_key,
  attempt_state,
  retryable,
  error_code,
  error_summary,
  completed_at
)
values (
  :'comm_verify_dispatch',
  1,
  'mock',
  'failed',
  true,
  'temporary',
  'Synthetic retryable provider failure.',
  statement_timestamp()
);

insert into icamp_private.communication_provider_events (
  provider_key,
  provider_event_id,
  dispatch_id,
  channel,
  event_type,
  event_status,
  occurred_at
)
values (
  'mock',
  'build009-provider-event',
  :'comm_verify_dispatch',
  'sms',
  'delivery',
  'accepted',
  statement_timestamp()
);

savepoint consent_append_only_check;
\set ON_ERROR_STOP off
update icamp_private.communication_consents
set evidence_reference = 'mutation-must-fail'
where id = :'comm_verify_consent';
\set consent_mutation_sqlstate :SQLSTATE
\set ON_ERROR_STOP on
rollback to savepoint consent_append_only_check;

select (:'consent_mutation_sqlstate' = '55000') as consent_append_only_ok
\gset

\if :consent_append_only_ok
\else
  \quit 1
\endif

savepoint provider_event_append_only_check;
\set ON_ERROR_STOP off
delete from icamp_private.communication_provider_events
where provider_event_id = 'build009-provider-event';
\set provider_event_mutation_sqlstate :SQLSTATE
\set ON_ERROR_STOP on
rollback to savepoint provider_event_append_only_check;

select (:'provider_event_mutation_sqlstate' = '55000') as provider_event_append_only_ok
\gset

\if :provider_event_append_only_ok
\else
  \quit 1
\endif

rollback;
