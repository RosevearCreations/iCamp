# iCamp Build 195 — Source-Grounded Occupancy Forecasts, Scenario Confidence & Export Provenance

## Delivered scope

- The authenticated Operations Command forecast page now separates the original **historical current-month variance** from a new **next one-to-three full-month planning outlook**. Management access still requires the assigned campground and all three of `reports.read`, `reservation.read`, `accommodation.read`.
- A separate tenant-scoped **read-only** source query reads 26 completed calendar months plus the current partial month from the existing RLS-protected `reservations`, `seasonal_assignments` and `accommodations` tables. Daily occupancy is counted once where seasonal and confirmed reservation records overlap. No new tables, migrations or write privileges are introduced.
- Two calendar-matched prior seasonal years, 60 observed site nights, recorded booking activity in both years, and positive current operating capacity are prerequisites **per accommodation type and future month**. Otherwise projection, range and confidence are explicitly **unavailable**—not zero.
- Low / typical / high use the two observed seasonal rates (minimum, site-night-weighted rate, maximum). The historical minimum/maximum forms a **descriptive sensitivity range**, not a 95% confidence interval, probability model or guarantee. A qualitative `low` or `limited` indicator never claims high certainty from two samples.
- A six-row retrospective check compares actuals in the prior two completed months with seasonal-rate estimates from their two earlier comparable years. Missing backtests remain unavailable; errors are shown as absolute site-night differences.
- Projection capacity is capped at **today's operating-site count × calendar days**. Historic denominators use today's active inventory as a proxy; changes in historical/future capacity, closures, weather, holidays, missing imports and unavailable records can invalidate the outlook.
- Staff can print accessible, responsive tables or download a **newly authorized, private, no-store CSV** with scope, model, source date/timezone, observation range, assumptions, projection and backtest rows. `X-iCamp-Export-SHA256` is a byte-level check of exactly the returned UTF-8 CSV, **not** a source attestation or digital signature. Earlier Build 169–171 browser-local checksum tools are unaffected.

## Release acceptance

1. Run `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`, and the browser suite; test synthetic datasets covering seasonal coverage, low/high bounds, missing inventory, backtests, CSV and anonymous denial.
2. Confirm the existing role/RLS restrictions and source query against the connected iCamp project using read-only database checks; no DDL or migration is required for this build.
3. Require GitHub CI, CodeQL and Secret Scan GREEN on the exact reviewed `dev` candidate and `main` release. Confirm Vercel READY on the exact main commit, production alias, health/readiness HTTP 200 and a live version SHA match before declaring GREEN.
4. Authenticated owner walkthrough remains a distinct owner-acceptance check; a successful build does not infer approval or data quality.

**Held:** No automatic reservations, prices, revenue/cash decisions, provider calls, physical access, SMS/IVR or payment action. Billing / Omnichannel remain HELD / DISCONNECTED.

**Next queued:** Build 196 — Financial Exception Review, Refund Readiness & End-of-Day Close.
