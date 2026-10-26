# Build 120 — Owner Closure Decision Recurrence, Overdue Escalation & Independent Follow-Up Review

- Private ordered-campground-pair owner decision history now shows pending independent review, overdue follow-up and 30+ day escalation indicators. Acknowledged independent audit closures await a separate confirmation.
- An independently authorized owner records a single immutable follow-up review per Build 119 owner closure decision. The reviewer cannot be its owner decision-maker or original independent closure rechecker.
- PostgreSQL freezes pair-wide 90-day recurring decisions, unreviewed overdue decisions, prior manual escalations, and the owner decision's overdue age with each independent review. It enforces manual escalation for owner decisions 30+ days overdue and disallows a passive continuation after an overdue owner follow-up.
- Only independently acknowledged audits with no captured recurring or overdue decisions can be confirmed. Other review outcomes require a UTC follow-up within 90 days. Directed pair authorization, forced RLS, append-only history and no public endpoints remain enforced.
- Records are audit-only. No automatic release of holds, operational closure, payments, transfers, outbound messages, or case modifications.
- Gates: `npm run verify`, migration and verification `0150`, full GitHub CI/database/browser workflows, Secret Scan and CodeQL on feature and promotion PRs.

Next expected: **Build 121 — Independent Follow-Up Outcome Aging, Escalation Handoff & Owner Evidence Decision Reconciliation**.
