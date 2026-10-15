# iCamp Build 047 — Seasonal/Yearly Assignment Foundation

Status: **FULLY PROMOTED — `main` GREEN.**

## Purpose

Build 047 turns the Build 035 seasonal-assignment availability authority into the canonical long-term campsite/permanent-unit assignment foundation without creating a second reservation inventory.

## Delivered scope

- Seasonal and yearly assignment kinds on the existing `public.seasonal_assignments` authority.
- Active seasonal/yearly campsite assignment plus permanent-unit integration.
- Occupant display/contact/reference context ahead of Build 048 guest profiles.
- Non-nightly assigned, winter-closed, ended and cancelled lifecycle states.
- Stable `winterization_required` handoff for later winterization/readiness sign-off builds.
- Build 039 seasonal/yearly package-rate reuse with server-derived canonical charge snapshot.
- Database-enforced immutable assignment identity/term/charge fields after creation.
- Append-only lifecycle evidence for assignment, charge recording, winter close, reopen, end and cancel.
- Advisory locking, optimistic row-version lifecycle updates and privileged audit evidence.
- Exact campground `seasonal.manage` authorization with FORCE RLS and denied direct anon/authenticated access.
- Discoverable Web/PWA management desk.
- Verified-staff IVR/DTMF status/guided-action parity and SMS/MMS concise-command/secure-link fallback.

## One authoritative availability model

Build 047 extends the existing Build 035 `seasonal_assignments` table and keeps `seasonal_assignments_no_live_conflict` as the final overlap authority.

An active long-term assignment blocks transient booking availability whether its occupancy state is assigned or winter closed. Ending or cancelling moves the assignment out of `active` and releases the existing Build 035 blocker without deleting history.

No parallel long-term reservation or availability table is introduced.

## Canonical long-term pricing

The operator chooses a Build 039 rate plan; the server derives the package charge from `seasonal_cents` or `yearly_cents`.

The service validates:
- the rate plan is active and covers the full term;
- the plan matches the exact accommodation or its accommodation kind;
- the campsite stay profile matches seasonal/yearly assignment kind;
- permanent units use the same canonical rate-plan engine;
- any legacy caller-supplied amount/currency must match the server-derived canonical values.

After creation, the accommodation, term, assignment kind, rate-plan identity, amount, currency and charge due date are database-immutable.

Build 047 records the source obligation only. Later finance workflows own collection and settlement.

## Winterization and permanent-unit handoff

Winter close changes only the non-nightly occupancy state; the assignment remains active and therefore continues blocking transient availability. Reopen restores assigned occupancy.

`winterization_required` provides the stable Build 047 handoff flag for later inspection/sign-off workflows.

Permanent units are accepted by the same long-term service and Build 039 pricing scope. Ownership transfer, financing and sale workflows remain later roadmap work.

## Security and evidence

- `public.seasonal_assignments` and `public.seasonal_assignment_events` FORCE RLS.
- Direct `anon`/`authenticated` access to lifecycle evidence remains revoked.
- Long-term writes use `seasonal.manage`, not the broader campground operations permission.
- Lifecycle events grant `icamp_app` SELECT/INSERT only and have an UPDATE/DELETE rejection trigger.
- Canonical assignment identity/term/charge fields have a database mutation guard.
- Actor identity is checked through transaction-local `icamp.user_id`.
- Creation and lifecycle transitions append privileged audit events.
- Raw payment-card data is never stored by Build 047.

## Channel contract

- **Web/PWA:** full long-term assignment, pricing review and lifecycle management.
- **IVR/DTMF:** verified-staff status and guided lifecycle actions; complex agreement review transfers to staff/Web.
- **SMS/MMS:** concise verified-staff commands or secure-link handoff.
- **Payments:** no raw card capture through custom voice/SMS; later finance builds own settlement.

All channels invoke the same long-term domain and `seasonal.manage` authorization boundary.

## Cost and portability

No paid service, new hosting project, proprietary queue or second database is introduced. The implementation remains PostgreSQL/Next.js portable.

## Build boundary

Build 048 remains responsible for Guest Profiles & Saved Stay Information. Detailed winterization inspection/sign-off, permanent-unit transfer/financing and long-term payment collection remain later roadmap capabilities.


## Final production evidence

- Production `main` and synchronized `dev`: `49522aacad8eaa8f74ed4593cbfb7368d811112f`.
- Hardening PR #184; production PR #185.
- Hosted Supabase hardening migration: `20261015150438 / build047_production_hardening`.
- Main-push CI, Browser E2E, database migration verification, CodeQL and Secret Scan: GREEN.
