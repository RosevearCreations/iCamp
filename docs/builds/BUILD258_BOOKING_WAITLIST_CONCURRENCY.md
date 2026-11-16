# iCamp Build 258 — Booking-map clarity, atomic hold conflict proof and review-only waitlist

**Owner request:** Improve guest and front-desk booking, site map, dates, holds and waitlist. Publish source-compatible iCamp operational signals for a future combined Master Shell dashboard showing iCamp and YW without seven-app lockstep. Preserve iCamp Slave Application Shell and Meadow/Orbit independent themes.

## Delivered local scope
- Reuses canonical public `/booking/map` and staff `/workspaces/management/campgrounds/availability` from Builds 035–038, 173/180. Date-only stays are **arrival inclusive / departure exclusive**. 1–90 nights, leap-day/DST validation and visible live-source inventory status counts are presented without treating a map click as a booking.
- Guest-facing published site map provides counts of available, held/reserved, maintenance and closed accommodations with the source timestamp. Public guests are instructed to **ask staff** about waitlist review; there is no guest-self-enrolled consent, offer, reservation or contact promise.
- New protected `/workspaces/management/campgrounds/booking-review` shows the same server-authoritative availability source to staff, links the canonical atomic hold workbench and collects no-contact staff waitlist notes **only for currently blocked sites**. Entries retain FIFO creation order and immutable reviewed/cancelled disposition events, never auto-promote or reserve inventory.
- Migration `0237_build258_waitlist_review.sql`: two FORCE RLS tenant-/staff-bound append-only ledgers, canonical accommodation FK, idempotency key unique per campground, same advisory inventory lock used by canonical reservation/hold writers, server-side re-evaluation of availability at insert, no PII or external send. Verification in `database/verify/0237_build258_waitlist_review.sql`.
- `scripts/build258-hold-concurrency.mjs`: **real** PostgreSQL two-connection concurrent overlap test after isolated demo seeding. Both insert direct into the canonical existing `reservation_holds` table and its Build 035 conflict trigger: assert exactly one succeeds, one is rejected, persisted active hold count = one. Test is constrained to the 127.0.0.1 `icamp_ci` GitHub Postgres database with explicit acknowledgement; cleans only its own synthetic hold IDs. Never create or fake production customer reservations in tests.
- Single-source staff/guest parity: both use `icamp_private.live_accommodation_availability`. The waitlist does not bypass `icamp_private.create_reservation_hold`; real holds remain protected by Build 036 advisory locks and database transaction/idempotency rules.

## Read-only Master instrument handoff
- Pure source contract `rosevear.master-instrument.source-signal.v1` via `buildICampInstrumentSignal` (local, not an unauthenticated HTTP endpoint): exact deployed Git SHA, source observation timestamp, coarse campground inventory counts, coarse database/integration HOLD status and non-sensitive diagnostic codes. No owner names, guest details, tenant ids, site IDs, raw logs, device controls, phone numbers or secrets.
- Local staff workbench displays **iCamp-only** instrument-preview tiles. To display iCamp **and YW** side by side in **AI Data Platform / Master Server Shell**, the three Masters must independently authenticate issuer, scoped audience, protocol 1.0/1.1, source revision, nonce, expiry, consent and actual ACK for each feed. A repo contract, preflight test or static tile is never an authenticated cross-app link.
- Protocol **1.1**, backward compatible with **1.0** basic health read. Unavailable iCamp/YW Vercel does not block independent releases in Rosevear AI Hub, Rosevear Comms Hub, Devil n Dove or Rosie Dazzlers. Do not add synchronous dependency or raw DB replication.
- Futuristic Master visualization and Home Assistant/MQTT automation execution remain **separate Master/AI Hub implementation and owner-approved authority gates**, not a side effect of a campground booking release. Do not grant iCamp power to operate home devices or change original Windows host physical OFF state. No live combined dashboard or home automation has been verified by this release.

## Security / operational HOLD
- Staff view/access requires current campground reservation.read/create/modify grants; new waitlist mutations require AAL2 and server-owned session principal; DB trigger independently re-checks current role and canonical live availability.
- A waitlist note is not a verified guest reservation, marketing consent, outbound notification, temporary hold or payment. It has no `guest_id`, contact or dispatch field.
- CI applies/test-runs migration 0237 in **disposable PostgreSQL**. Production migration adoption must be verified **separately** before declaring live staff waitlist operations enabled. Never run migration 0237 on unverified real database targets, never claim source signers or real YW/iCamp connected state without independent evidence.

## Release gates
- Feature PR -> `dev`: formatting, lint, typecheck, Node tests, browser E2E, isolated all-migrations plus real two-session hold conflict, CodeQL, Secret Scan, exact SHA Vercel preview READY.
- Source-exact isolated main branch because `dev` and `main` histories diverge. Repeat all checks and Vercel preview; merge `main`, verify exact-SHA production READY, live home/version/health HTTP and recent runtime errors. No skipped/fictional passes.
- Use only one feature and one reviewed production candidate to respect Vercel daily limits; never change Vercel plan/billing or other app repositories without separate need.

## Next build
**iCamp Build 259 — Payment, Deposit, Invoice, Refund and Accounting Reconciliation Controls.** Remaining proposed after 258: Builds 259–264.
