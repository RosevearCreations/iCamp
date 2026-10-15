# Build 046 — Walk-Up, Overflow & Office Booking

Status: **IMPLEMENTED — promotion verification in progress.**

## Scope

Build 046 extends the Build 044 reservation-management console with front-office intake while preserving the existing booking authorities.

Delivered implementation:

- explicit office, walk-up and overflow booking modes;
- walk-up inventory derived from campsite `stay_profile = 'walk_up'`;
- configurable named overflow areas whose members are existing canonical accommodations;
- server-authoritative Build 035 live availability for every walk-up and overflow inventory view;
- canonical `public.reservations` creation through the Build 044 pricing/change-history path;
- server rejection when a walk-up choice is not a walk-up campsite;
- server rejection when an overflow choice is not a member of the selected active overflow area;
- append-only reservation office-intake evidence;
- campground-scoped overflow configuration with audit evidence;
- Web/PWA front-office workbench plus verified-staff IVR/DTMF and SMS/MMS safe fallbacks.

## Canonical inventory rule

Build 046 deliberately does not create a parallel overflow reservation table.

An overflow area is a named grouping of existing `public.accommodations`. The actual reservation always references one canonical accommodation and therefore remains protected by the Build 035 reservation conflict trigger, temporary holds, management restrictions, turnover blockers and seasonal-assignment blockers.

Walk-up inventory is also canonical. A campsite is eligible for walk-up intake only when its Build 025 `stay_profile` is `walk_up`.

## Office intake evidence

`public.reservation_office_intake` stores one append-only intake record per office-created reservation:

- booking mode: office, walk-up or overflow;
- optional overflow-area link;
- optional front-office note;
- source channel;
- idempotency key;
- staff recorder and timestamp.

The intake row does not replace the Build 044 management state or change history. It adds the front-office classification required by this build.

## Overflow configuration

`public.campground_overflow_areas` stores campground-scoped named areas.

`public.campground_overflow_area_members` binds those areas to canonical accommodations. Membership is configuration data and requires `campground.configuration`.

Reservation staff may read the configured areas and authoritative availability, while only authorized configuration staff may create areas or replace memberships.

## Availability and concurrency

The office workbench calls `icamp_private.live_accommodation_availability(uuid,date,date)` for the selected date window.

Reservation creation still inserts into `public.reservations`, so the Build 035 `reservations_no_live_conflict` trigger remains the final concurrency authority even if the page becomes stale between review and submit.

## Pricing, payments and refunds

Build 046 reuses:

- Build 039 current rate plans and dynamic pricing;
- Build 040 booking charges;
- Build 044 reservation management state and append-only change history;
- Build 045 refund/adjustment safeguards when later financial review is required.

Build 046 does not add a second pricing, payment or refund engine.

## Authorization and evidence

- office/walk-up/overflow creation: `reservation.create`;
- inventory read: existing reservation read/create/modify/cancel authority;
- overflow configuration: `campground.configuration`;
- office intake is append-only;
- all Build 046 public tables FORCE RLS;
- direct `anon` and `authenticated` table access remains denied;
- overflow configuration writes append Build 006 audit evidence.

## Channel parity

- **Web/PWA:** full office, walk-up and overflow booking workbench and authorized overflow configuration.
- **IVR/DTMF:** verified staff can use concise canonical reservation commands; multi-option inventory review uses staff-assisted fallback.
- **SMS/MMS:** verified staff can use concise office-booking commands with secure-link fallback for complex availability review.
- No custom voice/SMS flow collects payment credentials.

## Cost and portability

No paid provider, new hosting project, Worker, D1 database, R2 bucket or external booking system is introduced.

Build 046 uses the existing PostgreSQL/Supabase backend, Next.js application, reservation/pricing engines, authorization layer and audit ledger.

## Build boundary

Build 047 remains responsible for seasonal/yearly assignment lifecycle and non-nightly long-term charges.

## Promotion evidence

Promotion evidence will be recorded after feature, `dev`, hosted database and production `main` gates are independently GREEN.
