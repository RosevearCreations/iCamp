# Build 128 — Owner Replay Evidence Gap Aging, Independent Recheck Exception Decisions & Closure Proof Continuity Audit

- Build 127 independent rechecks surface owner evidence replay gap pending, overdue, 30+ days overdue, escalation decision pending or closure proof acknowledgment pending states.
- A separately authorized campground-pair finance owner, distinct from the independent rechecker, records one immutable exception decision: continue timely unchanged evidence follow-up, submit gap evidence, renew an escalation exception or acknowledge independently verified closure proof.
- PostgreSQL freezes recheck days overdue, unresolved and overdue peer rechecks, recent independent escalations, previous 90-day owner escalation decisions, whether replay evidence was newer and whether the **full closure proof chain** is complete.
- The closure proof chain requires the original owner acknowledgment, corresponding independent closeout review, independent verified disposition and same-evidence closure recheck, plus original closure sign-off. Open peer rechecks or recent escalation decisions/rechecks prevent acknowledgment.
- Open gap outcomes require a future UTC follow-up within 90 days. Explicit escalation is mandatory for independent escalation rechecks, 30+ days overdue, overdue peers or repeated escalations. Passive continuation requires timely, unchanged evidence with no peer gaps.
- Owner decisions are append-only, pair-scoped and protected by forced PostgreSQL RLS and server-side actor identity. They never release holds, move transfers, issue refunds or update payments.
- Gates: `npm run verify`, database migration/verification `0158`, source and production GitHub CI/PostgreSQL/browser checks, CodeQL and Secret Scan.

Next expected: **Build 129 — Closure Proof Exception Follow-Up Aging, Owner Evidence Disposition Replay & Independent Continuity Confirmation**.
