# Build 067 — Recurring Maintenance Scheduler

## Status
**FULLY PROMOTED — `main` GREEN.**

## Queue authority
Build 067 advances the maintenance roadmap after Build 066 and implements the historical roadmap's Build 068 recurring-maintenance capability.

## Delivered scope
- recurring maintenance definitions for:
  - hourly;
  - every-N-hours;
  - daily;
  - weekly;
  - monthly;
  - seasonal/yearly;
  - custom minute intervals;
- first-occurrence scheduling in the campground timezone;
- timezone-preserving daily/weekly/monthly/seasonal next-occurrence calculation;
- monthly/seasonal end-of-month clamping rather than invalid dates;
- immutable schedule definitions with active/inactive lifecycle;
- configurable late threshold and catch-up policy:
  - create the work order late; or
  - record a missed occurrence;
- durable Build 007 schedule synchronization;
- discrete occurrence history;
- occurrence-to-canonical-Build-065-work-order linkage;
- stale/inactive occurrence skip evidence;
- ordered predecessor protection so concurrent workers cannot silently skip an earlier occurrence;
- bounded worker orchestration using Build 007 queue leases, retries and dead-letter behavior;
- responsive Web/PWA schedule management and occurrence-history workspace.

## Reused authorities
Build 067 does **not** create a second scheduler or work-order engine.

It reuses:
- Build 007 `icamp_private.job_schedules`, `job_queue`, leases, retries, idempotency and heartbeats;
- Build 064 category and priority policy identities;
- Build 065 canonical maintenance work orders and status evidence;
- Build 066 maintenance responsibility/leadership model;
- Build 006 audit evidence.

Each maintenance definition is synchronized into Build 007 with:
- queue: `maintenance`;
- job type: `maintenance.schedule.materialize`;
- payload: opaque maintenance schedule ID only;
- a stable schedule key derived from the maintenance schedule UUID.

## Recurrence semantics
The first occurrence is entered as campground-local date/time and converted using the canonical campground timezone.

Subsequent occurrences:
- hourly / every-N-hours — local-clock interval;
- daily — next campground-local day at the original local clock time;
- weekly — seven campground-local days later;
- monthly — configured day in the next month, clamped to that month's last valid day;
- seasonal — configured month/day in the next year, clamped when required;
- custom — exact bounded minute interval.

The domain handler resets Build 007's next-run timestamp after each occurrence. Monthly/seasonal schedules use a long guard cadence in Build 007 and rely on the domain next-occurrence calculation, avoiding the false assumption that every month/year has fixed seconds.

## Occurrence processing
A due Build 007 job:
1. locks the maintenance schedule;
2. rejects out-of-order future processing so an earlier occurrence can retry first;
3. idempotently returns an already-recorded occurrence;
4. records an inactive/stale job as skipped;
5. applies the configured late threshold;
6. either records a missed occurrence or creates the canonical Build 065 work order;
7. records immutable occurrence evidence;
8. advances the maintenance schedule's next occurrence;
9. synchronizes that next occurrence back into Build 007;
10. writes audit evidence.

The canonical work order uses the occurrence's scheduled time for response/completion target calculation. If a late occurrence is intentionally created, it can therefore surface immediately as overdue rather than hiding the lateness.

## Authorization
Build 067 adds:
- `maintenance.schedule` — elevated authority to create and activate/deactivate recurring maintenance definitions.

Default grants:
- Maintenance Main Foreman;
- Campground Manager;
- Owner / Administrator.

Schedule creation also requires canonical `maintenance.create` authority because successful occurrences create work orders.

## Security
- public schedule and occurrence tables enable and **FORCE RLS**;
- direct `anon` and `authenticated` access is revoked;
- `icamp_app` receives no schedule DELETE;
- occurrence history receives no UPDATE or DELETE;
- occurrence history is unique by schedule + scheduled timestamp;
- schedule-definition identity/recurrence fields are immutable after creation;
- only the trusted scheduler path can advance `next_occurrence_at`;
- raw Build 007 payloads remain private;
- background failure evidence uses a sanitized error code/summary rather than raw exception payloads.

## Omnichannel contract
- Web/PWA provides the full recurrence editor, lifecycle controls and occurrence history.
- Voice/IVR/DTMF and SMS/MMS may invoke supported schedule-status, activation or deactivation commands only through the same authorized server service.
- rich recurrence editing, date/time selection and history review use a verified secure-link or staff-assisted handoff instead of pretending keypad/SMS is a visual scheduler.

## Boundaries
Build 067 does **not** create:
- inspection/checklist templates — Build 068;
- pool/water-park operational checks — later scope;
- a second queue/cron provider;
- a second work-order model;
- automatic external timer hosting. The Build 007 deployment adapter remains provider-portable and may call `runMaintenanceSchedulerCycle()`.

## Verification
- unit/static tests cover recurrence kinds, validation, Build 007 reuse, work-order linkage, concurrency protection and Web/PWA controls;
- database verification checks permission grants, forced RLS, append-only occurrence posture and Build 007 synchronization trigger;
- CI applies PostgreSQL 17 migration history and idempotent replay;
- Browser E2E, TypeScript, lint, production build, dependency audit, CodeQL and Gitleaks must be GREEN before promotion;
- final feature head `205bc63e3c9d75a5cf29ac2c24a6946563ef5989` passed CI #39528268560, CodeQL #39528268512 and Secret Scan #39528268625;
- feature PR #249 merged to `dev` at `9f675498f2443511b5d5f728884c69f68ae7c7b8`;
- independent `dev` push passed CI #39528481047, CodeQL #39528481046 and Secret Scan #39528481057;
- hosted migration `20261021014030 / recurring_maintenance_scheduler` applied successfully and exact Build 067 verification SQL passed;
- Supabase Security Advisor returned zero findings;
- Supabase Performance Advisor returned zero Build 067 unindexed-foreign-key findings; only expected INFO-level unused-index notices remained;
- production PR #250 passed CI #39528753205, CodeQL #39528753198 and Secret Scan #39528753229;
- production feature `main` SHA `5787f35d9e1a50080b291299964bb213b5288a68` independently passed CI #39528974035, CodeQL #39528973978 and Secret Scan #39528974075;
- Verify, Browser E2E, PostgreSQL migration/lifecycle/idempotence, production build, dependency audit, CodeQL and Gitleaks were GREEN at the production feature checkpoint.

## Cost / infrastructure
No paid service, new hosted project, queue provider, Worker, D1 database, R2 bucket, Vercel project or new secret is required.

## Manual action
**None expected.**

## Next build after successful promotion
**Build 068 — Versioned Inspection Templates & Sign-Off**, advancing the historical roadmap's Build 069 capability.
