# Build 124 — Owner Sign-Off Follow-Up Reassessment, Escalation Evidence Refresh & Independent Exception Closeout Review

- The ordered-campground-pair owner review workspace ages Build 123 owner sign-offs as pending, overdue, 30+ days overdue or awaiting independent closeout, with permanent history retained.
- A finance-authorized reviewer other than the owner signer and preceding independent auditor records a single immutable independent follow-up per sign-off: continued exception, refreshed escalation evidence request, manual escalation, or independent closeout confirmation.
- PostgreSQL freezes the selected sign-off's days overdue, other open and overdue owner sign-offs, 90-day manual escalation acceptances, and 90-day independent evidence refresh requests. Users cannot supply or override these figures.
- Open reviews require a future UTC due date within 90 days. Reviews overdue 30+ days and repeated escalation acceptances require manual escalation; previously requested evidence or escalations cannot be silently continued.
- Independent exception closeout requires both an earlier `independent_audit_closed` finding and its owner `acknowledge_independent_closure` sign-off, with zero peer open/overdue sign-offs, recent escalation acceptances or unresolved evidence-refresh requests. The closeout applies to audit evidence **only**, not a campground operational hold or case.
- Directed finance-owner authorization, forced RLS, immutable triggers, independent actor separation and no live payment, transfer, closure or customer-message side effects remain mandatory.
- Gates: `npm run verify`, PostgreSQL migration and verification `0154`, GitHub CI/database/browser checks, Secret Scan and CodeQL on both source and production PRs.

Next expected: **Build 125 — Independent Closeout Follow-Up Aging, Escalation Exception Renewal & Owner Evidence Outcome Audit**.
