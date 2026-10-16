# Build 052 — Stay Extension & Accommodation Move

Status: **IMPLEMENTED — promotion status is determined by exact GitHub and hosted-database gates.**

## Purpose

Build 052 extends the existing Build 044 reservation-management authority so an active checked-in stay can be extended or moved without creating a second booking record or bypassing live inventory, pricing, payment-review, accommodation-status or audit controls.

## Delivered

- checked-in reservations can use the existing managed-reservation workflow;
- historical arrival date is locked after check-in;
- departure changes re-run current stay pricing and booking-charge calculations;
- accommodation moves are accepted only through the canonical Build 035 reservation-conflict trigger;
- checked-in moves require both `reservation.modify` and `accommodation.manage`;
- checked-in move targets must be available, reserved or arriving before the transaction;
- old accommodation moves through the existing Build 030 status engine toward inspection;
- new accommodation moves through the existing Build 030 status engine to occupied;
- positive or negative price difference is recorded against the existing Build 044 financial-delta model;
- payment schedule/captured-payment differences continue to flag Build 045 financial review rather than silently charging or refunding;
- append-only Build 052 operational evidence records availability recheck, before/after stay window, price difference, source/target accommodation and operational-review flags;
- departure timing changes flag housekeeping/turnover review;
- accommodation moves flag housekeeping and maintenance review;
- the Build 044 append-only reservation history and Build 006 audit trail remain authoritative.

## Availability authority

Build 052 does not create a second availability engine.

The reservation update itself remains subject to the Build 035 database conflict trigger. The Build 052 evidence row is inserted only after that canonical update is accepted in the same transaction, so `availability_rechecked=true` means the authoritative database conflict boundary accepted the revised accommodation/date window.

## Pricing and payment difference

Build 052 uses the existing Build 039 stay-pricing and Build 040 booking-charge engines through Build 044 reservation management.

The prior and revised managed totals plus their signed delta are preserved. Build 052 does not execute a charge, refund, credit, forfeit or write-off. When a payment schedule or captured payment makes reconciliation necessary, Build 045 remains the financial execution authority.

## Maintenance and housekeeping impact

For a checked-in accommodation move:

- the old accommodation is routed through the existing Build 030 operational state machine toward inspection unless a protected operational state already applies;
- the new accommodation becomes occupied through the same state machine;
- housekeeping review is required;
- maintenance review is required.

For a checked-in departure-date change without a move, housekeeping/turnover timing review is required.

These are operational handoff signals, not a duplicate maintenance work-order system. Later maintenance/housekeeping builds remain canonical task authorities.

## Authorization

- checked-in extension/date adjustment: `reservation.modify`;
- checked-in accommodation move: `reservation.modify` plus `accommodation.manage`;
- read access to Build 052 evidence: `reservation.read` or `reservation.modify`.

Direct `anon` and `authenticated` table access is denied. The evidence table FORCEs RLS and is append-only.

## Channel parity

- **Web/PWA:** full checked-in extension/move review and operational evidence.
- **IVR/DTMF:** verified staff may use concise canonical reservation actions; move, repricing and operational-impact review use staff-assisted visual fallback.
- **SMS/MMS:** verified staff may initiate concise canonical actions and use secure-link fallback for complex move/repricing/operational review.

No channel bypasses live availability, permission, pricing or financial-review controls.

## Database

Migrations:
- `database/migrations/0065_stay_extension_accommodation_move.sql`;
- `database/migrations/0066_build052_advisor_hardening.sql`.

Verification:
- `database/verify/0065_stay_extension_accommodation_move.sql`;
- `database/verify/0066_build052_advisor_hardening.sql`.

Hosted Supabase:
- `20261016222946 / stay_extension_accommodation_move`;
- `20261016223019 / build052_advisor_hardening`;
- Security Advisor: zero findings;
- Build-052 unindexed-FK finding resolved; remaining Build-052 performance notices are INFO-only unused-index notices expected on a newly created evidence table.

New append-only table:
- `public.reservation_stay_adjustments`.

Existing canonical tables remain authoritative for the reservation, current management pricing, payments, accommodation status and audit history.

## Cost / provider impact

No new paid service, hosting project, communications provider or external API is introduced.

## Images / production variables

Build 052 adds no mandatory image asset and no new required production secret/environment variable.

## Next build

**Build 053 — Road Vehicle Registration**
