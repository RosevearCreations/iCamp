# Build 127 — Independent Escalation Disposition Follow-Up Aging, Owner Renewal Evidence Replay & Closure Continuity Recheck

- Build 126 independent dispositions are categorized as pending, overdue, 30+ days overdue, awaiting renewed owner evidence replay, awaiting escalation recheck or awaiting closure continuity reconfirmation.
- A separately authorized, independent reviewer creates one immutable recheck for a prior disposition. This reviewer must differ from the previous independent reviewer and the recorded owner(s) of the source and replay evidence.
- Every recheck identifies its disposition, the source-linked owner outcome being replayed, an evidence receipt reference and a written rationale. A different replay outcome must be newer than the source and be a recorded refreshed-evidence submission or renewed escalation exception for the same directed campground pair.
- PostgreSQL freezes whether replay evidence was newer, independent disposition days overdue, unresolved/overdue peer dispositions, 90-day independent escalation rechecks and 90-day owner renewals. No caller can override the frozen snapshots.
- Open rechecks require a future UTC due date within 90 days. Previously escalated, 30+ day overdue, peer-overdue, repeatedly escalated or newly renewed owner evidence demands explicit escalation. Passive monitoring requires the same evidence, a timely monitoring disposition and no pending peers.
- Verified closure can only be reconfirmed against the original acknowledged owner outcome, after both previous review stages verified it, with no peer unresolved/overdue disposition or recent owner/independent escalation renewal. The immutable recheck **does not change operational holds, transfers or payments**.
- Ordered-pair finance-owner permission, forced RLS, independent actor separation, append-only triggers and a private, source-linked UI are mandatory.
- Gates: `npm run verify`, PostgreSQL migration and verification `0157`, source and production GitHub CI/database/browser checks, CodeQL and Secret Scan.

Next expected: **Build 128 — Owner Replay Evidence Gap Aging, Independent Recheck Exception Decisions & Closure Proof Continuity Audit**.
