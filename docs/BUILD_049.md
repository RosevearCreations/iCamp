# Build 049 — Front Desk Check-In

Status: **IMPLEMENTED — promotion status is determined by exact GitHub and hosted-database gates.**

## Purpose

Build 049 creates the operational arrival checkpoint between a booked reservation and an occupied stay. It changes the existing canonical reservation to `checked_in`; it does not introduce a parallel stay or inventory model.

## Delivered

- campground-scoped Front Desk arrival queue for pending, confirmed and checked-in reservations;
- server-authoritative campground-local arrival-date gate;
- live reservation balance verification from current reservation state, Build 042 payment schedule and captured payments;
- manager-only `reservation.override` path for unresolved balance/financial-review exceptions, with required reason and high-risk audit evidence;
- Build 033 capacity-rule revalidation for occupants, visitors and vehicles at arrival;
- campsite/cottage pet-rule revalidation;
- optional matching of Build 048 saved vehicle and pet descriptions into immutable arrival evidence;
- explicit current-rules acknowledgement;
- immutable `public.reservation_check_ins` evidence;
- append-only rental, store add-on and access-credential handoff requests;
- optimistic reservation row-version guard and advisory locking;
- canonical reservation transition from `pending`/`confirmed` to `checked_in`;
- direct `anon`/`authenticated` table access denied and `icamp_app` RLS boundary;
- Web/PWA operator surface at `/workspaces/management/campgrounds/reservations/check-in`.

## Successor boundaries

Build 049 verifies and snapshots only what is needed to complete arrival safely:

- **Build 053** remains the authority for road-vehicle plate/jurisdiction registration.
- **Build 055** remains the authority for formal visitor registration and site-specific visitor records.
- **Build 056/063** remain the authority for access credential issuance, activation, revocation and checkout return.
- rental/store items are recorded as requested handoffs only; they are not charged, issued or fulfilled by Build 049.
- Build 050 owns checkout and accommodation-turnover triggering.

## Financial safety

Normal Front Desk check-in is blocked while an outstanding payable balance or Build 044 financial-review flag remains. Only an actor with `reservation.override` may explicitly continue, and that exception requires a reason and produces high-risk audit evidence.

No raw payment-card details are collected or stored.

## Channel parity

- **Web/PWA:** full arrival queue, counts, balance/capacity/pet verification, saved-stay matching, rules acknowledgement and check-in.
- **IVR/DTMF:** verified staff can use concise arrival/count/rules confirmation through the same server service; complex financial review and overrides fall back to authenticated staff Web/PWA.
- **SMS/MMS:** verified staff receives concise status and secure-link handoff; sensitive guest data is not echoed before verification.

## Database

Migration: `database/migrations/0061_front_desk_check_in.sql`.

Verification: `database/verify/0061_front_desk_check_in.sql`.

Advisor hardening: `database/migrations/0062_build049_advisor_hardening.sql` with matching verification in `database/verify/0062_build049_advisor_hardening.sql`.

Primary tables:

- `public.reservation_check_ins`;
- `public.reservation_check_in_requests`.

Both evidence tables are append-only. Check-in still updates the existing `public.reservations.status` field that has supported `checked_in` since Build 035.

## Cost / provider impact

No new paid service, Vercel project, Cloudflare project, communications provider or external API is introduced by Build 049.

## Next build

**Build 050 — Check-Out & Accommodation Turnover Trigger**


## Hosted advisor hardening

After migration 0061 was applied to hosted Supabase, Security Advisor reported zero findings. Performance Advisor identified two INFO-level composite foreign-key paths on `public.reservation_check_ins` without matching leading indexes. Migration 0062 adds those covering indexes before production promotion.
