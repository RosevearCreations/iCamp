# Build 198 — Backup/Restore Drills, Performance Budgets & Incident Runbooks

## Delivered boundary

- Protected `/workspaces/it-analysis/resilience`, linked from the I.T. command centre. This distinguishes **currently observed** config/queue signals from **not attached** synthetic CI evidence, with clear recovery-runbook actions. Authorization remains `it.health.read`, and public `/status` does not gain private data.
- `npm run build198:restore-drill`: isolated PostgreSQL 17 test-only `pg_dump -Fc` → randomly named disposable local database → `pg_restore --exit-on-error` → deterministic row-count/forced-privacy-RLS/unauthorized-actor checks. Reports a measured synthetic restore duration in JSON, removes only the generated target and temp archive, and rejects remote, production, development and unacknowledged source URLs.
- `npm run build198:db-budget`: 20 sampled source-scoped read-only SQL queries against a seeded synthetic organization, 250 ms p95 target, no writes or arbitrary SQL.
- `npm run build198:http-budget`: 20 requests each to public health and readiness routes with 500 ms/750 ms p95 targets. Exits nonzero on non-2xx or timeout. Test coverage includes a local synthetic 503 outage; operator invocation requires an explicitly provided app origin and does not mutate the destination.
- GitHub CI `Database migrations` job now seeds/verifies the fixture and runs the two recovery/database probes. Source/restore counts, authorization denial and measured timing are in the workflow output; health probe synthetic success/failure is covered by `node --test` and can be run against a staffed nonproduction preview.
- Contextual help includes the drill and explicit human-controlled rollback/replay decision gates. No new database migrations are necessary.

## How to reproduce safely

1. On an isolated local Postgres 17 instance, apply migrations and seed `icamp_ci` with the existing demo script. Only connect to local loopback. This command is intentionally **not** for the hosted Supabase project.
2. Set `ICAMP_APP_ENV=test`, `ICAMP_DRILL_ACK=ISOLATED_TEST_ONLY`, and `DATABASE_URL=postgresql://<local-test-user>@127.0.0.1:5432/icamp_ci` using a locally configured credential. Run `npm run build198:restore-drill` and `npm run build198:db-budget`.
3. In a nonproduction preview use `ICAMP_PROBE_BASE_URL=https://<authorized-preview-origin> npm run build198:http-budget` to collect dated latency JSON. The probe requests public health/readiness endpoints only. Attach its output to a controlled review rather than placing infrastructure details in public dashboards.
4. CI runs the test-only database drill after seeding; inspect the **exact SHA** GitHub workflow result for real passing evidence. A failure never falls back to a production restore.

## Measured versus unknown

| Signal | Source | Interpretation |
| --- | --- | --- |
| Synthetic restore elapsed | CI test instance | Observed time for a fixture under CI; **not** production RTO |
| Synthetic row/tenant/RLS parity | Test PostgreSQL 17 | Verified exact copied fixture and access isolation; does not demonstrate a provider backup |
| Query p95 | 20 isolated SQL samples | Enforces 250 ms test budget, not live production workload |
| HTTP health/readiness p95 | 20 samples per route | Enforces 500/750 ms budget on target origin; no guest checkout workload |
| Production backup freshness / recovery point | External backup provider | **Unknown pending independent backup-inventory proof** |
| Production restoration time / recovery time | Approved nonproduction copy of verified production backup | **Unknown pending approved drill** |
| Queue replay / database failover / production rollback | Operator change control | Deliberately **not automated** by Build 198 |

## Incident, rollback and safe queue review

1. **Incident ID and severity:** Log the start time, scope, current deployment SHA, health/readiness and existing queue conditions; redact private guest and infrastructure information from public reports.
2. **Containment:** Stop risky write/replay attempts. Never send queued messages, submit payments, issue gate commands or resume HELD providers as a side effect of a health check.
3. **Diagnosis:** Cross-check Vercel runtime errors, database connectivity and Supabase service status independently. A public health 200 is not a database read test.
4. **Recovery selection:** For app regression, review the Vercel production deployment SHA, data/schema compatibility and rollback reversibility before an explicitly approved release rollback. For data loss, use a separately authenticated **verified** provider backup and a separately authorized isolated restore to check tenant/consent/booking integrity before planning production recovery. The CI fixture must not be used to repair production.
5. **Queue replay:** Inspect original idempotency keys, consent/permission state, failed job payload under a protected reviewer role, external side effects and terminal failure reason. Require a second authorized operator to approve any replay in existing job machinery; this page exposes counts only and never performs replay.
6. **Verification and closure:** Retest multiple campground boundaries, guest privacy exports, booking holds, subscriptions HELD state, communication consent, and exact `main` version and health. Record independent approval, observed outage duration and follow-up exceptions.

**Safety/acceptance:** No production backup was restored, no hosted database was modified by this drill, no automatic erasure, provider activation, bill, message or privileged queue replay was performed. CI GREEN means the test fixture and code shipped, **not** actual production recovery readiness. Formal operational recovery targets require separate authentic backup-provider evidence and owner authorization.

**Next:** Build 199 — Tenant Subscription Sandbox Lifecycle & Legal Consent Gate. Billing activation remains HELD.
