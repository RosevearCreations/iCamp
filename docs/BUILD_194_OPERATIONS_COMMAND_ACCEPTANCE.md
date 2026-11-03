# iCamp Build 194 — Role-Aware Operations Dashboard, Saved Layouts & Actionable Drilldowns

## Scope

Extends the existing Standard Theme Operations Command, preserving `buildManagementSnapshot()` as the source of authorized reservation, capacity, finance-review and maintenance previews. Introduces a role-safe Management / I.T. / Status / Statistics workspace with responsive layout controls and no duplicate metric calculations.

## Delivered

- Personalized, **per-staff-user and per-campground** views in `icamp_private.management_command_views`. The preferences contain only names, module keys, filter/search selections, KPI order, display density and default flag. The system never saves bookings, guest details, financial metrics or reports in a view.
- Up to eight named views and up to eight accessible favorites per scope, with server-validated module allowlists, one default view, unique scoped names, monotonically increasing row versions and optimistic concurrency protection on update/delete.
- PostgreSQL RLS verifies the actor and active `reports.read` permission on **every** read and write; the private trigger guards cross-campground scopes and simultaneous view-limit creation. Guest/API roles receive no direct access.
- Active view recovery by scoped URL and default view. Invalid or other-user view IDs fall back to the authorized default; a reset link uses display defaults without deleting preferences.
- Keyboard-operable focus tabs, category/search controls, favorites and KPI reordering, compact/comfortable density, responsive cards and low-motion behaviour. Help explains the difference between a UI preference and an authoritative business decision.
- Live metric source and freshness inspector with role-safe links to canonical source pages; unavailable/restricted data is explicitly not zero. The original reservation preview cap (250 rows) is retained.
- Existing command modules extended with seasonal owner readiness, staffing, vendor work, inventory, property status and system health with explicit permission gates.

## Verification and safety

- `database/migrations/0208_build194_management_command_views.sql`, `database/verify/0208_build194_management_command_views.sql`.
- `scripts/verify-build194-command-views.mjs`: PostgreSQL 17 rollback-only synthetic proof of user/property/role RLS, actor spoof denial, optimistic version, default uniqueness, eight-view bound and invalid-card denial.
- `tests/build194-command-layouts.test.mjs`: normalization, permission-bound favorites, source fidelity. `e2e/build194-command-privacy.spec.mjs`: anonymous/saved-view route protection.
- Feature PR -> dev CI, PostgreSQL, browser, CodeQL and Secret Scan; connected Supabase additive migration and advisor comparison; exact-commit Vercel READY; production PR -> main; synchronized branches, six post-merge checks and live production SHA/health/log readback.

**Build 193 dependency:** At the time this implementation began, Build 193 was merged into `dev` but `main` was intentionally held on Build 192 because Vercel returned `api-deployments-free-per-day`/build-rate-limit. Build 194 must not be reported production GREEN until Build 193's deployment gate is also cleared and both builds are on the verified live `main` commit.

**Operational holds:** Billing, Omnichannel, SMS/IVR, purchasing, physical access and payment settlement remain disconnected / HELD.

**Next queued:** Build 195 — Source-Grounded Occupancy Forecasts, Scenario Confidence & Export Provenance.
