# Build 110 — Owner Export Follow-Up Aging & Decision Reassessment Audit

## Expected owner outcomes

1. Build 109's directed-pair decision ledger links directly to a private aging workbench. Only an actively authorized Owner / Administrator with `permanent_unit.transfer` permission for **both** campgrounds may read it.
2. One latest Build 109 decision per original owner review is classified in full-history counts: overdue, due within 7 days, due within 30 days, later, historic final no-action, or reassessment closure recommendation. The original due date remains visible alongside a later effective reassessment due date. Lists are bounded at 100 decisions, 150 reassessments and 100 case candidates; warnings are explicit.
3. A different owner from the original decision-maker records an independent, append-only decision reassessment. They may recommend continued monitoring, request more evidence or recommend escalation, each with a next review within 90 days. Escalation must cite an unresolved Build 107 case in the pair and original review scope.
4. Reassessments are rejected when the cited Build 109 decision is not the latest for its review, including concurrent new decisions. The Build 110 guard uses Build 109's review-level advisory lock.
5. The database snapshots original-scope unclosed case counts and cases opened since the original review. It permits a closure **recommendation** only when all relevant cases are independently accepted and no new case was opened in the original issue scope. It never changes Build 107 case closure, Build 109 decision status or evidence.
6. The new ledger is immutable, has forced dual-campground RLS, grants only `SELECT,INSERT` to `icamp_app`, no public/anon/authenticated/service-role table grants, and no definer bypass. Manual evidence references and notes reject contact and financial identifiers.
7. No automatic notifications, assignments, file deletion, applicant/lending state transitions, financing approval or campground transfers are made.

## Verification

- `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` GREEN.
- Apply migration `0141_owner_export_followup_aging_reassessment.sql` to the linked iCamp Postgres database; execute matching SQL verification and confirm zero Supabase security-advisor findings.
- Test expired/current/extended due dates, independent owner restriction, cross-pair forgery, stale decision concurrency and rejection of unsupported case closure recommendations. Confirm original Build 109 rows never change.
- Promote the exact tested feature head to `dev`, then `dev` to protected `main`; verify required CI and final exact `main` production checks GREEN.

Next expected: **Build 111 — Owner Export Reassessment Follow-Up Outcomes & Independent Closure Acceptance**. This should add accountable owner follow-up outcomes from Build 110 reassessments, followed by a separately authorized final audit acceptance only after source evidence remains sound.
