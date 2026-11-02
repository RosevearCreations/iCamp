# Build 007 — Background Jobs, Scheduler & Operational Queues

Status: **FULLY PROMOTED — `main` PRODUCTION GREEN**

## Scope

Build 007 delivers the provider-portable operational execution foundation defined in the active roadmap:
- durable scheduled-job abstraction;
- retries and idempotency conventions;
- dead-letter/failed-job visibility;
- scheduler health reporting;
- queue heartbeat, stalled-worker and overdue-job signals for I.T./Analysis.

## Implementation

### Database
- `database/migrations/0008_background_jobs_scheduler_queues.sql`
- `database/migrations/0009_background_jobs_fk_indexes.sql`
- `database/verify/0008_background_jobs_scheduler_queues.sql`
- `database/verify/0009_background_jobs_fk_indexes.sql`

Private operational tables:
- `icamp_private.job_schedules`
- `icamp_private.job_queue`
- `icamp_private.queue_workers`
- `icamp_private.scheduler_heartbeats`

### Runtime
`lib/jobs/postgres.mjs` provides:
- `enqueueJob`
- `registerSchedule`
- `runDueSchedules`
- `heartbeatWorker` / `stopWorker`
- `claimJob`
- `heartbeatJob`
- `completeJob`
- `failJob`
- `listDeadLetterJobs`
- `getOperationalQueueHealth`
- deterministic bounded exponential retry delay.

### Concurrency/recovery
- queue claims use `FOR UPDATE SKIP LOCKED`;
- running jobs use finite worker leases;
- expired leases requeue when attempts remain;
- expired final-attempt leases dead-letter;
- jobs use at-least-once delivery semantics;
- idempotency keys prevent duplicate queue records.

### I.T. & Analysis
The authenticated `it.health.read` workspace adds aggregate operational queue health without exposing payloads or private infrastructure details.

### Omnichannel
Web/PWA, IVR/DTMF and SMS all use the same canonical background-job layer. Queue execution does not grant or replace the authorization required by the originating domain command.

## Automated proof

`scripts/verify-background-jobs-lifecycle.mjs` verifies the full PostgreSQL lifecycle. CI runs it in the PostgreSQL 17 database job.

## Supabase

The canonical Build 007 migrations were applied to the connected RosevearCreations iCamp project:
- `0008_background_jobs_scheduler_queues`;
- `0009_background_jobs_fk_indexes`.

Hosted verification proved:
- all four private operational tables and required indexes exist;
- `anon` and `authenticated` have no private-schema usage and no job-queue SELECT access;
- rollback-only schedule/job/worker/scheduler fixtures retained zero rows;
- queue idempotency was exercised in the rollback-only hosted proof;
- Supabase Security Advisor reports zero security lints;
- the advisor-driven foreign-key index notices were resolved by migration 0009;
- remaining performance notices are INFO-level unused-index observations expected on the new/near-empty development database.

## Production evidence

Build 007 implementation promotion completed through:
- feature PR #23 → `dev`, exact tested feature head `f07e1f614fc12750ee675128127981a01f394548`;
- independently validated `dev` merge `affc2d8efa09439fe22192bba21993e332a982b9`;
- production PR #24 → `main`;
- implementation production SHA `e5bdfab8264d50f5c5688619a6bcd623a02e84d8`.

The independent `main` push proof is GREEN for:
- Verify;
- PostgreSQL migrations and all lifecycle checks, including Build 007;
- Secret Scan;
- CodeQL.

No manual operator action is required for Build 007.

## Next build

**Build 008 — Secure Media & Document Storage Foundation**
