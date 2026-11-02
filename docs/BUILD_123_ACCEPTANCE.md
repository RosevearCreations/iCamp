# Build 123 — Independent Closure Audit Reassessment Aging, Owner Exception Sign-Off & Escalation Recurrence Oversight

- The existing private ordered-campground-pair recurrence ledger now ages **Build 122 independent audit reassessment deadlines**, marking pending, overdue, 30+ days overdue and closed audits awaiting owner acknowledgment.
- An authorized owner who did **not** author the independent closure audit, earlier owner handoff or prior independent follow-up independently records one immutable sign-off per audit: continued exception (still open), evidence refresh request, manual escalation acceptance or independently closed audit acknowledgment.
- The database captures the selected audit's reassessment overdue days, peer open and overdue independent audits, and manual escalations over the previous 90 days. These are immutable server-side snapshots rather than user-editable counts.
- 30+ day overdue reassessments and two or more recent peer manual escalations require explicit escalation acceptance. A continued-exception sign-off may not passively accept an overdue audit; a manual-escalation finding also requires owner acceptance.
- Owner acknowledgment of independent closure is permitted only for a pre-closed audit with no remaining peer open/overdue audit or recent peer escalation. All open sign-offs schedule a future UTC reassessment within 90 days.
- Forced row-level security, directed two-campground finance owner authorization, append-only triggers, independent actor separation and audit-only semantics apply throughout. **No operational hold release, case closure, transfers, billing or customer messages** are possible here.
- Gates: `npm run verify`, PostgreSQL migration and verification `0153`, GitHub CI/database/browser tests, Secret Scan and CodeQL on both feature and production PRs.

Next expected: **Build 124 — Owner Sign-Off Follow-Up Reassessment, Escalation Evidence Refresh & Independent Exception Closeout Review**.
