# iCamp 244 — Supervisor Recovery Workload, Field Closure Source Evidence, Owner-Gated Shift Reporting

## Scope

- An eight-hour **planning estimate** from seven UTC dates of observed escalations, device blockers and handoff requests, with explicit current backlog, pending handoffs and coverage warnings. No autonomous staffing or service-level guarantee.
- Append-only, RLS-protected field closure/recheck events linked to the current worker device report and current supervisor review, rejecting stale source versions, cross-campground writes, self-review by the worker, and missing supervisor authorization. A closure review **never asserts independent field device acceptance**; owners can still require original-device validation.
- Private per-campground shift performance JSON, independently gated by active `owner_admin` role plus `staff.manage` and `reservation.modify`. Returns aggregates only, never guest records, raw worker IDs, note text, private signing keys or platform-shell communications.
- Migration `0228_build244_field_closure_evidence.sql` and verifier. Until source production migration is confirmed, the closure UI remains on HOLD and the owner export may report source unavailable.

## Master 368/369 convergence

The checked-in public manifest was refreshed from stale Build 241 SHA `e2d343595363ca9106e7f1dbc60006e3a6c616aa` to **last independently observed live Build 243** `1f29c23f5fba7c2326e09873ebff42223622044b`. Its build-time Vercel manifest script replaces this baseline with the **exact Git commit SHA of the deployed Build 244**. The checked-in baseline cannot be identical to its own Git commit (the revision would recursively change the commit); the deployed artifact and independent Git/Vercel evidence are authoritative.

No independent Ed25519 iCamp source signer is enrolled. A source-bound signed HEALTHY receipt, independently pinned signer custody, durable replay and owner-accepted connection therefore remain **HOLD**. No legacy archive signer is repurposed. AI Data Platform Build 368/369 needs independently obtained public signer pin, custodian assignment, authentic runtime-signed receipt for the final Build 244 revision and replay ledger evidence; private campground report URLs are not part of this handoff.

## Acceptance

`npm run verify` plus GitHub's migration and browser checks on `dev` and `main`, followed by exact production SHA and authenticated/unauthenticated access verification where possible. No simulation or CI apply implies that production database migration or an actual worker device was independently accepted.

Build 244 also pins the database runner to Ubuntu 24.04 and checks its preinstalled `psql`, and installs version-locked Chromium without an external apt mirror. Both database and browser acceptance jobs remain mandatory: this removes the unavailable Ubuntu security mirror as a test setup dependency, not the tests themselves.
