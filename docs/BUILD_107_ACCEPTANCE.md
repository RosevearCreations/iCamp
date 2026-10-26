# Build 107 — Owner Export Retention Exception Follow-Up & Audit Closeout

## Delivery boundary

Build 107 extends immutable Build 105 export acceptance and Build 106 hash reconciliation / manual copy retention evidence. It does not change historical receipts, initiate contact, approve financing, release holds, execute transfers or delete locally downloaded files.

### Owner workflow

1. An active Owner / Administrator with `permanent_unit.transfer` permission on both source and target campgrounds selects a specific export receipt.
2. Open an append-only exception only if its currently recorded state has missing reconciliation, latest digest/count mismatch, missing retention, or overdue manual retention. New cases reference the original receipt and snapshot the current supporting reconciliation/retention IDs. A receipt cannot have two simultaneously unresolved cases.
3. Record owner follow-up or escalation with a future action date within 90 days, keeping internal evidence references and notes without guest or financial identifiers.
4. Correct the source condition through the Build 106 workbench. Record `review_ready` only when the database confirms the appropriate matching reconciliation or current retention/disposal attestation. A review-ready outcome has no remaining due date.
5. A different authorized owner who neither opened the case nor authored the review-ready outcome independently assesses the evidence and either accepts audit closeout or returns it for further follow-up.
6. Accepted closeout rechecks the exact cited source IDs and effective retention deadline under an export-scoped advisory lock, preventing a stale acceptance after retention evidence changes or expires. Rejection remains append-only and permits another corrected outcome.

### Test and security gates

- `node --test tests/build107-owner-export-exceptions.test.mjs` verifies state classification, input boundaries and audit contracts.
- CI applies migration `0138_owner_export_exception_followup_closeout.sql`, then executes the associated SQL verification and historical database lifecycle suites.
- All three private audit ledgers have forced RLS, dual-campground owner-only `SELECT`/`INSERT`, immutable update/delete rejection and guard-enforced source linkage and reviewer independence.
- Host security adviser is checked after migration. Application lint, typecheck, tests, browser parity and production build must remain GREEN.
- Verify a mismatch cannot be closed by a note alone; a retention deadline that expires before review prevents acceptance; a second concurrent case is rejected; returned review may be followed by a fresh outcome; accepted cases cannot receive more outcomes.

## Next expected build

**Build 108 — Owner Export Exception Recurrence & Retention Oversight Reporting**.
