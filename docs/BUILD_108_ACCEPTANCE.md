# Build 108 — Owner Export Exception Recurrence & Retention Oversight Reporting

## Delivery and evidence boundaries

Build 108 is read-only operational oversight over the already immutable Build 105–107 export/retention/case evidence. Migration `0139` only adds indexed pair/time lookups; it introduces no new table, privilege, view, mutation, outbound notification, file deletion, unit transfer, lending approval or applicant processing.

1. An actively assigned Owner / Administrator with `permanent_unit.transfer` access on **both** campgrounds can view a pair's exception reporting. The application revalidates ownership on each of the first 50 assigned campgrounds, then queries as `icamp_app` under the pre-existing forced dual-campground RLS policies. The whole authorized portfolio is allowed only for pairs where both camps remain authorized.
2. Select 30, 90 or 180 days using a database-timestamp anchored window. Optional directed source and target must be both selected and distinct, within the current scope; no arbitrary UUIDs are accepted.
3. Case-cohort totals are exhaustive for the chosen window and selected campgrounds, including newly opened, independently closed, overdue action, review-pending, returned, escalated, repeated receipt and repeated pair/issue counts. A recurrence means **two or more recorded cases**, not a risk score or prediction.
4. Retention gaps are the **current** latest reconciliation and retention status of receipts accepted during the selected window. Missing reconciliation, mismatch, missing retention and expired copy deadline are separately counted. Manual disposal attestations cannot prove that an outside file was destroyed.
5. Weekly activity includes new case, accepted review, returned review and escalation events actually recorded in each UTC week. Acceptance and escalation may belong to cases opened before the time window; the distinction is stated on screen.
6. Owner case drilldown is limited to the first 50 open records, overdue first, and pair/issue groups to 100. An extra sentinel row signals truncation. Full totals are computed independently of these caps; over 50 authorized campgrounds also warns of incomplete portfolio coverage.
7. Each case or grouping links to the existing Build 107 source-linked case and independent review workbench. The report makes **no changes** to export receipts, SHA-256 checks, retention evidence, follow-up, closeout or any client financial data.

## Acceptance and regression

- `node --test tests/build108-owner-export-oversight.test.mjs`: normalization, recurrence/status definitions, no forged source pair, cap notices, read-only SQL contract, and no personal or financial fields.
- `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.
- GitHub Database Migrations and legacy regression suites must pass with additive index migration `0139` and its SQL verifier. Confirm the hosted Supabase Build 105–107 audit tables remain RLS-forced with `icamp_app` read/append-only access, no update/delete grants, and security adviser has no findings.
- Promotion: feature → protected `dev` (green CI), then protected `main` (green PR and exact production SHA).

## Next expected build

**Build 109 — Owner Export Oversight Review Notes & Follow-Up Decision Ledger**.
