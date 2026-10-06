-- iCamp Build 006
-- Append-only audit evidence and recent re-authentication timestamp support.

alter table icamp_private.auth_sessions
  add column reauthenticated_at timestamptz;

update icamp_private.auth_sessions
set reauthenticated_at = created_at
where reauthenticated_at is null;

alter table icamp_private.auth_sessions
  alter column reauthenticated_at set not null;

create index auth_sessions_recent_reauth_idx
  on icamp_private.auth_sessions (
    user_id,
    reauthenticated_at desc
  )
  where revoked_at is null;

create table icamp_private.audit_events (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default statement_timestamp(),
  actor_user_id uuid,
  actor_session_id uuid,
  organization_id uuid,
  campground_id uuid,
  action_key text not null
    check (action_key ~ '^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$'),
  permission_key text
    check (
      permission_key is null
      or permission_key ~ '^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$'
    ),
  risk_level text not null
    check (risk_level in ('standard', 'elevated', 'high')),
  outcome text not null
    check (outcome in ('succeeded', 'denied', 'failed')),
  reason text
    check (
      reason is null
      or char_length(trim(reason)) between 8 and 500
    ),
  subject_type text
    check (
      subject_type is null
      or subject_type ~ '^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)*$'
    ),
  subject_id text
    check (
      subject_id is null
      or char_length(subject_id) between 1 and 200
    ),
  request_id text
    check (
      request_id is null
      or char_length(request_id) between 1 and 160
    ),
  before_state jsonb,
  after_state jsonb,
  metadata jsonb not null default '{}'::jsonb,
  reauthenticated_at timestamptz,
  assurance_level text
    check (
      assurance_level is null
      or assurance_level in ('aal1', 'aal2')
    ),
  constraint audit_events_privileged_reason_check
    check (
      risk_level = 'standard'
      or (
        reason is not null
        and char_length(trim(reason)) between 8 and 500
      )
    ),
  constraint audit_events_before_object_check
    check (
      before_state is null
      or jsonb_typeof(before_state) = 'object'
    ),
  constraint audit_events_after_object_check
    check (
      after_state is null
      or jsonb_typeof(after_state) = 'object'
    ),
  constraint audit_events_metadata_object_check
    check (jsonb_typeof(metadata) = 'object')
);

create index audit_events_scope_time_idx
  on icamp_private.audit_events (
    organization_id,
    campground_id,
    occurred_at desc
  );

create index audit_events_actor_time_idx
  on icamp_private.audit_events (
    actor_user_id,
    occurred_at desc
  );

create index audit_events_action_time_idx
  on icamp_private.audit_events (
    action_key,
    occurred_at desc
  );

create or replace function icamp_private.prevent_audit_event_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception using
    errcode = '55000',
    message = 'Audit events are append-only and cannot be updated or deleted';
end;
$$;

create trigger audit_events_append_only
before update or delete on icamp_private.audit_events
for each row execute function icamp_private.prevent_audit_event_mutation();

revoke all on icamp_private.audit_events from public;

comment on table icamp_private.audit_events is
  'Append-only security and operational audit evidence. Rows may be inserted but never silently rewritten or deleted.';

comment on column icamp_private.auth_sessions.reauthenticated_at is
  'Most recent successful primary/strong re-authentication time for privileged-action freshness checks.';
