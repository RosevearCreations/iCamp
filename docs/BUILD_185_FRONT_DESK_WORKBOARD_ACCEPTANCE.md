# Build 185 — Front Desk Unified Arrival/Departure & Exception Workboard

## Front desk experience

- `/workspaces/management/campgrounds/reservations/front-desk` is an authenticated, campground-scoped staff Web/PWA workboard. Filter by campground, arrivals, departures, attention, active holds and guest/site/reference, and sort by urgency, date or accommodation through native keyboard-accessible GET controls.
- A single read-only, repeatable-read database snapshot combines **real** reservation arrival windows (yesterday through 14 days ahead), all checked-in departures and completed checkout receipts from the last 14 days. A stay may appear once in each queue; no separate reservation state is invented.
- Flags are derived from live confirmation, guest-submitted pre-registration and version-pinned staff receipt, the **status** of financial review/outstanding balance, unresolved visitor registration/payment status, accommodation-linked open maintenance work orders, and unfinished cottage turnovers. Work-order presence is an attention signal, not proof of an availability block. Only a source `blocked` status is labelled blocked.
- Unexpired temporary holds overlapping the arrival horizon are their own rows, never presented as actual guest bookings. All staff actions are **links to canonical** check-in, check-out, reservation detail, arrival-readiness, holds, visitor, work-order and cottage-turnover workflows. Reload the board after a canonical decision; there are no optimistic "approved" indicators.

## Access, integrity and explicit boundaries

- The route and database adapter independently require `reservation.read` or `reservation.modify` for the selected assigned campground. PostgreSQL `icamp_app` session identity and existing forced RLS continue to scope all reads. `payment.read`, `visitor.read`/`visitor.register`, maintenance privileges, and `accommodation.read`/`accommodation.manage` independently gate auxiliary columns, queries, counts and links. Financial amounts never appear to readers lacking `payment.read`.
- The workboard is **read only**. No new migration, stored copy, RLS policy, reservation mutation, approval, stock release, gate credential, capture, invoice adjustment, refund, visitor registration, maintenance completion or outbound send is introduced. **Billing / Omnichannel HELD**.
- Source `count(*) over()` records **complete eligible source cardinality before per-source display caps**: 300 distinct reservations, 120 overlapping holds, 300 visitor-reservation issue groups, 500 open maintenance location groups and 500 unfinished cottage groups. When capped, the screen calls figures *partial*, rather than claiming complete counts. When access is absent, source coverage says *restricted* and does not infer zero. Visitor groups outside the visible reservation rows and work orders without a directly linked accommodation are surfaced for canonical follow-up.
- All dates and desk windows use campground timezone at the database. A read-only repeatable-read transaction and `transaction_timestamp()` provide one consistent source snapshot. Source availability can change between display and canonical action, so only the destination workflow may commit a decision.

## Release gates

1. Run `tests/build185-front-desk-workboard.test.mjs`, full `npm run verify`, and `npm run parity:verify`. Verify page and database query path with actual deployed PostgreSQL and permission-restricted route behavior; check database advisors (no schema migration).
2. Push the exact tested source tree to `dev`, confirm GitHub CI, CodeQL, Secret Scan and matching READY Vercel Preview.
3. Merge `dev` to `main` without force; confirm exact-sha READY Production, live `/api/version`, `/api/health/ready`, `/status`, front-desk sign-in protection, runtime error readback and dev/main source tree parity.

## Next build

**Build 186 — Housekeeping/Maintenance Turnover & Availability Release Controls (Billing / Omnichannel HELD).** Enforce supervisor-verified evidence gates between housekeeping, safety inspection, repair work and availability release, with auditable overrides and concurrency safeguards.
