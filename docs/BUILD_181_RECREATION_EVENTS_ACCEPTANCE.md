# Build 181 — Events & Recreation Discovery, Capacity & Registration

## Customer experience

- `/events` displays **only campground-published, active-property, current/future activities** with the property-local date/time and timezone, a venue, plain-language description, age guidance and optional staff-provided accessibility information. Missing accessibility detail is identified rather than inferred. Keyword, category and property filters use a bounded live database query. No synthetic events appear in empty schedules.
- Each activity discloses remaining **provisional request places**, calculated from submitted and reviewed requests under an atomic per-event database lock. Capacity is **not confirmed admission**, seat inventory, a paid ticket or a booking hold.
- `/guest/events` requires an active guest account and a guest-owned, confirmed or checked-in reservation covering the event's campground-local date. The request is linked to that real reservation and may contain up to 20 people; an idempotent request identifier prevents accidental double allocation. Existing requests are visible privately and can be withdrawn, releasing provisional request capacity.
- Missing database connectivity fails closed with human instructions, not an invented available capacity or successful registration claim.

## Internal functionality and controls

- Campground staff with `event.manage` may create and update private activities, explicitly publish them, open or close request intake and cancel activities in `/workspaces/management/campgrounds/events`.
- Event updates are optimistic-version checked and cannot lower request capacity below currently allocated provisional places. Every write is audited with the actor, campground and bounded state transition. Private events and requests use tenant-scoped foreign keys, FORCE RLS and explicit deny policies for the untrusted application role; anonymous/authenticated direct grants are revoked.
- Staff request review supports `reviewed` and `declined` only: **reviewed does not mean accepted**. A declined or withdrawn request frees its slots. Neither staff nor guest action charges a payment method, confirms ticketing, sends an external message, changes the reservation or opens a venue/gate.
- The route is accessible from public discovery, the authenticated My Stay hub and campground management. All forms have visible labels and status/error messages; a secure staff-assisted office path remains available for nonvisual/telephone/text users without sending live outbound messages.

## Release and verification

1. Migration: `database/migrations/0191_build181_recreation_events_registration.sql`; verification: `database/verify/0191_build181_recreation_events_registration.sql`.
2. Feature checks: `tests/build181-recreation-events.test.mjs`; repository `npm run verify` and `npm run parity:verify`.
3. GitHub CI, database verification, CodeQL and secret scanning; Vercel Preview READY and SHA; then non-force `dev → main` merge and Vercel Production READY, exact SHA health and runtime error readback.

**HELD:** billing, charges, refunds, ticket issuance, external SMS/voice/email, IVR/DTMF transaction execution, admission/gate control and live dispatch. The nonvisual parity path is a staffed campground office handoff, not a claim of operative omnichannel registration.

## Next build

**Build 182 — Amenity/Equipment Rental Availability & Reservation Planner (Billing / Omnichannel HELD).** Source-backed amenity and equipment discovery, request availability by dates and safe rental planning without payments, final allocation or external messaging.
