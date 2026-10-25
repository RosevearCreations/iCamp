# iCamp Build 101 — Cross-Campground Finance Portfolio Owner View & Risk-Neutral Trend Reports

## Delivery

The owner-only `/workspaces/management/campgrounds/permanent-units/financing/owner-portfolio` screen aggregates operational evidence counts from Builds 095–100 without revealing applicant records. Eligibility is computed from live campground assignments: active `owner_admin` plus `permanent_unit.transfer` authorization on each property and matching organization ID. Every queried campground is re-authorized and accessed within a read-only `icamp_app` role transaction; no broad cross-tenant SELECT or privileged bypass is introduced. A 50-campground safety cap displays a partial-coverage warning when reached.

Owner filters include reporting window (7, 30, 90 days) and authorized organization. The activity window counts new recorded consent, exception hold/clear, follow-up task open/administrative close, and recurrence-review events. Separately, point-in-time totals show active holds (last hold/clear event), open tasks (no Build 099 closure), overdue tasks, and consents with repeated same-reason hold events. The weekly report covers the most recent 12 UTC weeks and includes a partial current week. These are operational volumes, not credit scores, inferred borrower risk, legal deadlines, applicant compliance decisions or financial performance.

## Acceptance

1. `npm run verify` succeeds: formatting, lint, TypeScript, unit tests and optimized Next production build.
2. Confirm on hosted Supabase that existing finance tables are present and Security Advisor has no findings. No migration or data mutation is required in Build 101; no new Data API grants, policies or public endpoints are created.
3. Tests exercise owner assignment filtering, date-window validation, weekly count aggregation, current hold/owner-task separation and static source guardrails that prohibit applicant detail fields in report SQL.
4. Verify feature CI, merged `dev` and final `main` checks all GREEN; confirm actual `main` HEAD commit directly. Public website publication remains an independent deployment verification.
