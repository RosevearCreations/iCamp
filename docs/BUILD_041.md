# Build 041 — Reservation Checkout

Status: **FULLY PROMOTED — `main` GREEN.**

## Scope delivered

Build 041 completes the server-authoritative reservation checkout boundary for a signed-in guest:

- owner-bound temporary reservation hold acquisition and reuse;
- primary guest/contact capture;
- occupant, visitor, pet and vehicle counts;
- tent/RV/cottage compatibility inputs;
- campground booking-rule acknowledgement;
- optional add-on and visitor-pass selection;
- automatic service-fee inclusion;
- final server-authoritative accommodation + charge quote;
- checkout-time hold, availability, date-rule, capacity and compatibility revalidation;
- atomic conversion of the temporary hold into one pending reservation;
- immutable checkout, quote and charge-line evidence.

Reusable guest profiles remain Build 048 ownership. Build 041 stores only the reservation-specific checkout snapshot required to create and later service this reservation.

## Atomic checkout lifecycle

A public checkout begins only from an accommodation/date combination that is currently live-selectable and has a canonical Build 039 rate.

The signed-in guest receives an owner-bound Build 036-style temporary inventory hold. Re-entering the same checkout window reuses the active owned hold instead of creating duplicate inventory locks.

Final submission runs in one database transaction and:

1. locks the owned temporary hold;
2. rejects an expired, released or foreign hold;
3. serializes the accommodation inventory with the existing live-availability advisory-lock namespace;
4. reevaluates Build 032 date rules using the campground-local booking date;
5. reevaluates Build 033 occupant/visitor/vehicle limits;
6. reevaluates Build 034 tent/RV/cottage, pet, utility, dimension and accessibility compatibility;
7. recalculates the Build 039 accommodation price from current canonical rate plans/rules;
8. recalculates Build 040 selected add-ons/passes and automatic service fees from the current canonical catalogue;
9. converts the temporary hold to `converted`;
10. inserts one `pending` web reservation linked to the originating hold and guest account;
11. writes immutable checkout, rule-acknowledgement, compatibility/capacity and final-quote snapshots;
12. writes immutable charge-line snapshots.

The unique originating-hold reservation index makes checkout conversion idempotent. A retry after successful conversion returns the already-created reservation rather than creating a duplicate.

## Guest and checkout data

The reservation-specific checkout snapshot includes:

- primary first and last name;
- contact email and telephone;
- occupant count;
- visitor count;
- pet count;
- vehicle count;
- lodging kind;
- compatibility request and evaluated result;
- effective booking-rule result;
- authoritative stay quote;
- authoritative booking-charge quote;
- accepted currency and final total;
- rule-acknowledgement timestamp.

No raw payment-card data is collected or persisted.

## Public booking experience

The Build 038 accommodation detail page now offers **Continue to reservation checkout** only when:

- the accommodation is live-selectable for the requested dates; and
- Build 039 has a current server-authoritative rate.

The Build 041 checkout page:

- requires the guest to sign in;
- owns the temporary hold to that guest account;
- shows hold expiry;
- shows the current authoritative accommodation price and automatic fees;
- captures contact and party details;
- captures relevant compatibility requirements;
- lets the guest select current Build 040 optional add-ons/passes;
- requires explicit booking-rule acknowledgement;
- clearly states that submission creates a pending reservation only.

The pending-reservation page displays the immutable accepted quote and clearly identifies the reservation as pending payment.

## Security and privacy boundaries

Build 041:

- adds owner linkage to checkout holds and reservations;
- prevents checkout hold ownership reassignment;
- denies direct `public`, `anon` and `authenticated` access to checkout snapshot tables;
- enables and FORCEs RLS on public checkout snapshot tables;
- gives `icamp_app` read-only access to immutable checkout/charge evidence;
- allows an owner to read only checkout evidence bound to the transaction-local iCamp user ID, while authorized staff retain reservation read/modify visibility;
- intentionally gives `icamp_app` no INSERT, UPDATE or DELETE privilege on immutable checkout snapshot tables;
- does not place guest/contact values into redirect query strings;
- uses non-sensitive checkout error codes for browser redirects;
- reuses server-side authentication/session identity rather than trusting browser-supplied guest IDs.

The trusted server transaction writes immutable checkout snapshots directly after all authoritative validation succeeds.

## Channel parity

- **Web/PWA:** full guest/contact, party, compatibility, add-on/pass, rule-acknowledgement and final-quote checkout.
- **IVR/DTMF:** structured party counts and supported concise selections can use the same canonical checkout authority. Long rules, free-form contact data and visual choices use verified staff or secure-link handoff.
- **SMS/MMS:** concise checkout state and secure-link continuation use the same hold/reservation authority. Raw payment-card data is never requested over SMS/MMS.
- Every channel remains subordinate to the same server-side hold, availability, capacity, compatibility, price and charge validation.

## Build boundary

Build 041 **does not capture payment**, authorize a card, calculate a deposit schedule, mark a balance paid, or process provider webhooks.

Those actions remain **Build 042 — Deposits, Balances & Payment Provider Adapter** ownership.

Build 043 continues to own confirmations, receipts and reservation documents after the payment boundary exists.

## Platform impact

No new paid service, Vercel project, Cloudflare project, Worker, D1 database, R2 bucket or payment provider is introduced by Build 041.

## Production promotion evidence

- Feature PR #158 promoted the complete Build 041 implementation into `dev`.
- The exact final feature head was `6a01bd6055000766dd67a65578dffdba92534d9a`; Verify, Browser E2E, Database migrations/lifecycle/idempotence, CodeQL and Secret Scan were GREEN before merge.
- Build 041 merged into `dev` as `0506267a4ca8604b077cdcaf3b155299ad569968`.
- The exact `dev` merge SHA independently passed Verify, Browser E2E, Database migrations/lifecycle/idempotence, CodeQL and Secret Scan after merge.
- Hosted Supabase migration `20261014203442 / reservation_checkout` is live and `database/verify/0049_reservation_checkout.sql` passed against the hosted database.
- Post-DDL Supabase Security Advisor returned zero findings. Performance Advisor returned no Build-041 warning-class findings; only expected unused-index INFO notices were present for newly created indexes.
- Production PR #159 passed fresh Verify, Browser E2E, Database migrations/lifecycle/idempotence, CodeQL and Secret Scan gates on exact `dev` head `0506267a4ca8604b077cdcaf3b155299ad569968`.
- The validated runtime payload merged to `main` as `daad080d00a82cba9cc4eb3513115467e2009f9e`.
- The exact runtime production SHA independently passed Verify, Browser E2E, Database migrations/lifecycle/idempotence, CodeQL and Secret Scan after merge.
