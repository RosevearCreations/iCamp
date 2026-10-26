# Build 121 — Independent Follow-Up Outcome Aging, Escalation Handoff & Owner Evidence Decision Reconciliation

- Private directed-campground-pair views now age Build 120 independent review outcomes as pending, overdue, overdue 30+ days or awaiting owner acknowledgment of a verified audit. Recorded evidence actions and accepted escalations remain visible alongside the source review.
- Another authorized owner (not the independent reviewer) records one immutable handoff/evidence decision for each review: accept escalation, request evidence, reconcile evidence independently requested, continue monitoring if timely, or acknowledge an independently confirmed audit.
- PostgreSQL snapshots how many days the selected independent review is overdue, the number of other outstanding overdue independent reviews in the pair, and owner escalation handoffs in the prior 90 days. Mandatory escalation applies at 30+ days overdue; overdue passive monitoring is blocked. Independent manual escalations must receive an explicit owner handoff.
- Completed evidence reconciliation and audit acknowledgment cannot schedule an open due date; active actions must schedule a future UTC follow-up within 90 days. Forced RLS, append-only records, independent reviewer/owner actor separation and directed pair authorization remain mandatory.
- No automatic operational case closure, hold release, transfers, payments, customer messages or public endpoints are introduced.
- Gates: `npm run verify`, PostgreSQL migration `0151` and SQL verification, protected GitHub feature/dev/main CI including browser tests, Secret Scan and CodeQL.

Next expected: **Build 122 — Owner Handoff Follow-Up Outcome Aging, Evidence Reassessment & Independent Escalation Closure Audit**.
