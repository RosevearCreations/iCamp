# Build 073 — Departure Campsite Cleanup

## Status

**IMPLEMENTED — PROMOTION PENDING**

## Objective

Advance historical Build 074 by turning the Build 050 campsite checkout handoff into automatic, auditable departure cleanup and inspection work without creating a second booking-state, checklist or corrective-work system.

## Delivered scope

- automatic campsite cleanup task creation from canonical `reservation_check_outs`;
- safe backfill for existing campsite checkout evidence;
- one departure cleanup program per canonical campsite;
- exact `tent`, `rv` or `mixed` campsite-type validation;
- active published Build 068 `site` inspection template required for the same campsite;
- configurable `block_rebooking_until_clear` policy, defaulting to blocked when configuration is absent;
- checkout-time automatic site inspection handoff, with physical checkout remaining complete even when cleanup configuration is missing;
- Build 068 inspection occurrences/results/sign-off remain the checklist authority;
- failed inspection items continue to create Build 065 canonical maintenance work orders;
- clearance is rejected while corrective work orders remain outside `completed` / `cancelled`;
- canonical Build 030 accommodation `inspection -> available` transition releases a blocked campsite only after cleanup clearance;
- database guard prevents an uncleared blocking task from being bypassed by a manual `inspection -> available` status change;
- Web/PWA cleanup configuration and departure queue;
- IVR/DTMF and SMS/MMS limited to concise queue/status handling with secure Web/PWA fallback for visual evidence and checklist decisions;
- forced RLS, direct Data API role revocation, scoped `icamp_app` grants, actor validation and audit evidence;
- correction of the Build 050 cottage handoff comparison to canonical `rental_cottage`;
- Build 068 standard multi-theme semantic-token prerequisite remains binding for future visual/style work.

## Authority boundaries

Build 073 owns only the checkout-to-cleanup handoff, campsite cleanup configuration and clearance evidence.

It deliberately reuses:

- Build 050 for immutable physical checkout evidence;
- Build 030 for canonical accommodation status / availability;
- Build 065 for maintenance work orders and issue closure;
- Build 068 for versioned inspection templates, checklist results and sign-off.

No departure-cleanup table stores duplicate checklist-item results, work-order closure state or an independent booking availability state.

## Database

Migration:

- `database/migrations/0093_departure_campsite_cleanup.sql`

Verification:

- `database/verify/0093_departure_campsite_cleanup.sql`

Hosted migration and advisor evidence will be recorded after the verified `dev` candidate is promoted through the database gate.

## Promotion evidence

Promotion evidence will be filled in only after exact feature, `dev`, hosted database, `main` and closeout checks complete successfully.
