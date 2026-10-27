# Build 135 — Independent Escalation Resolution Follow-Up, Reopening Recurrence Watch & Owner Evidence Renewal

## Continuity and source-of-truth controls

- Only a **source-verified** Build 134 `owner_escalation_resolved` receipt can start this chain. The record must retain the same ordered source/target campground pair and its independently linked Build 133 owner reopening and Build 130 follow-up proof.
- A new append-only chain proceeds through `independent_resolution_followup` → `reopening_recurrence_watch` → `owner_evidence_renewal`. The last step can renew pending owner evidence or reopen an independent review cycle. A different reviewer is required between consecutive records, and the original owner, monitoring and proof authors cannot attest their own evidence.
- Stable resolution, stable recurrence watch or renewed evidence **must cite a new source-verified Build 130 follow-up** for the *same reopening root*, strictly newer than the resolved source proof and any previously consumed renewal proof. Reusing old evidence does not count as renewal.
- Database-calculated counts cover newer owner reopenings, unresolved independent peer checks, owner disposition exceptions and recent owner escalations. These block a stable or renewed result. Thirty days overdue requires an explicit gap/escalation result, and each open follow-up schedules its next review within 90 days.
- Records use immutable triggers, forced RLS, append-only `SELECT`/`INSERT` for authorized owners of *both* campgrounds and no grants to public client roles. No changes to reservations, customer data, payments, operational holds or external messages.

## Rosevear Integration Contract v1 remains owner-held

- AI Data Platform remains the only proposed gateway. `GET /api/integration/v1/health` and `/capabilities` remain server-authenticated and tenant-scoped, with durable nonce receipts and default `HOLD` until owner/environment allowlisting.
- No signed event transfer, cross-application reads of customers, reservation commands, live SMS, provider dispatch or automatic owner approval in this build. The attached v1 handoff is a forward contract, not permission to enable data movement.

## Promotion requirements

- Migration `0165_independent_escalation_resolution_renewal.sql` and matching verification SQL, including hosted verification and zero client-role exposure.
- Full automated tests, lint, TypeScript, formatting, production build, browser acceptance, database migration replay and security advisor inspection.
- Feature PR to `dev`, promotion PR to `main`, both branch heads aligned and CI, CodeQL, Secret Scan GREEN. A GitHub Actions GREEN outcome is not proof of a separately deployed live public site.

## Next expected

Build 136 — Independent Renewal Evidence Freshness Comparison, Reopening Watch Exception Reassessment & Owner Continuity Decision Audit.
