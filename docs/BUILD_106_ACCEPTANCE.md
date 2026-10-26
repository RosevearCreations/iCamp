# Build 106 — Owner Export Receipt Reconciliation & Evidence Retention Controls

## Acceptance scope

- Owners with active `owner_admin` and `permanent_unit.transfer` authorization on both selected campgrounds can view the last 30 Build 105 export receipts; limited receipt and history views identify truncation explicitly.
- The original export-accepting owner cannot independently reconcile their own receipt. A separate authorized owner enters a locally observed CSV SHA-256 hash and data-row count. Both matching and mismatching observations are append-only, with the outcome calculated from the original immutable accepted receipt, not trusted from submitted form data.
- A matched receipt permits an initial controlled-storage attestation with a future UTC deadline of no more than 180 days, a subsequent extension, and then a terminal manual copy-disposal attestation. All actions require owner references and notes. The UI marks overdue retention; it never deletes, uploads, or accesses a downloaded file.
- An attested disposal does not assert that iCamp verified local deletion; it does not remove the source export acceptance, reconciliation or retention audit entries. These are append-only with forced owner-scoped RLS and database guards for order, independence, concurrence, and dual campground authorization.
- Nothing in this feature approves financing, discloses borrower information, releases holds, moves property, sends messages, or launches background automation.

## Operational verification

1. `node --test tests/build106-owner-export-retention.test.mjs` passes validation, lifecycle and permission-source checks.
2. `npm run verify` passes standard repository checks; CI runs database migration / verification and browser acceptance in a clean install.
3. Migration `0137_owner_export_reconciliation_retention.sql` applies after `0136`; run `database/verify/0137_owner_export_reconciliation_retention.sql` and inspect security advisors for access findings.
4. A user with only one campground assignment is denied both pair read and write. Unauthenticated/public roles have no table access. Attempts to update/delete entries, reconcile one's own receipt, enter a false matching result, retain before matching, dispose before initial storage or extend after disposal are blocked at SQL level.
5. A second active owner independently measures the exact downloaded Build 105 CSV, records a match, stores an explicit copy deadline, then performs extension and terminal manual copy-disposal attestations. Confirm original receipt/hash and all prior entries remain unchanged.

## Release evidence

Production GREEN requires the Build 106 feature checks on `dev`, promotion checks on `main`, the Supabase migration/verification and final `main` checks to pass. No production state should be claimed before these finish.

Next expected: **Build 107 — Owner Export Retention Exception Follow-Up & Audit Closeout**.
