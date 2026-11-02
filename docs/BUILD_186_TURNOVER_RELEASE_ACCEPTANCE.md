# Build 186 — Housekeeping/Maintenance Turnover & Availability Release Controls

## Staff workflow

- `/workspaces/maintenance/turnover-release` combines canonical rental-cottage turnover and campsite departure cleanup for one authorized campground. A staff member can filter the combined queue by ready, blocked, cleared, kind and site/issue, then follow the source inspection/maintenance link.
- Each row explains why it is blocked: missing approved inspection template/program, incomplete housekeeping/linen/inventory checklist, unresolved damage or security flags, missing signed inspection, open corrective work orders or any unresolved accommodation-scoped maintenance work order.
- A ready operator with matching campground permissions may acknowledge the evidence and invoke the **existing** cottage release or campsite cleanup clearance action. There is no new inventory-state, checkout, override, inspection or work-order authority. The source action enforces fresh row-version, permission, sign-off and maintenance checks in its own transaction and records the original audit event and release actor/time.
- Releasing from `inspection` may restore the authoritative accommodation status to `available`. `maintenance`, `winterized`, `closed` and other protected states remain unchanged, even when a turnover record is cleared. Nonblocking campsite programs retain their checkout-time policy snapshot. All final availability reads remain canonical Build 030 reads.
- Each source caps the latest displayed rows at 250. Reaching the cap is explicitly flagged; visible counts are not claimed as complete. Missing read permission hides that source's rows and counts rather than representing them as zero.

## Safety, concurrency and database schema

- `0196_build186_turnover_maintenance_release_guard.sql` adds an indexed database-level guard: status cannot transition to `available` while accommodation-linked work orders remain unresolved. This applies even to direct status edits outside the turnover UI.
- The work-order insert/reopen path locks the referenced accommodation row. Both canonical clearance paths lock that same accommodation and recheck live work-order states, serializing release with new work. A newly created work order **after** a successful release is a separate maintenance event, not silently treated as an old cleared issue.
- Original cottage and campsite guards still require explicit final inspection sign-off and unresolved-corrective-work closure, with optimistic `row_version` enforcement. Duplicate releases are idempotent and stale attempts cannot silently overwrite a newer release.
- Existing `icamp_app` forced RLS and campground-specific permission checks remain in place. No new table contains guest information. Audit events remain in the pre-existing append-only audit stream.

## Channel and activation boundaries

- **Staff Web/PWA:** implemented. Use the existing authenticated responsive app; native HTML GET filters, labelled fields, visible blockers and keyboard-focusable actions. The new page requires a live database; disconnected mode shows an explicit non-mutating error.
- **Offline worklist:** existing Build 076 field queue can still record draft work, but Build 186 does **not** permit offline sign-off or availability release. Reconnect and use canonical server actions.
- **IVR/DTMF, SMS/MMS, external billing and dispatch:** **HELD / DISCONNECTED**. No calls, messages, charge, remote gateway operation or gate action are activated by this build.
- **Deployment:** this repository's `main` branch is the release source. Production runtime availability must be independently verified from the actual configured hosting project and health/version endpoints; green GitHub CI alone is not proof of a live provider deployment.

## Verification / acceptance

1. Unit checks: `tests/build186-turnover-release.test.mjs` covers readiness, protected/nonblocking release effects, filtering and canonical action wiring. Full `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`, and `npm run parity:verify` remain required.
2. Database CI: apply all migrations to PostgreSQL 17; `database/verify/0196_build186_turnover_maintenance_release_guard.sql` checks both new guards and index. Run DB lifecycle and demo seed checks from the repository CI matrix.
3. Live DB operator acceptance: with two authorized staff members, create simultaneous work-order/release attempts; ensure one winning serialized order, no availability release with pre-existing open work, and precise audit actor/time. Check stale row version, unauthorized campground and protected-state release denials.
4. Remote release: verify dev CI, CodeQL and secrets checks, merge into main only after gates pass; then verify main CI and deployment/version/health if connected and available.

## Next build

**Build 187 — Canonical Security Incident Cases & Independent Closure Evidence** (Billing / Omnichannel still HELD).
