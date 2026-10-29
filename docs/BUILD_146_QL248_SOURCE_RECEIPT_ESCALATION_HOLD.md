# iCamp Build 146 — QL-248 original source receipt and independent HOLD recheck

**Scope:** Immutable, owner-scoped **documentary** follow-up to Build 145's two-SHA public provenance recheck, seven-denial source receipt gap aging, and independent authorization HOLD renewal. Build 146 does not claim that any absent source receipt, signed proof, public key pin, source CI run, or owner approval has been obtained.

## Review contract

1. Starting point must be an existing Build 145 `independent_authorization_hold_renewal`, itself linked to the original QL-248 seven-denial source gap and scoped to the same two campgrounds and one of the six exact GitHub repositories.
2. **Original source receipt escalation follow-up** records either missing original receipts (no synthetic IDs), seven distinctly indexed but **unverified** originals with an independent source audit reference, or a specific mismatch escalated with an actual original receipt index.
3. **Independent authorization HOLD exception reassessment** alternates after the source receipt follow-up; its reviewer must be different from the preceding author and from the Build 145 HOLD author. It may record lack of owner authorization, an **unverified** owner reference, or an exception escalation.
4. Source and evidence references are nonsecret `np-` index identifiers only; all seven denial names must be unique. Original IDs, private tokens, credentials, customer data and raw key material never belong in this ledger.
5. The database independently records `observed_prior_gap_count`, `observed_current_gap_count`, gap age in days, preceding due-date overrun, open Build 145 exceptions, and overdue Build 145 leaf reviews. Recheck due dates must remain within 90 days.
6. PostgreSQL append-only triggers, owner-permission checks for both campgrounds, forced RLS, same-root constraints, distinct independent reviewer checks, and a transaction advisory lock prevent editing, cross-tenant substitution and replay of a review chain.

## Authorization and production boundary

Every row is explicitly and immutably `DISCONNECTED / HOLD`: `original_source_receipts_verified`, `seven_denials_independently_witnessed`, `public_proof_origin_verified`, `owner_authorization_verified`, `phase_b_test_authorized`, `owner_pilot_authorized`, and `dispatch_enabled` are **false**. No live external gateway test, authenticated Phase B GET, owner pilot, dispatch, real call/message, credentials, or release exception is triggered by this build.

The release to the iCamp `main` branch is a **software CI promotion**, not an external six-app integration-gateway approval. Vercel hosting requires a separate project deployment with server-side environment configuration; it must not be described as deployed or healthy until a real production deployment is verified.

## Verification

- `npm run verify` — formatting, linting, TypeScript, unit contract tests and Next.js build.
- `database/migrations/0176_ql248_source_receipt_escalation_hold_reassessment.sql` and `database/verify/0176_ql248_source_receipt_escalation_hold_reassessment.sql` — PostgreSQL owner-only receipt and HOLD review ledger.
- `tests/build146-ql248-original-source-receipt-hold.test.mjs` — missing evidence safety, distinct original IDs, owner authorization invariants, stage aging, and UI/SQL gates.

**Next queued:** Build 147 — QL-248 original source audit continuity, seven-denial exception-aging renewal and independent authorization HOLD review.
