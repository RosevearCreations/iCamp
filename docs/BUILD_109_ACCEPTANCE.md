# Build 109 — Owner Export Oversight Review Notes & Follow-Up Decision Ledger

## Acceptance gates

- The Build 108 owner-only recurrence report links each authorized directed campground pair to the Build 109 review and decision workbench.
- A review note captures 30-, 90-, or 180-day UTC cases by issue kind. Counts of opened, not independently closed and repeated receipt cases are calculated **at insertion time by the database**, not trusted from form input or recomputed in later UI reads. Timestamp, actor and snapshot are immutable.
- An active owner/admin with `permanent_unit.transfer` authority on **both** selected campgrounds can append and read records. A direct URL or forged form for another campground, and any anonymous/authenticated/service client, cannot use these tables. Both tables use forced RLS and have update/delete disallowed and blocked by triggers.
- A decision is linked to an existing exact directed-pair review. `monitor`, `followup` and `escalate` require a future UTC due date within 90 days. Escalation must cite a real Build 107 case inside the immutable review's reporting period, pair and issue category. `closed_no_action` has no due date and prevents later decisions on that review; a database advisory lock serializes competing inserts.
- Narrative and evidence reference length/privacy validation is enforced before database submission. The interface shows immutable history and due-date status with explicit 50-review, 150-decision, 100-case coverage warnings.
- No original export receipt, retention attestation, exception outcome or independent closeout is modified. No applicant identity, banking, lending, unit transfer, automatic messaging, scheduled task or downloaded-file deletion is performed.

## Verification

1. Run `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test` and `npm run build`.
2. Deploy migration `0140_owner_export_oversight_review_decision_ledger.sql` and execute `database/verify/0140_owner_export_oversight_review_decision_ledger.sql` on linked iCamp Postgres. Inspect forced RLS, table privilege and trigger checks; review Supabase security advisors.
3. On the owner-only pages, compare a frozen observation to the original 108 counts at the same point in time; test a follow-up and a case-linked manual escalation. Confirm wrong pair/case, terminal no-action replay, overdue/too-distant due date and unauthorized campground scope are rejected.
4. Promote feature branch → `dev` → protected `main` after green exact-commit checks and confirm production `main` remains green.

Next expected: **Build 110 — Owner Export Follow-Up Aging & Decision Reassessment Audit**, surfacing age, due-date review and a separate evidence-backed reassessment of unresolved Build 109 decisions without changing the original records.
