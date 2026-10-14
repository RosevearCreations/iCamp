# Build 040 — Add-Ons, Passes and Service Fees

Status: **IMPLEMENTED — promotion pending.**

## Scope delivered

Build 040 adds one canonical, campground-scoped charge catalogue for:

- extra guest and extra vehicle charges;
- visitor day and week passes;
- Wi-Fi;
- garbage pickup;
- rentals;
- launch fees;
- other campground add-ons;
- automatic service fees.

The catalogue supports campground-wide, accommodation-type and accommodation-specific scope.

## Pricing model

Every charge uses integer minor currency units and one deterministic pricing basis:

- per stay;
- per night;
- per unit;
- percentage of the authoritative stay subtotal.

Optional add-ons and passes require an explicit later checkout selection. Automatic charges are restricted to service fees and are included by the server whenever applicable.

The application rejects unavailable items, duplicate selections, quantity violations and mixed-currency quote construction.

## Tax and fee configuration hooks

Build 040 includes stable `tax_category_code` and `fee_category_code` hooks.

These fields classify line items for later tax, worksheet, accounting and reporting work. Build 040 intentionally does **not** invent tax rates or calculate taxes; the broader configurable tax/fee work remains owned by the later finance roadmap.

## Security and database boundaries

`public.booking_charge_catalog`:

- enables and forces PostgreSQL RLS;
- revokes direct `public`, `anon` and `authenticated` access;
- grants only the dedicated `icamp_app` role;
- uses permission-specific SELECT / INSERT / UPDATE policies;
- requires `pricing.manage` for writes;
- binds write actors to the transaction-local iCamp user ID;
- has no application DELETE privilege;
- prevents cross-campground or cross-accommodation scope mutation;
- prevents reactivation of archived charges;
- includes all foreign-key and public-lookup indexes in the base migration.

## Public booking experience

The campsite/cottage detail page now reads the canonical charge catalogue and shows:

- optional add-ons;
- visitor passes;
- automatic service fees;
- canonical server price labels;
- automatic-fee subtotal;
- authoritative stay + automatic-fee estimate when a Build 039 stay rate is available.

No placeholder price is fabricated.

## Channel parity

- **Web/PWA:** full visible catalogue, descriptions, pricing basis and automatic-fee summary.
- **IVR/DTMF:** concise charge names and canonical prices can be read from the same domain model; long visual catalogues use staff/secure-link handoff.
- **SMS/MMS:** concise charge catalogue and canonical prices can be summarized with a secure link to the same booking detail.
- Every channel remains subordinate to the same server-side charge, quantity, scope and currency validation.

## Build boundary

Build 040 does **not** create a reservation, persist a guest's optional selections, collect guest/contact/occupant/vehicle details, acknowledge rules, or revalidate an atomic reservation hold.

Those actions remain **Build 041 — Reservation Checkout** ownership.

Build 040 also does not capture payments, deposits or balances. Those remain **Build 042 — Deposits, Balances & Payment Provider Adapter** ownership.

## Platform impact

No new paid service, Vercel project, Cloudflare project, Worker, D1 database or R2 bucket is required.

## Promotion evidence

To be completed after exact-tree `dev` and `main` verification.
