# Build 125 — Independent Closeout Follow-Up Aging, Escalation Exception Renewal & Owner Evidence Outcome Audit

- Independent closeout follow-ups from Build 124 now surface pending, overdue, 30+ day overdue, escalation renewal pending and awaiting owner closeout acknowledgment states in the private ordered-campground-pair finance-owner ledger.
- A separately authorized owner, distinct from the preceding independent closeout reviewer, records one immutable outcome: continued timely follow-up, refreshed evidence submitted for reassessment, renewed escalation exception, or acknowledgment of independently verified closeout.
- PostgreSQL freezes the selected independent review's overdue days and pair-wide peer open/overdue independent reviews, prior 90-day manual escalations, and prior 90-day owner exception renewals. These evidence counts are database-derived, never caller-controlled.
- Open owner outcomes require a future UTC due date within 90 days. An independent manual escalation, a 30+ day overdue review, or multiple prior peer escalations/renewals require explicit renewal rather than passive continuation. Evidence refresh requests cannot be silently ignored.
- Closed-audit acknowledgment requires a prior independent exception closeout and corresponding owner acknowledgment of the earlier audit, with zero current peer open/overdue reviews or recent peer escalations/renewals. This **does not close live holds, transfer records or payments**.
- Directed pair owner authorization, immutable triggers, independent actor separation and forced RLS remain mandatory. The owner audit is strictly an append-only evidence ledger.
- Gates: `npm run verify`, PostgreSQL migration and verification `0155`, GitHub CI/database/browser checks, Secret Scan and CodeQL on source and production PRs.

Next expected: **Build 126 — Owner Evidence Renewal Follow-Up Aging, Independent Escalation Disposition & Audit Closure Continuity**.
