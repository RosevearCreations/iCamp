# iCamp Build 100 — Finance Follow-Up Portfolio Monitoring & Exception Recurrence Review

## Private portfolio scope

Authorized campground operators access `/workspaces/management/campgrounds/permanent-units/financing/portfolio` from the Build 099 desk. It shows consent-scoped active holds from the *latest* Build 096 event, open and overdue owner follow-up tasks from Build 099, closed *administrative* tasks, and recurring exception reasons derived from at least two recorded hold events with the same reason for a single consent. All counts arise from immutable evidence, not credit scoring or legal deadlines. The view loads the most recent 500 consents per campground and indicates when it is truncated; up to 40 matching cases are rendered per screen.

One immutable private recurrence review may document continued monitoring, recommend manual owner review or note a pattern for follow-up. The database pins the current latest event ID and exact per-reason hold and consent escalation counts, rejects stale/mismatched counts, a non-recurrent pattern, consecutive same-operator reviews, and timestamps outside a 90-day window. The ledger is `FORCE RLS`, inaccessible to anon/auth/service role and append-only for `icamp_app`. It never performs external notification, finance underwriting, applicant acceptance, contract signature, ownership transfer or exception hold release.

## Verification

1. `npm run verify`: formatting, lint, TypeScript, complete automated tests including Build 100, and optimized Next.js build.
2. Rehearse migration `0132_finance_portfolio_recurrence.sql` in a rollback transaction against iCamp Supabase, apply, run verifier `database/verify/0132_finance_portfolio_recurrence.sql` and Security Advisor. Use no real borrower records.
3. Test synthetic recurrence counts/decision whitelists, current-event lineage, private RLS and independent review guarding. Confirm separate task closure does not release holds.
4. Check feature, `dev` and merged `main` CI until every required check succeeds, then confirm branch head directly. Public website hosting, if separately configured, needs independent verification.
