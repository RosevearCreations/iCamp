# iCamp Build 099 — Owner Follow-Up Task Continuity, Reassessment & Escalation Closure Evidence

## Owner desk

From the Build 098 ageing page, open the restricted Build 099 follow-up desk. A separate operator creates one task only for an escalation the assigned campground Owner / Administrator already accepted. The owner logs progress as `action_taken`, `pending_dependency` or `blocked`; a distinct reviewer pins a specific evidence record and records whether follow-up remains open or administrative closure can be considered. A separate active campground owner performs the final administrative disposition against the most recent reassessment. Rejected or stale operations remain unchanged.

All four ledgers are immutable, campground-scoped, FORCE RLS, and inaccessible through Supabase's public Data API. Only restricted evidence references and notes are stored. No real applicant sample data, automatic applicant notification, financing approval, legal signature, contract acceptance, payment, ownership transfer or exception hold release exists in this build. Completion here is **administrative follow-up only**.

## Verification gate

1. Run `npm run verify`, including Build 099 normalization/security tests and the production Next.js build.
2. Rehearse `0131_finance_owner_followup_continuity.sql` inside a rollback transaction; apply to linked Supabase, then run `database/verify/0131_finance_owner_followup_continuity.sql` and Security Advisor.
3. Validate synthetic Camp Rosevear flow: accepted owner response → independently assigned task → owner-only evidence → separate independent reassessment → latest-reassessment closure by a different active owner.
4. Reject nonexistent/mismatched escalation-response, unaccepted response, same-user assignment/evidence/reassessment/closure, future/late due dates, blocked-evidence completion recommendation, stale reassessment, duplicate or post-closure writes.
5. Promote feature into `dev`, then `main`, after all checks on each commit succeed. Independently verify the GitHub `main` head and its final checks. Live public web hosting is a separate deployment check.
