-- iCamp Build 007
-- Provider-portable durable background jobs, schedules, leases and operational heartbeats.

create table icamp_private.job_schedules (
  id uuid primary key default gen_random_uuid(),
  schedule_key text not null unique
    check (schedule_key ~ '^[a-z][a-z0-9_]*(?:[.-][a-z0-9_]+)*$'),
  queue_name text not null default 'default'
    check (queue_name ~ '^[a-z][a-z0-9_-]{0,63}$'),
  job_type text not null
    check (job_type ~ '^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$'),
  organization_id uuid
    references public.organizations(id)
    on update cascade
    on delete restrict,
  campground_id uuid,
  payload jsonb not null default '{}'::jsonb
    check (jsonb_typeof(payload) = 'object'),
  cadence_seconds integer not null
    check (cadence_seconds between 60 and 31536000),
  next_run_at timestamptz not null,
  max_attempts smallint not null default 5
    check (max_attempts between 1 and 25),
  retry_base_seconds integer not null default 30
    check (retry_base_seconds between 1 and 86400),
  active boolean not null default true,
  last_enqueued_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint job_schedules_scope_check
    check (campground_id is null or organization_id is not null),
  constraint job_schedules_campground_fk
    foreign key (organization_id, campground_id)
    references public.campgrounds(organization_id, id)
    on update cascade
    on delete restrict
);

create table icamp_private.job_queue (
  id uuid primary key default gen_random_uuid(),
  queue_name text not null default 'default'
    check (queue_name ~ '^[a-z][a-z0-9_-]{0,63}$'),
  job_type text not null
    check (job_type ~ '^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$'),
  idempotency_key text
    check (
      idempotency_key is null
      or char_length(idempotency_key) between 1 and 240
    ),
  schedule_id uuid
    references icamp_private.job_schedules(id)
    on update cascade
    on delete set null,
  organization_id uuid
    references public.organizations(id)
    on update cascade
    on delete restrict,
  campground_id uuid,
  payload jsonb not null default '{}'::jsonb
    check (jsonb_typeof(payload) = 'object'),
  priority smallint not null default 0
    check (priority between -100 and 100),
  state text not null default 'queued'
    check (state in ('queued', 'running', 'succeeded', 'dead_letter')),
  scheduled_for timestamptz not null default statement_timestamp(),
  available_at timestamptz not null default statement_timestamp(),
  attempt_count smallint not null default 0
    check (attempt_count between 0 and 25),
  max_attempts smallint not null default 5
    check (max_attempts between 1 and 25),
  retry_base_seconds integer not null default 30
    check (retry_base_seconds between 1 and 86400),
  lease_owner text
    check (lease_owner is null or char_length(lease_owner) between 1 and 160),
  lease_expires_at timestamptz,
  last_heartbeat_at timestamptz,
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
  dead_lettered_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint job_queue_scope_check
    check (campground_id is null or organization_id is not null),
  constraint job_queue_campground_fk
    foreign key (organization_id, campground_id)
    references public.campgrounds(organization_id, id)
    on update cascade
    on delete restrict,
  constraint job_queue_attempt_limit_check
    check (attempt_count <= max_attempts),
  constraint job_queue_lease_state_check
    check (
      (state = 'running' and lease_owner is not null and lease_expires_at is not null)
      or
      (state <> 'running' and lease_owner is null and lease_expires_at is null)
    ),
  constraint job_queue_completion_state_check
    check (
      (state = 'succeeded' and completed_at is not null and dead_lettered_at is null)
      or
      (state = 'dead_letter' and dead_lettered_at is not null and completed_at is null)
      or
      (state in ('queued', 'running') and completed_at is null and dead_lettered_at is null)
    )
);

create unique index job_queue_idempotency_idx
  on icamp_private.job_queue (queue_name, idempotency_key)
  where idempotency_key is not null;

create index job_queue_claim_idx
  on icamp_private.job_queue (
    queue_name,
    state,
    priority desc,
    available_at,
    scheduled_for
  )
  where state in ('queued', 'running');

create index job_queue_dead_letter_idx
  on icamp_private.job_queue (queue_name, dead_lettered_at desc)
  where state = 'dead_letter';

create index job_queue_schedule_idx
  on icamp_private.job_queue (schedule_id, scheduled_for desc)
  where schedule_id is not null;

create index job_schedules_due_idx
  on icamp_private.job_schedules (next_run_at, queue_name)
  where active = true;

create table icamp_private.queue_workers (
  worker_id text primary key
    check (char_length(worker_id) between 1 and 160),
  queue_name text not null
    check (queue_name ~ '^[a-z][a-z0-9_-]{0,63}$'),
  started_at timestamptz not null default statement_timestamp(),
  heartbeat_at timestamptz not null default statement_timestamp(),
  stopped_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object')
);

create index queue_workers_health_idx
  on icamp_private.queue_workers (queue_name, heartbeat_at)
  where stopped_at is null;

create table icamp_private.scheduler_heartbeats (
  scheduler_id text primary key
    check (char_length(scheduler_id) between 1 and 160),
  heartbeat_at timestamptz not null default statement_timestamp(),
  last_tick_started_at timestamptz,
  last_tick_completed_at timestamptz,
  due_schedules_found integer not null default 0
    check (due_schedules_found >= 0),
  jobs_enqueued integer not null default 0
    check (jobs_enqueued >= 0),
  last_error_code text
    check (
      last_error_code is null
      or char_length(last_error_code) between 1 and 120
    ),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object')
);

revoke all on icamp_private.job_schedules from public;
revoke all on icamp_private.job_queue from public;
revoke all on icamp_private.queue_workers from public;
revoke all on icamp_private.scheduler_heartbeats from public;

comment on table icamp_private.job_schedules is
  'Provider-portable durable interval schedules. A scheduler tick converts due rows into idempotent queue jobs.';
comment on table icamp_private.job_queue is
  'Durable background work with bounded retries, visibility leases and dead-letter state.';
comment on table icamp_private.queue_workers is
  'Operational worker heartbeats used to identify stalled or intentionally stopped queue consumers.';
comment on table icamp_private.scheduler_heartbeats is
  'Sanitized scheduler heartbeat and tick counters for I.T./Analysis health reporting.';
