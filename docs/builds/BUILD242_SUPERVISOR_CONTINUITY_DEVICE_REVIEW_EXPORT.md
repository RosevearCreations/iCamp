# iCamp 242 — Supervisor Case Continuity, Field Review & Private Source Export

## Delivered in source code

- Append-only RLS-isolated supervisor review events for **case follow-up** and **field-device worker reports**; a supervisor must first own a case and may never review their own worker-origin device observation.
- Source-linked previous review ID prevents stale case review overwrites. A new ownership claim or worker report makes an older review visibly historical.
- Accessible supervisor forms and current-versus-historical review guidance in the fulfillment priority view.
- Authenticated, campground-scoped JSON export with SHA-256 download digest and exact deployed source revision when available. The export omits guest records, worker identities and free-text notes. It is **not** a signed source-health receipt, Master Shell feed or independent device acceptance.
- Migration 0226 and independent verify script. Until the live database migration is adopted, source controls fail closed.

## Non-negotiable boundary

`ai-data-platform` is the suite monitoring master. It must **never** consume the campground-private export URL using a master identity or treat its SHA-256 download digest as a genuine Ed25519 source receipt. The prior `MASTER363-ICAMP-SOURCE-CONVERGE` remains source signer **HOLD** until independently enrolled and validated. No guest/tenant database access was granted to Master.

## Verification

Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run build`, the repository migration CI gate and Vercel production exact-revision checks. Live database migration adoption and independent worker-device testing require separately observed proof.

## Next proposed build

**iCamp 243 — Supervisor Recovery Trend Analytics, Cross-Shift Handoff Accountability & Authorized Source Review Exports.**
