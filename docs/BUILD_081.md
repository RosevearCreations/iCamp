# Build 081 — Garbage Collection Routes, Pickup Proof & Receipt Reconciliation

## Delivered

- Campground-scoped, dated waste-stream route manifests with safe UUID retry behavior and staff attribution.
- Append-only field collection proofs (collected, inaccessible, not ready, missed), bag counts, notes and optional references to pre-existing media/evidence.
- Database-enforced route/pickup stream consistency, prohibition of cancelled pickup attestations, collected-only-in-progress/completed rule, and one successful collection per canonical pickup across all routes.
- Separate append-only paid tag receipt review decisions: **receipt matched**, **needs follow-up**, **disputed**; verified amount must match the original tag price and a review snapshots its immutable receipt reference.
- Maintenance → Garbage → Collection & reconciliation workflow, visible based on distinct field/finance permissions, accessible form controls, contextual information-circle help, and links from the service/tag views.
- Scoped RLS, no public Data API grants, narrow append-only inserts, composite campground foreign keys, uniqueness and supporting indexes.
- Repository tests, SQL migration/verification and release gates.

## Boundaries

- The canonical pickup state is still controlled through Build 079's dispatch state machine. Collection proof cannot silently mark it completed, generate a work order or release billing.
- Finance review records staff attestation against an independently verified external receipt. It does **not** create or settle an actual provider transaction, revenue posting, tax invoice or refund.
- The evidence reference is a pointer to an existing media/source record, not a new upload or photographic validation step.
- A route manifest is not yet GPS optimized, automatically scheduled or a driver's turn-by-turn navigation.

## Future integration

Provider-backed POS reconciliation, attachment ingestion/validation, driver-friendly route sequencing, and discrepancy reporting should be planned as separate builds rather than implied complete by this review ledger.
