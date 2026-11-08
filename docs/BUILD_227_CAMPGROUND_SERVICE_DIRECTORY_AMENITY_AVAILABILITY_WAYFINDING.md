# iCamp Build 227 — Campground service directory, amenity availability clarity and accessible wayfinding

## Guest experience

- Adds `/guest/services`, a mobile-friendly, guest-authenticated directory scoped to the campground of the selected **guest-owned reservation**.
- Reuses the **already published and independently reviewed** map wayfinding snapshot. Only public amenity types, reviewed descriptions, current-map point bindings and enabled amenity layers can cross the existing source boundary.
- Guests can search by published name, description or landmark note, filter by amenity type, open the correct published map location, and view published accessibility notes.
- Missing accessibility notes are labelled **not published**. Coordinates are used by the existing map only; the directory does not infer walking time, step-free routes, distances or entry clearance.
- The map source does **not** certify current facility hours, capacity or open/closed operating state. Every card makes that distinction explicit and advises office verification instead of displaying invented availability.
- Missing/unavailable map publication and verified zero amenities have different fail-closed states. A separate link leads to independently published rental offers; seeing a facility here does not create a rental reservation.
- Navigation from My Stay hub, full stay details and the arrival guide preserves guest reservation context.

## Privacy and control boundary

- Existing guest identity and `getMyStayDetail({ userId, reservationId })` remain the only way to select the campground. A mismatched public map campground ID is rejected.
- The page is server rendered with `robots` disabled and no customer communications or device actions. No staff-only facilities, operational safety data or non-published draft wayfinding records are exposed.
- No new database migration, rental hold, payment action or live facility-control integration.

## Verification

Run `node --test tests/build227-campground-service-directory.test.mjs`, then complete `npm run verify` and the existing protected GitHub development/production checks. Match the production Vercel deployment SHA to the new `main` merge and confirm live health before marking GREEN.
