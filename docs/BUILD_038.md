# Build 038 — Campsite & Cottage Detail/Booking Experience

Status: **FULLY PROMOTED — `main` GREEN.**

## Canonical scope

Build 038 owns:
- campsite and cottage features/rules presentation;
- the Build 028 up-to-10-image public gallery in the guest flow;
- map context and nearby amenity discovery;
- cottage-specific details;
- a truthful rate summary at the booking-detail boundary.

Build 038 consumes Build 035 server-authoritative availability and Build 037 public map selection. It does not duplicate canonical accommodation inventory.

## Pricing boundary

Build 039 remains the owner of authoritative nightly, weekly, monthly, seasonal, yearly, cottage, weekend, holiday, peak/off-season, event and promotional pricing.

Because no canonical rate-plan model exists before Build 039, Build 038 deliberately displays a rate-status summary instead of fabricating a numeric amount. Client-side or placeholder pricing is not treated as a quote.

## Delivered implementation

- New public route: `/booking/accommodations/[accommodationId]`.
- Detail access is bounded to active campsite/rental-cottage accommodations attached to the campground's currently published map version.
- Selected arrival/departure dates flow from Build 037 into the detail experience.
- Same Build 035 `icamp_private.live_accommodation_availability(...)` authority provides availability/blocker state.
- Campsite detail includes type, service level, stay profile, utilities, dimensions, surface, shade, waterfront/pull-through/accessibility and guest features.
- Cottage detail includes style, bedrooms/beds, sleeping occupancy, kitchen/washroom/shower, heating/cooling, appliances, accessibility, view and pet facts.
- Booking-rule summary reuses Build 032 campground check-in/out, lead-window and stay-length rules.
- Public gallery reuses Build 028 curated active public images and optimized media only.
- Map context reuses the currently published map version and canonical Amenities layer, preferring same-section amenities in the public list.
- Build 037 map selection now links available campsite/cottage choices directly into Build 038 while preserving the chosen dates/campground.
- No price is invented before Build 039.
- No reservation or payment is created before later checkout builds.

## Security and privacy

- No new public database grants.
- No guest/staff personal data is selected.
- Public detail is scoped to active campsite/rental-cottage inventory on the currently published campground map.
- Gallery output is restricted to active media already classified `public`.
- Availability remains server-authoritative.
- Internal operational media remains excluded.
- No new database migration is required.

## Omnichannel contract

- **Web/PWA:** full gallery, features, rules, live availability, rate-status and map-context experience.
- **IVR/DTMF:** concise canonical facts/dates/availability by accommodation code; gallery/map use staff or secure-link handoff.
- **SMS/MMS:** concise canonical facts/availability with secure visual handoff to the detail page.
- All channels preserve the Build 036 atomic-hold and Build 039 pricing authorities.

## Platform impact

Build 038 adds no paid service, Vercel project, Cloudflare project, Worker, D1 database, R2 bucket or additional hosted runtime.

## Next build

**Build 039 — Rate Plans & Dynamic Date Pricing**

Status: **QUEUED — NOT STARTED**

## Promotion evidence

- Feature PR #147 final head `638adbe533e5704e366bdac30bce758d1be8180d` — CI `38503688926`, CodeQL `38503688923`, Secret Scan `38503688951`: GREEN.
- Feature merged to `dev` as `48b235ed9c948c77e01c61467c1aa90f82e5d61f`.
- Independent exact-`dev` verification — CI `38503877072`, CodeQL `38503877078`, Secret Scan `38503877183`: GREEN, including Verify, Browser E2E and database lifecycle.
- Build 038 requires no database migration and therefore no hosted Supabase schema change or advisor gate.

## Production closeout

- Production PR #148 candidate `b815489d780f5123b22bb9efda135103d3a2d7e8` — CI `38504295766`, CodeQL `38504295940`, Secret Scan `38504295913`: GREEN.
- Production feature/evidence merge: `450a42dd01db021f1881cfe67c9955f68ccc6d73`.
- Independent exact-`main` verification at `450a42dd01db021f1881cfe67c9955f68ccc6d73` — CI `38504494804`, CodeQL `38504494781`, Secret Scan `38504494836`: GREEN, including Verify, Browser E2E and database lifecycle.
- Production source remains GitHub `main` under the current rough-sketch platform decision; no new Vercel/Cloudflare runtime was created.
