# iCamp Build 205 — CI runtime budgets, queue SLA monitoring, protected recovery

## Scope and safeguards

Build 205 adds read-only GitHub Actions timing evidence to the existing `CI / Verify`
job. No workflow, webhook, runner or release gate is added. The existing five
required checks retain their names, independent security boundaries, PR/main
trigger coverage and required PASS behavior.

The diagnostic runs **even if a previous Verify step fails** (`if: always()`),
reads a maximum of 12 recently completed workflow runs with the built-in
GitHub token (`actions: read`), and uploads `build205-ci-runtime-evidence`
as a JSON artifact for 14 days. Its GitHub job summary displays p90 queue
delay (run creation to job start) and p90 job elapsed time (start to finish),
each measured only from real GitHub Actions timestamps.

Measurement labels:

- `WITHIN_MONITORING_BUDGET`: at least three completed samples for the specific
  check and both p90 values at/below budget.
- `SLA_BREACH_DIAGNOSTIC_ONLY`: observed p90 exceeds a queue or runtime budget.
- `INSUFFICIENT_MEASUREMENTS`: fewer than three samples. Do not call this green.
- `NO_MEASUREMENT` and `GITHUB_ACTIONS_HISTORY_UNAVAILABLE`: GitHub's API was
  inaccessible, unauthenticated, or no suitable timestamps existed. The
  artifact explicitly records the gap, never synthetic success.

## Monitoring budgets (not protected job timeouts)

| Required check | Queue p90 warning | Runtime p90 warning | Existing hard timeout |
| --- | ---: | ---: | ---: |
| CI / Verify | 10 min | 16 min | 20 min |
| CI / Browser end-to-end | 10 min | 19 min | 20 min |
| CI / Database migrations | 10 min | 14 min | 15 min |
| Secret Scan / Gitleaks | 10 min | 9 min | 10 min |
| CodeQL / Analyze JavaScript and TypeScript | 10 min | 19 min | 30 min |

These are operational diagnostics, not an acceptance bypass. Jobs exceeding a
budget remain protected, and failed tests/audits/scans still fail the PR or
main commit. A historic failure remains visible by run ID and commit SHA.

## Recovery and escalation

1. Open the failing GitHub Actions run, then its `CI / Verify` job summary and
   `build205-ci-runtime-evidence` artifact. Compare queue p90 with runtime p90.
2. **Long queue:** review runner availability, Actions concurrency/backlog,
   queued/cancelled PR attempts, and simultaneous application promotions. Do
   not cancel running main checks or security gates.
3. **Slow runtime:** inspect step durations, dependency install, browser
   provisioning and PostgreSQL migration replay. Optimize safe caching or
   redundant computation in a separately tested build; do not skip test paths.
4. **Failed/absent evidence:** inspect the exact run and commit. If GitHub
   Actions API is rate-limited or unavailable, label the SLA `UNAVAILABLE`
   and manually inspect timestamps; don't invent passing measurements.
5. Retry only the exact authorized commit after diagnosing the cause, and
   retain all five successful protected PR and main check receipts plus the
   Vercel READY, exact-SHA version and readiness evidence before closure.

This release does not activate iCamp accounts, enroll Comms Hub peer identity,
grant owner TEST authorization, send SMS/calls, or initiate a handshake. Build
203's original-issuer custody and independently authorized TEST procedure
remain on HOLD unless genuine outside evidence resolves those conditions.
