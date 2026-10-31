# iCamp Build 162 — Capacity & Occupancy Analytics, Camper Assistance Board, Standard Theme Owner Acceptance

## Delivered

1. `/workspaces/management/command/capacity` is an authenticated, tenant-scoped 14-night operations report. It derives site inventory and daily booked, pending, temporary-held, and out-of-service counts directly from the entire authorized campground, using the campground-local date. It **does not** rely on the reservation management table's 250-row listing limit.
2. The 7/14-night toggle controls a responsive grass-green grouped-bar chart and an accessible exact-count table. Booked coverage includes confirmed/checked-in reservations and active seasonal assignments, deduplicated per site/night. Pending bookings, unexpired temporary holds, and operating closures are separate and can overlap. This is planning evidence, **not** the live booking eligibility engine, actual guest headcount, or revenue.
3. `/workspaces/management/command/assistance` is a real five-column camper-assistance board backed by the existing canonical triage queue. Search, urgent/unassigned/open filters, source-driven counts, a detailed inspector, and a deep link to each case's existing actions are available. The board itself is deliberately read-only: it neither sends messages nor dispatches staff.
4. `/settings/themes/acceptance` provides five real-screen owner walkthrough links, an interactive review checklist and a copyable feedback summary. These checkbox choices are **session-only** and are **not** a persisted owner acceptance receipt or legal authorization. Owner sign-off remains pending owner review.
5. All three screens use iCamp's Standard fresh-grass and evergreen design vocabulary, responsive layouts, compact cards, semantic status colors and actual source totals. Management Command and theme settings link to the new screens.

## Authorization and bounded scope

- Capacity requires a real assigned campground with `reports.read`, `reservation.read`, and `accommodation.read`, repeated at the data service boundary and constrained with the `icamp_app` role and `icamp.user_id` context.
- Assistance requires `reports.read` and a real assistance-triage or property-operations permission for the selected campground; the queue repeats its authorization check.
- Theme review requires `reports.read` and does not write to any database.
- Source failures render **unavailable**, not zero. Neither report combines data across tenant boundaries.
- Subscription billing and subscriber agreement approval remain **HELD**; Omnichannel remains **DISCONNECTED / HOLD**. No live charges, calls, texts, dispatch or authenticated cross-app gateway GETs were authorized by this feature.

## Acceptance and release gates

- `npm run verify` (format, lint, TS, all tests, optimized production build).
- Independent GitHub dev/PR checks, then main checks, including browser and database integration.
- Vercel production deployment must be `READY` at the **exact** immutable main merge SHA.
- Public live health/version/status/launch/connection smoke must all pass; new protected routes must redirect unauthenticated visitors to sign-in.
- Owner visual feedback and actual tenant-data viewing are pending a real, separately authorized owner walkthrough. Do not convert review checkmarks into an approval receipt.

## Next planned build

Build 163 — Seasonal Site Utilization Trends, Camper Resolution Timeline & Standard Theme Accessibility Follow-Up (Billing / Omnichannel HELD).
