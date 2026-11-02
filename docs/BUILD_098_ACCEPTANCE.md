# iCamp Build 098 — Finance Delivery Exception Ageing, Re-Review & Owner Escalation

## Operator scope

The private campground financing desk displays an age band for unresolved evidence based on existing immutable events: under 24 hours, 24–72 hours and at least 72 hours. These attention bands are not a legal deadline or an automated reminder. An independent staff member records re-review, a restricted evidence source, a bounded future review time and whether owner escalation or manual hold-clearance assessment is recommended. Re-review does not itself modify a Build 096 hold.

An escalation requires a current re-review explicitly requesting owner attention. A separate staff member selects an active Owner / Administrator assigned to the same campground, sets a source-linked request and future due time, and records the handoff in the private audit ledger. The identified owner can independently acknowledge or return the task. Nothing is transmitted automatically, and neither response constitutes financing approval, contract delivery, applicant acceptance, legal disclosure validation or release of a safety/finance hold.

## Acceptance

1. Run `npm run verify`, including `tests/build098-exception-ageing.test.mjs`, all lint/type checks and Next production build.
2. Rehearse migration `0130_finance_delivery_exception_ageing.sql` inside a rollback transaction, then apply to hosted iCamp Supabase. Execute SQL verifier and check the security advisor.
3. In synthetic Camp Rosevear fixtures verify UTC age thresholds, missing/stale exception IDs, same-operator consecutive review, invalid next-review timing, duplicate outstanding escalation and mismatch of owner acknowledgement identity are rejected.
4. Confirm only active assigned owner-admin users are selectable; no real customer contact or financial documents are used as test data.
5. Require all GitHub CI checks GREEN on feature, `dev` and final `main` commit; verify branch head directly.

The final GREEN declaration refers to GitHub production source and live Supabase migration. Public hosted website deployment must be checked separately.
