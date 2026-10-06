# iCamp I.T. & Analysis Source of Truth

## Mission

The I.T. & Analysis subsystem exists to make iCamp supportable, diagnosable and recoverable without exposing sensitive campground information.

It is both:
- a **technical operating layer behind iCamp**; and
- an authorized web workspace for I.T./system operators.

The public/client web experience may show safe status information, but detailed diagnostics remain private.

## Core health contracts

### Liveness
Answers one question: **Can this application process respond?**

A complete process lockup cannot reliably self-report, so liveness must eventually be checked by an independent external watchdog.

### Readiness
Answers: **Is this instance correctly configured and ready to serve its expected role?**

Readiness checks can include:
- runtime configuration validity;
- database connectivity once introduced;
- storage;
- queues/schedulers;
- critical integrations.

### Version
Returns safe release identity:
- application name/version;
- environment;
- build SHA/release ID;
- deployment timestamp when configured.

### Public status
Returns only a sanitized overall state suitable for clients. It must not expose stack traces, secrets, internal addresses, dependency credentials, personal data or detailed security state.

## I.T. workspace

The I.T. & Analysis workspace will mature into:
- release/environment overview;
- service health;
- error groups/fingerprints;
- request/correlation lookup;
- dependency/integration health;
- queue/scheduler health;
- latency/resource trends;
- incident timeline;
- alert acknowledgement/escalation;
- support evidence packages.

Build 002 established the safe public/runtime baseline. Builds 004–006 added authentication, authorization and audit controls. Build 007 now adds protected aggregate queue/scheduler health while keeping job payloads and sensitive diagnostics private.

## Queue and scheduler health

Build 007 adds authorized operational signals for:
- queued and running work;
- dead-letter jobs;
- overdue queued jobs;
- expired job leases;
- active and stalled workers;
- active and overdue schedules;
- scheduler heartbeat/tick state.

The I.T. workspace exposes aggregate counts and safe timestamps only. It does not expose job payloads, raw exception bodies, credentials, personal data or private infrastructure topology.

A deployment with no active schedules reports scheduler **standby** rather than failure. When active schedules exist, missing/stale scheduler heartbeat is a degraded signal.

The canonical queue implementation remains provider-portable PostgreSQL. An external timer/worker host is an adapter and can change without changing iCamp job semantics.

## Error handling

Ordinary clients should receive:
- a plain-language failure message;
- a safe support/correlation reference;
- no stack trace;
- no secret/internal configuration detail.

I.T. diagnostics may later correlate that support reference to authorized telemetry.

## Correlation IDs

iCamp should generate its own request/correlation identifier rather than trust one supplied by an untrusted client.

Correlation IDs should be propagated through internal operations and provider calls where practical.

## Lockup detection

A frozen runtime may fail to execute any in-process detector.

Therefore production lockup detection uses:
1. internal liveness/readiness endpoints;
2. an independent monitor outside the runtime;
3. missed-check thresholds;
4. alert/escalation;
5. later incident/recovery automation.

The monitor is provider-neutral. Free/self-hosted monitoring is acceptable for development/pilot.

## Diagnostic privacy

Do not log by default:
- passwords;
- session tokens;
- API keys;
- payment-card numbers;
- staff/guest authentication PINs;
- full financing documents;
- full SMS/voice content;
- arbitrary request/response bodies;
- sensitive incident narratives.

Prefer:
- structured fields;
- record identifiers;
- fingerprints;
- timings;
- status codes;
- provider/integration names;
- correlation IDs.

## Environments

Development, staging and production must be visually and technically distinguishable.

Non-production environments should carry an obvious UI banner to reduce accidental entry of real data or mistaken operational actions.

## Free-first and migration

Build 002 introduces no paid monitoring product.

Health/status/diagnostic contracts belong to iCamp, allowing later use of:
- self-hosted monitoring;
- free development-tier monitoring;
- managed APM/observability;
- larger enterprise tooling.

Changing monitoring providers must not require changing campground business logic.
