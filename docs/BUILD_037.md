# Build 037 — Public Interactive Booking Map

Status: **IMPLEMENTED — FEATURE VALIDATION PENDING.**

## Canonical scope

Build 037 owns:
- date/filter-driven public campground map;
- green/grey/yellow/red operational presentation;
- selectable accommodation polygons;
- accessible list alternative.

It consumes, rather than duplicates:
- Build 031 published map versions;
- Builds 019–023 source-image polygon geometry and canonical map-object binding;
- Builds 024–030 canonical accommodation identity and operational status;
- Build 035 server-authoritative live availability;
- Build 036 atomic temporary hold state.

Build 038 remains responsible for the full campsite/cottage detail and booking experience.

## Delivered implementation

- New public route: `/booking/map`.
- Public campground selector limited to active campgrounds that have a published map version.
- Arrival/departure, accommodation-kind and available-only filters.
- Published-map polygons joined through canonical accommodation → map-object → binding relationships.
- Same PostgreSQL `icamp_private.live_accommodation_availability` authority used by staff live availability.
- Public presentation resolver:
  - green = available/selectable;
  - grey = reservation/hold/seasonal or occupied-like state;
  - yellow = turnover/inspection/maintenance;
  - red = management restriction/closed/winterized.
- Keyboard and pointer selectable SVG polygons with `aria-label` and pressed state.
- Accessible list alternative with matching accommodation/status facts.
- Published overhead map image rendered behind polygons when storage access is available.
- Existing media-access route gains one bounded anonymous exception: an internal asset may be signed for unauthenticated reading only when PostgreSQL proves that exact media asset belongs to an active campground's currently published map version.
- Public workspace links directly to the booking map.
- Filtered public route remains `noindex` during the rough-sketch/unhosted phase to avoid uncontrolled query-parameter indexing.
- No new database table, migration, paid mapping service, Vercel project, Cloudflare project, Worker, D1 database or R2 bucket.

## Security and privacy

- No guest/staff personal information is selected.
- Direct browser database access is not introduced.
- Internal media remains private unless the media ID is proven to be the published campground map.
- Map availability is computed server-side from canonical inventory.
- Public UI never accepts client-supplied availability or status as authoritative.

## Omnichannel contract

- **Web/PWA:** full interactive visual map plus accessible list.
- **IVR/DTMF:** map geometry is graphical-only; future booking flows read the same canonical date/type availability and identify accommodations by code, with staff-transfer fallback.
- **SMS/MMS:** future guided booking can return canonical accommodation codes and a secure visual handoff to the map without creating a second availability source.

## Validation

Feature validation is pending GitHub CI, Browser E2E, database migration lifecycle, CodeQL and Secret Scan gates. No hosted Supabase schema change is required for Build 037.
