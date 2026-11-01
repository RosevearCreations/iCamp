# Build 173 — Accessible Campsite/Cottage Discovery, Availability Filters & Side-by-Side Comparison

## Delivered public guest scope

- `/booking/map` uses the existing published campground polygon map, active accommodation inventory, and date-window `icamp_private.live_accommodation_availability` function. The map and keyboard/screen-reader table receive the **same filtered result set**. The page is dynamic and a full refresh recomputes active reservations, temporary holds, maintenance/restrictions, turnover and seasonal assignments.
- Campground-authored campsite type, water/electrical/Wi-Fi service, waterfront, fire ring, picnic table, advertised accessibility, pets and maximum RV length, plus cottage sleeping occupancy, pets, step-free entry and accessible washroom, are available as filters and comparable facts. Only published, active public-gallery images are counted; alternative-text coverage is distinguished from the subjective quality of photography.
- Unknown occupancy/RV-fit values do not satisfy positive filters. The inventory does not currently attest campsite guest occupancy; the guests filter therefore matches cottages with explicit maximum occupancy only. Access flags are *campground advertisements*, not independent accessibility certificates. Guests are directed to staff for critical fit confirmation.
- Visitors can select **one to three** campsites/cottages, including unavailable units for an honest side-by-side decision. Comparisons show current live status and relevant features; previously saved selections are read only from **browser-local storage**, keyed by campground (no guest PII or cloud sync), with bounded shape/version parsing. Saved fingerprints include availability revision, blockers, status and campground-authored details. Rechecks cover the campground's full published inventory even when the visitor's current filters hide a saved item. On revisit or changed dates, the source and live state are **rechecked**, and changed or unpublished items are flagged without inventing an available booking.
- A published unit is not held by selecting or saving it. Every booking/detail page still uses the existing server-side reservation and quote logic. Build 173 creates no bookings, payments, hold, provider calls or outbound messages.

## Trust, privacy, failure and channel boundaries

| Concern | Behavior |
| --- | --- |
| Tenant/source authorization | Read-only active accommodations bound to the chosen published campground map and polygon; gallery restricted to active public-classified media. Existing DB role/RLS and live availability function remain authoritative. |
| Mutation/audit | No new server mutations, audit writes or migrations. Optional local comparison storage is visitor-controlled and can be cleared. |
| Temporary hold expiration | New page load recomputes hold blockers from the canonical availability function; saved fingerprints include those blockers, not just row revision. No client claim of continuous freshness. |
| Stale/missing source | Last snapshot time displayed, explicit refresh control, changed-date/revision warnings, removed/unpublished saved selections reported and excluded from comparison. |
| Assistive technology | Semantic GET filters, keyboard polygon buttons, visible identical HTML result table, associated compare checkboxes, table header semantics, live status and responsive horizontally scrollable comparison. |
| Web/PWA | Implemented; no additional provider required. |
| Staff-assisted | Accommodation codes, dates, published details and current availability can be read verbally by staff. |
| IVR/DTMF, SMS/MMS | **HELD / DISCONNECTED**. Future provider-gated adapters can use the canonical source; none are activated. |
| Billing | **HELD / DISCONNECTED**; saved selections do not price, quote, reserve, charge or collect payment. Build 174 is a separate transparent total/policy preview scope. |

## Verification

- `tests/build173-public-discovery-comparison.test.mjs` validates bounded filters; unknown accessibility, RV fit, pet, photo and occupancy behavior; one-to-three selection limit; storage integrity; missing accommodation and changed-date/expired-hold-style blocker fingerprint detection; and published-map/live-source integration.
- Existing Build 037 map and Build 038 public-detail tests must remain green, together with full repository formatting, lint, TypeScript, unit tests, Next production build, workflow parity, remote database/browser CI, security checks and an exact Git SHA production-version readback.
- Owner acceptance from Builds 171–172 remains gated; release/CI is **not** independent Standard Theme owner acceptance.

## Next queued build

**Build 174 — Transparent Booking Total, Fee Breakdown & Policy Preview (Billing / Omnichannel HELD).** Present server-sourced rate/fee/tax/deposit/policy breakdowns and quote expiry on public Web/PWA and printable/staff-assisted views, without invoking payment rails or promising a frozen price after expiry.
