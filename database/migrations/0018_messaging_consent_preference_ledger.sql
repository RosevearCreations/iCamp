-- iCamp Build 014
-- Messaging consent, STOP/START/HELP synchronization and preference ledger.

create table icamp_private.communication_compliance_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations(id)
    on update cascade
    on delete restrict,
  campground_id uuid not null,
  jurisdiction_code text not null
    check (jurisdiction_code ~ '^[A-Z]{2}(-[A-Z0-9]{1,3})?$'),
  is_default boolean not null default false,
  marketing_requires_consent boolean not null default true,
  marketing_consent_expiry_days integer
    check (
      marketing_consent_expiry_days is null
      or marketing_consent_expiry_days between 1 and 3650
    ),
  stop_suppresses_all boolean not null default true,
  start_grants_marketing_consent boolean not null default false,
  help_allowed_when_suppressed boolean not null default true,
  lifecycle_state text not null default 'active'
    check (lifecycle_state in ('active', 'inactive')),
  effective_from timestamptz not null default statement_timestamp(),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  row_version bigint not null default 1 check (row_version >= 1),
  constraint communication_compliance_rules_campground_fk
    foreign key (organization_id, campground_id)
    references public.campgrounds(organization_id, id)
    on update cascade
    on delete restrict,
  constraint communication_compliance_rules_scope_unique
    unique (campground_id, jurisdiction_code)
);

create unique index communication_compliance_rules_default_idx
  on icamp_private.communication_compliance_rules (campground_id)
  where is_default and lifecycle_state = 'active';

create table icamp_private.messaging_preference_state (
  endpoint_id uuid primary key
    references icamp_private.communication_endpoints(id)
    on update cascade
    on delete cascade,
  jurisdiction_code text not null default 'CA'
    check (jurisdiction_code ~ '^[A-Z]{2}(-[A-Z0-9]{1,3})?$'),
  provider_suppressed boolean not null default false,
  suppression_source text not null default 'system'
    check (suppression_source in ('user', 'staff', 'provider', 'system')),
  last_action text
    check (last_action is null or last_action in ('stop', 'start', 'help', 'provider_sync')),
  last_provider_key text
    check (
      last_provider_key is null
      or last_provider_key ~ '^[a-z][a-z0-9_-]{1,63}$'
    ),
  last_changed_at timestamptz not null default statement_timestamp(),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  row_version bigint not null default 1 check (row_version >= 1)
);

create table icamp_private.messaging_preference_events (
  id uuid primary key default gen_random_uuid(),
  endpoint_id uuid not null
    references icamp_private.communication_endpoints(id)
    on update cascade
    on delete restrict,
  event_key text not null unique
    check (char_length(event_key) between 8 and 240),
  provider_key text
    check (
      provider_key is null
      or provider_key ~ '^[a-z][a-z0-9_-]{1,63}$'
    ),
  provider_event_id text
    check (
      provider_event_id is null
      or char_length(provider_event_id) between 1 and 240
    ),
  action text not null
    check (
      action in (
        'stop',
        'start',
        'help',
        'marketing_opt_in',
        'marketing_opt_out',
        'provider_sync'
      )
    ),
  source text not null
    check (source in ('user', 'staff', 'provider', 'system', 'import')),
  resulting_provider_suppressed boolean not null,
  jurisdiction_code text not null
    check (jurisdiction_code ~ '^[A-Z]{2}(-[A-Z0-9]{1,3})?$'),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  occurred_at timestamptz not null default statement_timestamp(),
  received_at timestamptz not null default statement_timestamp(),
  constraint messaging_preference_events_provider_pair_check
    check (
      (provider_key is null and provider_event_id is null)
      or (provider_key is not null and provider_event_id is not null)
    )
);

create unique index messaging_preference_events_provider_unique
  on icamp_private.messaging_preference_events (
    provider_key,
    provider_event_id
  )
  where provider_key is not null and provider_event_id is not null;

create index messaging_preference_events_endpoint_time_idx
  on icamp_private.messaging_preference_events (
    endpoint_id,
    occurred_at desc
  );

create index messaging_preference_events_action_time_idx
  on icamp_private.messaging_preference_events (
    action,
    occurred_at desc
  );

create trigger communication_compliance_rules_touch_row
before update on icamp_private.communication_compliance_rules
for each row execute function icamp_private.touch_row();

create trigger messaging_preference_state_touch_row
before update on icamp_private.messaging_preference_state
for each row execute function icamp_private.touch_row();

create or replace function icamp_private.prevent_messaging_preference_event_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception using
    errcode = '55000',
    message = 'Messaging preference evidence is append-only and cannot be updated or deleted';
end;
$$;

create trigger messaging_preference_events_append_only
before update or delete on icamp_private.messaging_preference_events
for each row execute function icamp_private.prevent_messaging_preference_event_mutation();

revoke all on icamp_private.communication_compliance_rules from public;
revoke all on icamp_private.messaging_preference_state from public;
revoke all on icamp_private.messaging_preference_events from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on icamp_private.communication_compliance_rules from anon';
    execute 'revoke all on icamp_private.messaging_preference_state from anon';
    execute 'revoke all on icamp_private.messaging_preference_events from anon';
  end if;

  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on icamp_private.communication_compliance_rules from authenticated';
    execute 'revoke all on icamp_private.messaging_preference_state from authenticated';
    execute 'revoke all on icamp_private.messaging_preference_events from authenticated';
  end if;
end
$$;

comment on table icamp_private.communication_compliance_rules is
  'Configurable campground messaging-compliance rules. The application fallback is conservative Canadian/CASL-ready policy.';
comment on table icamp_private.messaging_preference_state is
  'Current provider suppression state for a private messaging endpoint. Endpoint values are never copied here.';
comment on table icamp_private.messaging_preference_events is
  'Append-only normalized STOP/START/HELP and consent evidence. Raw message bodies and endpoint values are forbidden.';
