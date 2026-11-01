# Build 180 — Accessible Map/List Wayfinding, Amenities & Directions

## Guest experience

- The published booking overhead map now includes **opt-in, campground-reviewed** amenity points, with keyboard-selectable markers and a synchronized nonvisual list, searchable by amenity kind and text.
- Each visible point has a human description, optional staff-reviewed accessibility details and optional landmark guidance. Absent notes are labeled **not supplied**, never silently interpreted as accessible.
- Map and list use the exact same validated image coordinates. Version drift, disabled amenities and stale bindings fail closed. Accommodation availability still comes from the existing date-scoped live source and is independent of amenity filters.
- The My Stay mobile hub links into the wayfinding section of the same campground/date map. Public guests can browse without authentication, but no gate, visitor privilege, route, or reservation is conferred.
- The app **does not calculate turn-by-turn paths, travel time, distance, accessibility certification or live service opening hours** where no verified source exists. Guests are directed to campground staff for current path and access confirmation.

## Campground owner function

- Authorized campground staff with **both** configuration and map-publication privileges can review pool, washroom, dock and suitable building points in `/workspaces/management/campgrounds/maps/wayfinding`.
- Publication is opt-in and requires an active object bound as a point to the enabled **Amenities** layer on a **published image version**, with a nonempty human description. Gates, road infrastructure and operational assets cannot enter this public route.
- Review saves are organization/campground-scoped, optimistic-version-controlled, audited, and immediately removable by unpublishing. Publications are pinned to an image version, so publishing a new image never silently repositions old amenity coordinates.
- New private schema uses FORCE RLS, explicit deny policy for `icamp_app`, and no untrusted `anon`/`authenticated` direct table grants. The public projection is intentionally narrow.

## Evidence gates

1. `tests/build180-wayfinding.test.mjs` — text validation, point source consistency, public kind restrictions, search parity, permission guard, migration and rendered list contract.
2. `npm run verify`, `npm run parity:verify`, database migration/verification, Supabase advisors.
3. GitHub CI (database, browser, app), CodeQL, Secret Scan; Vercel preview READY and exact candidate SHA.
4. PR merge and Vercel production READY; exact live `main` SHA, health/status, guest and unauthenticated route behavior, runtime error readback.

Billing, payment activation, live SMS/voice and omnichannel outbound dispatch remain **HELD / DISCONNECTED**.

## Next build

**Build 181 — Events & Recreation Discovery, Capacity & Registration.** Present campground-published events, accessibility and capacity status; allow safe registration requests without presuming payment or external message delivery.
