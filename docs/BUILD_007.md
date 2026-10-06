# Build 007 — Background Jobs, Scheduler & Operational Queues

Status: **IMPLEMENTED — PROMOTION PENDING**

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
- `database/verify/0008_background_jobs_scheduler_queues.sql`

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

The canonical Build 007 migration will be applied to the connected RosevearCreations iCamp project and checked with:
- structural SQL verification;
- rollback-only lifecycle/security checks;
- security advisor;
- migration history.

## Promotion gate

Build 007 is complete only when:
1. feature → `dev` checks are GREEN;
2. exact tested `dev` tree is promoted to `main`;
3. independent `main` push checks are GREEN;
4. source-of-truth closeout records the final production SHA;
5. active queue advances to Build 008.

## Next build

**Build 008 — Secure Media & Document Storage Foundation**
