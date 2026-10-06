-- iCamp Build 009
-- Provider-neutral omnichannel communications foundation.

create table icamp_private.communication_endpoints (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations(id)
    on update cascade
    on delete restrict,
  campground_id uuid not null,
  owner_user_id uuid
    references icamp_private.user_accounts(id)
    on update cascade
    on delete set null,
  endpoint_kind text not null
    check (endpoint_kind in ('phone', 'email', 'push', 'web')),
  endpoint_value text not null
    check (char_length(trim(endpoint_value)) between 3 and 512),
  display_hint text
    check (
      display_hint is null
      or char_length(trim(display_hint)) between 1 and 120
    ),
  verified_at timestamptz,
  lifecycle_state text not null default 'active'
    check (lifecycle_state in ('active', 'inactive')),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  row_version bigint not null default 1 check (row_version >= 1),
  constraint communication_endpoints_campground_fk
    foreign key (organization_id, campground_id)
    references public.campgrounds(organization_id, id)
    on update cascade
    on delete restrict,
  constraint communication_endpoints_scope_value_unique
    unique (organization_id, campground_id, endpoint_kind, endpoint_value)
);

create table icamp_private.communication_preferences (
  id uuid primary key default gen_random_uuid(),
  endpoint_id uuid not null
    references icamp_private.communication_endpoints(id)
    on update cascade
    on delete cascade,
  purpose text not null
    check (purpose in ('transactional', 'operational', 'marketing')),
  channel text not null
    check (
      channel in (
        'web',
        'voice',
        'dtmf',
        'speech',
        'sms',
        'mms',
        'email',
        'push'
      )
    ),
  preference_state text not null
    check (preference_state in ('enabled', 'disabled')),
  source text not null
    check (source in ('user', 'staff', 'system', 'provider')),
  updated_by_user_id uuid
    references icamp_private.user_accounts(id)
    on update cascade
    on delete set null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  row_version bigint not null default 1 check (row_version >= 1),
  constraint communication_preferences_endpoint_purpose_channel_unique
    unique (endpoint_id, purpose, channel)
);

create table icamp_private.communication_consents (
  id uuid primary key default gen_random_uuid(),
  endpoint_id uuid not null
    references icamp_private.communication_endpoints(id)
    on update cascade
    on delete restrict,
  purpose text not null
    check (purpose in ('transactional', 'operational', 'marketing')),
  channel text not null
    check (
      channel in (
        'web',
        'voice',
        'dtmf',
        'speech',
        'sms',
        'mms',
        'email',
        'push'
      )
    ),
  consent_state text not null
    check (consent_state in ('granted', 'withdrawn', 'not_required')),
  evidence_source text not null
    check (
      evidence_source in (
        'user',
        'staff',
        'system',
        'provider',
        'import'
      )
    ),
  evidence_reference text
    check (
      evidence_reference is null
      or char_length(evidence_reference) between 1 and 240
    ),
  recorded_by_user_id uuid
    references icamp_private.user_accounts(id)
    on update cascade
    on delete set null,
  occurred_at timestamptz not null default statement_timestamp()
);

create table icamp_private.communication_dispatches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations(id)
    on update cascade
    on delete restrict,
  campground_id uuid not null,
  endpoint_id uuid
    references icamp_private.communication_endpoints(id)
    on update cascade
    on delete restrict,
  direction text not null
    check (direction in ('inbound', 'outbound')),
  channel text not null
    check (
      channel in (
        'web',
        'voice',
        'dtmf',
        'speech',
        'sms',
        'mms',
        'email',
        'push'
      )
    ),
  purpose text not null
    check (purpose in ('transactional', 'operational', 'marketing')),
  idempotency_key text not null
    check (char_length(idempotency_key) between 8 and 200),
  content_reference text
    check (
      content_reference is null
      or char_length(content_reference) between 1 and 240
    ),
  delivery_state text not null default 'queued'
    check (
      delivery_state in (
        'queued',
        'submitted',
        'delivered',
        'failed',
        'cancelled'
      )
    ),
  max_attempts integer not null default 5
    check (max_attempts between 1 and 10),
  attempt_count integer not null default 0
    check (attempt_count between 0 and 10),
  next_attempt_at timestamptz,
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
  completed_at timestamptz,
  created_by_user_id uuid
    references icamp_private.user_accounts(id)
    on update cascade
    on delete set null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  row_version bigint not null default 1 check (row_version >= 1),
  constraint communication_dispatches_campground_fk
    foreign key (organization_id, campground_id)
    references public.campgrounds(organization_id, id)
    on update cascade
    on delete restrict,
  constraint communication_dispatches_scope_idempotency_unique
    unique (campground_id, idempotency_key),
  constraint communication_dispatches_attempt_count_check
    check (attempt_count <= max_attempts),
  constraint communication_dispatches_completed_check
    check (
      delivery_state not in ('delivered', 'failed', 'cancelled')
      or completed_at is not null
    )
);

create table icamp_private.communication_attempts (
  id uuid primary key default gen_random_uuid(),
  dispatch_id uuid not null
    references icamp_private.communication_dispatches(id)
    on update cascade
    on delete restrict,
  attempt_number integer not null
    check (attempt_number between 1 and 10),
  provider_key text not null
    check (provider_key ~ '^[a-z][a-z0-9_-]{1,63}$'),
  attempt_state text not null
    check (
      attempt_state in (
        'submitted',
        'accepted',
        'delivered',
        'failed'
      )
    ),
  retryable boolean not null default false,
  provider_reference text
    check (
      provider_reference is null
      or char_length(provider_reference) between 1 and 240
    ),
  error_code text
    check (
      error_code is null
      or char_length(error_code) between 1 and 120
    ),
  error_summary text
    check (
      error_summary is null
      or char_length(error_summary) between 1 and 500
    ),
  started_at timestamptz not null default statement_timestamp(),
  completed_at timestamptz,
  constraint communication_attempts_dispatch_number_unique
    unique (dispatch_id, attempt_number)
);

create table icamp_private.communication_provider_events (
  id uuid primary key default gen_random_uuid(),
  provider_key text not null
    check (provider_key ~ '^[a-z][a-z0-9_-]{1,63}$'),
  provider_event_id text not null
    check (char_length(provider_event_id) between 1 and 240),
  dispatch_id uuid
    references icamp_private.communication_dispatches(id)
    on update cascade
    on delete set null,
  channel text not null
    check (
      channel in (
        'web',
        'voice',
        'dtmf',
        'speech',
        'sms',
        'mms',
        'email',
        'push'
      )
    ),
  event_type text not null
    check (char_length(event_type) between 1 and 120),
  event_status text not null
    check (char_length(event_status) between 1 and 120),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  occurred_at timestamptz not null,
  received_at timestamptz not null default statement_timestamp(),
  constraint communication_provider_events_provider_event_unique
    unique (provider_key, provider_event_id)
);

create index communication_endpoints_scope_kind_idx
  on icamp_private.communication_endpoints (
    organization_id,
    campground_id,
    endpoint_kind,
    lifecycle_state
  );

create index communication_endpoints_owner_idx
  on icamp_private.communication_endpoints (
    owner_user_id,
    lifecycle_state
  );

create index communication_preferences_endpoint_idx
  on icamp_private.communication_preferences (
    endpoint_id,
    purpose,
    preference_state
  );

create index communication_consents_endpoint_time_idx
  on icamp_private.communication_consents (
    endpoint_id,
    purpose,
    channel,
    occurred_at desc
  );

create index communication_consents_recorded_by_idx
  on icamp_private.communication_consents (
    recorded_by_user_id,
    occurred_at desc
  );

create index communication_dispatches_scope_state_idx
  on icamp_private.communication_dispatches (
    organization_id,
    campground_id,
    delivery_state,
    created_at desc
  );

create index communication_dispatches_endpoint_idx
  on icamp_private.communication_dispatches (
    endpoint_id,
    created_at desc
  );

create index communication_dispatches_created_by_idx
  on icamp_private.communication_dispatches (
    created_by_user_id,
    created_at desc
  );

create index communication_attempts_provider_state_idx
  on icamp_private.communication_attempts (
    provider_key,
    attempt_state,
    started_at desc
  );

create index communication_provider_events_dispatch_idx
  on icamp_private.communication_provider_events (
    dispatch_id,
    received_at desc
  );

create trigger communication_endpoints_touch_row
before update on icamp_private.communication_endpoints
for each row execute function icamp_private.touch_row();

create trigger communication_preferences_touch_row
before update on icamp_private.communication_preferences
for each row execute function icamp_private.touch_row();

create trigger communication_dispatches_touch_row
before update on icamp_private.communication_dispatches
for each row execute function icamp_private.touch_row();

create or replace function icamp_private.prevent_communication_consent_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception using
    errcode = '55000',
    message = 'Communication consent evidence is append-only and cannot be updated or deleted';
end;
$$;

create trigger communication_consents_append_only
before update or delete on icamp_private.communication_consents
for each row execute function icamp_private.prevent_communication_consent_mutation();

create or replace function icamp_private.prevent_communication_provider_event_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception using
    errcode = '55000',
    message = 'Communication provider events are append-only and cannot be updated or deleted';
end;
$$;

create trigger communication_provider_events_append_only
before update or delete on icamp_private.communication_provider_events
for each row execute function icamp_private.prevent_communication_provider_event_mutation();

revoke all on icamp_private.communication_endpoints from public;
revoke all on icamp_private.communication_preferences from public;
revoke all on icamp_private.communication_consents from public;
revoke all on icamp_private.communication_dispatches from public;
revoke all on icamp_private.communication_attempts from public;
revoke all on icamp_private.communication_provider_events from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on icamp_private.communication_endpoints from anon';
    execute 'revoke all on icamp_private.communication_preferences from anon';
    execute 'revoke all on icamp_private.communication_consents from anon';
    execute 'revoke all on icamp_private.communication_dispatches from anon';
    execute 'revoke all on icamp_private.communication_attempts from anon';
    execute 'revoke all on icamp_private.communication_provider_events from anon';
  end if;

  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on icamp_private.communication_endpoints from authenticated';
    execute 'revoke all on icamp_private.communication_preferences from authenticated';
    execute 'revoke all on icamp_private.communication_consents from authenticated';
    execute 'revoke all on icamp_private.communication_dispatches from authenticated';
    execute 'revoke all on icamp_private.communication_attempts from authenticated';
    execute 'revoke all on icamp_private.communication_provider_events from authenticated';
  end if;
end
$$;

comment on table icamp_private.communication_endpoints is
  'Private contact/delivery endpoints. Raw endpoint values must never be exposed in public diagnostics, logs or audit snapshots.';
comment on table icamp_private.communication_preferences is
  'Current purpose/channel communication preferences. Build 014 adds compliance-specific STOP/START/HELP synchronization.';
comment on table icamp_private.communication_consents is
  'Append-only purpose/channel consent evidence. Store references, not message bodies or secrets.';
comment on table icamp_private.communication_dispatches is
  'Provider-neutral communication delivery/call metadata. Message/call content stays outside ordinary dispatch telemetry.';
comment on table icamp_private.communication_attempts is
  'Bounded provider-attempt evidence with sanitized error codes/summaries only.';
comment on table icamp_private.communication_provider_events is
  'Append-only normalized provider events. Never persist raw webhook bodies or signatures in metadata.';
