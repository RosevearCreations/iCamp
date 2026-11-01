# Build 182 — Amenity/Equipment Rental Availability & Reservation Planner

## Customer experience

- `/rentals` lists only opt-in **staff-reviewed offers bound to a real campground operational asset**. It does not display unpublished internal inventory, serial numbers, asset maintenance notes, or fabricated product counts. Supported source types are watercraft/cart/other equipment and sports field/hall/other amenity facilities. Maintenance vehicles, gates, utilities and other safety-critical types are excluded.
- Customers can choose pickup and return calendar dates, both **inclusive** and in the campground's local time. A valid window spans 1–14 days; staff may restrict individual assets to a shorter period. Availability is calculated from the real physical asset's operational state and the absence of overlapping *active provisional requests*. **One source asset = one provisional request slot**, without claiming confirmed allocation or inventory holds.
- `/guest/rentals` requires an active guest account, an owned confirmed/checked-in reservation, dates within that stay, and currently available source-backed capacity. Idempotency prevents duplicate submission. Guests can see and withdraw their own requests, releasing provisional planning space.
- If the database isn't configured, the feature fails closed with a clear office referral. Missing dates never display a fabricated availability claim. Missing accessibility guidance is labeled unsupplied instead of implying accessible service.

## Internal functionality

- Staff with `rental.manage` can use `/workspaces/management/campgrounds/rentals` to draft and explicitly publish source asset offers, disclose accessibility and pickup/return details, constrain maximum planning days, and close request intake. `campground_manager` receives its existing catalog `rental.manage` permission for this workflow; store/POS and owner roles retain their prior authority.
- A database trigger prevents publication of non-operational or ineligible source assets. All guest requests are campground-and-organization-bound, date-and-reservation-validated, and serialized by a row lock before overlap checks. A source asset moved to unavailable immediately loses request eligibility on the live readback (existing plans remain recorded for staff review).
- Review decisions are `reviewed` (not allocated) or `declined`; guests may `withdraw`. Audits preserve actor, scope, state changes and IDs without exposing guest notes in audit snapshots. Private tables FORCE RLS, deny `icamp_app` direct access, and revoke direct `anon`/`authenticated` grants.
- Neither a pending nor reviewed plan **charges, captures a deposit, issues a ticket, fulfills equipment, holds inventory, notifies guests externally, or controls entry**. Contacting campground staff is the secure nonvisual/telephone/SMS handoff; automated messaging remains disconnected.

## Release gates

1. Apply `database/migrations/0192_build182_rental_planning_offers.sql` and execute `database/verify/0192_build182_rental_planning_offers.sql`; check Supabase security advisors.
2. `tests/build182-rental-planning.test.mjs`, full `npm run verify`, and `npm run parity:verify`.
3. GitHub CI (database and browser), CodeQL, Secret Scan, Vercel preview READY and exact candidate SHA.
4. Merge `dev→main` without force; verify Vercel production READY, exact live merge SHA, `/api/health/ready`, `/status`, public `/rentals`, auth protection, and zero new runtime errors.

**Billing / Omnichannel HELD:** no charges, quotes, deposits, refunds, tickets, actual asset allocation, SMS/voice/email, IVR/DTMF transaction execution, gate action or live dispatch.

## Next build

**Build 183 — Guest Store Catalogue, Cart Draft & Campsite Delivery Planning (Billing / Omnichannel HELD).** Source-verified store items, reversible guest cart drafts, and safe delivery preference requests without payment or fulfillment commitments.
