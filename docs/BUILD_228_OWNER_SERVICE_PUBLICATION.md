# iCamp 228 — Campground owner service directory publishing

Build 228 extends Build 227's **published map source**, not its authentication or
booking/communications boundaries. Only authorized campground managers with
both `campground.configuration` and `campground.map.publish` may save or
publish reviewed amenity details. The owner editor is at
`/workspaces/management/campgrounds/maps/wayfinding/services`.

## Safe publication

- Existing map points remain unpublished unless explicitly reviewed via the
  Build 180 location workflow. Service details are **separately unpublished by
  default**. Saving privately withdraws any prior published service review.
- Operators select a **reported** operating status, optional descriptive
  hours and optional checked accessibility information, then explicitly affirm
  they reviewed the details. Publication records the reviewer and timestamp.
- The service review requires an eligible, active, published, map-version-pinned
  amenity point. On withdrawn or repinned wayfinding, service publication is
  automatically revoked by the Build 228 trigger.
- Published guest entries clearly display the review date and never imply live
  operating status, capacity, emergency dispatch, certified step-free routing,
  or an access entitlement.
- Each server mutation rechecks campground permissions, campground ownership,
  the precise source object and optimistic `row_version`, and appends an audit
  event. Invalid, stale or unauthorized updates fail closed.
- Migration `0216_build228_verified_amenity_service_publication.sql` adds only
  owner-reviewed fields to the already private/RLS-protected Build 180 table.
  The public booking map checks schema presence first and retains Build 227
  behavior if the original host has not applied migration 0216. No live
  publication is claimed until the original database is migrated and the
  campground owner actually reviews and publishes details.

## Verification

Run `node --test tests/build228-amenity-service-publications.test.mjs`,
`npm run verify`, and the required protected PR and post-merge CI checks.
Database migration CI runs `npm run build228:verify` to validate the additive
schema, default-private status, RLS and source-expiry trigger in an isolated database;
it does not prove that an independently hosted production database was updated.
