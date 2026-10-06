# iCamp Background Jobs, Scheduler & Operational Queues

## Purpose

Build 007 establishes the durable server-side work foundation used by later booking, maintenance, communications, provider callback and operational automation features.

The implementation is deliberately **provider-portable PostgreSQL**. iCamp does not depend on a hosted queue extension or one cron vendor. A deployment may later place a timer, worker service, Supabase Cron, managed scheduler or another adapter in front of these contracts without changing job semantics.

## Durable job model

Background work is stored in the private `icamp_private.job_queue` table.

Every job records:
- queue and job type;
- optional organization/campground scope;
- JSON object payload;
- optional idempotency key;
- scheduled/available time;
- priority;
- bounded attempt count and retry base delay;
- worker lease owner/expiry and heartbeat;
- sanitized last error code/summary;
- succeeded or dead-letter terminal timestamps.

Job payloads are server-only. The private schema remains unavailable to `anon` and `authenticated`.

## Delivery and concurrency contract

Workers use a database lease, not an in-memory lock.

Claiming uses PostgreSQL row locking with `FOR UPDATE SKIP LOCKED` so concurrent workers cannot claim the same available job in the same attempt. A running job carries a finite lease. If its worker disappears:
- an expired lease with attempts remaining returns to the queue;
- an expired lease after the final permitted attempt moves to dead-letter.

This provides **at-least-once processing**. Handlers must therefore be idempotent for side effects such as payments, messages, provider commands and inventory changes.

## Idempotency

Callers may provide an `idempotency_key`. The database enforces uniqueness per queue for non-null keys.

Scheduled occurrences derive their key from the schedule ID plus the exact occurrence timestamp. Re-running a scheduler tick cannot create a duplicate occurrence for the same schedule/time.

Idempotency prevents duplicate queue records; domain handlers must still use their own provider/domain idempotency controls when an external system can be called more than once.

## Retries

Retries are bounded by `max_attempts` (1–25).

The runtime exposes deterministic exponential backoff through `retryDelaySeconds()`, capped at one hour. A handler may request another bounded retry delay when operationally justified.

Only sanitized error code/summary fields belong in queue state. Do not persist:
- stack traces;
- passwords, tokens or API keys;
- payment-card data;
- authentication/verification codes;
- access credential secrets;
- arbitrary request bodies;
- sensitive message or incident content.

## Dead-letter visibility

Jobs that exhaust retries or lose their final worker lease move to `dead_letter`.

The runtime exposes a bounded dead-letter listing for authorized operational tooling. Dead-letter records are retained for diagnosis and deliberate remediation rather than silently discarded.

Build 007 does not add an automatic replay button. Future replay/remediation controls must be permissioned and audited before they can change operational state.

## Durable scheduler

`icamp_private.job_schedules` provides interval-based durable schedules:
- stable schedule key;
- queue and job type;
- optional tenant/property scope;
- payload;
- cadence;
- next occurrence;
- retry policy;
- active state.

`runDueSchedules()` locks due schedules, enqueues one idempotent occurrence per due schedule, advances its next occurrence by one cadence, and records a scheduler heartbeat. Repeated ticks catch up missed occurrences without collapsing history into one row.

Build 068 adds the richer maintenance recurrence model. It will emit work through this Build 007 foundation rather than creating a second background engine.

## Worker and scheduler heartbeats

`queue_workers` records active/stopped worker heartbeats.

`scheduler_heartbeats` records:
- heartbeat;
- last tick start/completion;
- due schedules found;
- jobs enqueued;
- sanitized error code.

These records intentionally contain operational metadata, not job payload content.

## I.T. & Analysis health

The protected I.T. & Analysis workspace reports only safe aggregate queue/scheduler signals:
- queued/running/dead-letter job counts;
- overdue queued jobs;
- expired leases;
- active/stalled worker counts;
- active/overdue schedules;
- scheduler healthy/stalled/standby state;
- latest safe heartbeat timestamps.

No payloads, exception details, credentials or personal data are exposed in this health summary.

A scheduler with no active schedules is **standby**, not failed. A scheduler becomes stalled when active schedules exist and its heartbeat is missing/stale.

## Channel contract

Background execution is channel-neutral.

Web/PWA, IVR/DTMF and SMS handlers may all enqueue the same canonical domain jobs. No channel receives a separate queue implementation or permission bypass.

Where a later channel action is privileged, the originating request must complete its normal authorization/re-authentication/audit requirements before enqueueing the privileged command.

## Operational deployment boundary

Build 007 provides the durable queue/scheduler engine and health evidence. A production timer/worker host is an adapter around these functions.

The adapter must:
1. heartbeat itself;
2. tick due schedules;
3. claim with a finite lease;
4. heartbeat long-running work before the lease expires;
5. mark success or safe failure;
6. avoid logging raw payloads;
7. stop/identify itself cleanly during shutdown where possible.

## Verification

CI applies the complete migration set to PostgreSQL 17 and runs `npm run jobs:verify`.

The lifecycle verification proves:
- schedule-to-job generation;
- no duplicate scheduled occurrence on an immediate second tick;
- explicit enqueue idempotency;
- worker heartbeat;
- claim lease and job heartbeat;
- retry then dead-letter after final attempt;
- successful completion;
- expired final lease recovery to dead-letter;
- dead-letter listing;
- scheduler/worker health signals.

Hosted Supabase receives the same canonical migration and is separately verified before production promotion.
