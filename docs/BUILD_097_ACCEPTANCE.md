# iCamp Build 097 — Finance Delivery Evidence Reconciliation & Operator Closure Review

## Scope

The restricted campground operator console creates immutable snapshots linking the Build 095 consent and versioned SHA-256 disclosure to the Build 096 manual delivery receipt, separately recorded applicant response and latest exception event. The system checks and records whether required internal evidence references appear complete. A distinct authorized reviewer may return the case for rework or close **internal evidence reconciliation** only if a receipt-confirmed response is present, no hold is active or changed since the snapshot, the sale is still open, the campground is active, and there is no prior internal closure.

No automation sends terms, records signatures, approves credit, establishes compliant legal service, pays funds or changes unit ownership. Completeness means the available staff-entered evidence links appear internally consistent, not that the evidence is legally sufficient or the person actually accepted financing.

## Acceptance checks

1. Run `npm run verify` and confirm `tests/build097-reconciliation.test.mjs`, TypeScript, lint and Next production build pass.
2. Rehearse migration `0129` against a rollback transaction, then apply it to the iCamp Supabase project. Run the SQL verifier and Supabase Security Advisor.
3. On synthetic Camp Rosevear data, reconcile a case with no response, a disputed response, a held case, and an acknowledged case. Only the last may be classified complete if every linked source matches.
4. Verify malformed disclosure SHA, cross-campground receipt, mismatched acknowledgement, stale exception ID, premature closure, duplicate closure, direct anon access, same-operator closure and update/delete attempts are denied.
5. Confirm accepted changes land on `dev` and `main`, each required CI check is green, and the final `main` SHA is verified independently.

## Staff-facing path

Management → Campgrounds → Permanent units → Financing → Delivery receipts → Evidence reconciliation.

All testing must use synthetic data; do not insert real applicant finances, identification documents or contracts into the evidence pointers.
