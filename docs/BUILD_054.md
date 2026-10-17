# Build 054 — Day/Week Vehicle Passes & Extra-Vehicle Fees

Status: **FULLY PROMOTED — `main` GREEN.**

## Purpose

Build 054 turns the existing Build 040 pass/extra-vehicle charge catalogue into an operational vehicle-pass authority. It issues non-stay day/week passes and stay-linked extra-vehicle passes with explicit date/time validity, immutable fee/currency snapshots, provider-neutral payment state, and the parking/access instructions in force at issuance.

## Delivered

- campground-scoped vehicle pass management desk;
- non-stay day passes with a maximum 24-hour validity window;
- non-stay week passes with a maximum seven-day validity window;
- stay-linked extra-vehicle passes derived from active Build 053 formal road-vehicle registrations;
- configurable included-vehicle count per stay;
- canonical day/week/extra-vehicle fee selection from the Build 040 charge catalogue;
- immutable fee, currency, parking-rule and access-rule snapshots per issued pass;
- free-pass activation without fabricated payment;
- paid-pass pending state until provider capture succeeds;
- provider-neutral pass payment attempts and idempotent private provider-event evidence;
- use of the existing Build 042 free mock payment adapter for sandbox/development capture;
- append-only pass lifecycle evidence for issuance, payment activation and revocation;
- campground-scoped idempotency protection;
- per-plate advisory locking plus overlapping non-stay-pass rejection;
- open extra-vehicle pass duplicate prevention per Build 053 registration;
- explicit revocation without destructive deletion or automatic captured-payment reversal;
- FORCE RLS, direct anon/authenticated denial, and least-privilege cross-domain read policies;
- global audit events for policy edits, pass issuance, fee capture and revocation;
- contextual help and Build 053 navigation into the pass desk;
- canonical workflow parity registration for `vehicle.pass.issue`.

## Canonical pricing and payment boundary

Build 054 does not create a second price catalogue.

Campground managers select applicable:
- one-day pass charge;
- seven-day pass charge;
- per-unit extra-vehicle charge;

from the existing Build 040 `booking_charge_catalog`.

At issuance the pass snapshots the selected charge ID, amount and currency. A database trigger verifies that the snapshot exactly matches the active canonical source charge and correct pass/fee category. Later pricing edits cannot rewrite historical passes.

A fee of zero requires no payment and activates the pass immediately. A positive fee creates a `pending_payment` pass. Staff with both `vehicle.pass.issue` and `payment.capture` can send the charge through the existing provider-neutral Build 042 adapter. Capture atomically changes the pass to `payment_state='captured'` and `pass_status='active'`.

Raw card/PAN, CVV/CVC and other payment credentials are never stored in the vehicle-pass tables.

Revoking a captured pass does not silently refund money. Financial reversals remain subject to the existing refund/adjustment safeguards.

## Extra-vehicle authority

Extra-vehicle assessment is based on formal active Build 053 stay-linked registrations, not the looser Build 049 arrival-count snapshot.

The service and database require:
- an active Build 053 road registration;
- an active `pending`, `confirmed` or `checked_in` reservation;
- matching reservation and host accommodation;
- a vehicle count above the campground's configured included count;
- validity within both the reservation and formal registration window;
- no other open extra-vehicle pass for the same road registration.

Build 054 extends only the SELECT RLS policies needed to read these reservation/registration facts for a `vehicle.pass.issue` operator. It does not grant reservation create/modify authority.

## Parking and access boundary

Every pass snapshots the human-readable parking and access instructions in force at issuance.

- **Build 054:** rule text, validity, pass state and fee/payment evidence.
- **Build 056/063:** access credential issuance/lifecycle.
- **Build 060:** enforceable access zones, schedules and access rules.

Build 054 therefore does not fabricate gate credentials or pretend that rule text alone controls physical access.

## Channel parity

- **Web/PWA:** full pass policy, issuance, fee capture, history and revocation desk.
- **IVR/DTMF:** verified pass facts can be handled through the canonical `vehicle.pass.issue` workflow, but protected payment steps use staff/provider handoff. Raw payment credentials are never collected by custom DTMF.
- **SMS/MMS:** verified guided facts use the same authority with secure-link handoff for payment/protected review. Raw payment credentials are never requested by SMS/MMS.

## Database

Primary migration: `database/migrations/0068_day_week_vehicle_passes_extra_vehicle_fees.sql`.

Verification: `database/verify/0068_day_week_vehicle_passes_extra_vehicle_fees.sql`.

Primary tables:
- `public.campground_vehicle_pass_policies`;
- `public.vehicle_passes`;
- `public.vehicle_pass_events`;
- `public.vehicle_pass_payments`;
- `icamp_private.vehicle_pass_payment_provider_events`.

Hosted migrations:
- `20261017174141 / day_week_vehicle_passes_extra_vehicle_fees`;
- `20261017174220 / build054_advisor_hardening`.

Hosted verification passed after both migrations. Supabase Security Advisor reports zero findings. The Build 054 composite foreign-key performance advisory on `public.vehicle_pass_payments` was resolved by migration 0069; remaining Build 054 performance notices are INFO-level unused-index notices expected for newly created tables.

## Cost / provider / asset impact

Build 054 introduces no new paid service, Vercel project, Cloudflare resource, communications provider, production secret or required image asset.

It reuses:
- Build 040 canonical charge catalogue;
- Build 042 provider-neutral payment adapter and built-in free mock provider;
- Build 053 formal road vehicle registrations.

## Promotion

- feature PR #203 merged to `dev`;
- production PR #204 merged to `main`;
- exact final feature SHA `8a0217acc5653d409bb22e6b0c42734c0ff27f9f` passed CI #39054917527, CodeQL #39054917539 and Secret Scan #39054917560;
- exact `dev` merge SHA `c305dc2fa1879a85ba2d0db1f1c5d508ac695599` passed CI #39055081080, CodeQL #39055081131 and Secret Scan #39055081075;
- production PR gates passed CI #39055239989, CodeQL #39055239953 and Secret Scan #39055239986;
- production `main` SHA `07d087a96b3611d13f6a330ff9f78bddd87ace48` passed CI #39055398337, CodeQL #39055398510 and Secret Scan #39055398259;
- `dev` synchronized to the same production SHA and independently passed CI #39055566951, CodeQL #39055566940 and Secret Scan #39055566950;
- Verify, Browser E2E, database/lifecycle/idempotence, production build and dependency audit are GREEN.

## Next build

**Build 055 — Visitor Registration & Site-Specific Limits**
