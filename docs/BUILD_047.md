# Build 047 — Seasonal/Yearly Assignment Foundation

Status: **IMPLEMENTED — promotion verification in progress.**

## Scope

Build 047 turns the Build 035 seasonal-assignment availability blocker into the first operational long-term site lifecycle while retaining one canonical accommodation and availability model.

Delivered implementation:

- seasonal and yearly assignment kinds for active campsites and permanent units;
- occupant display/reference fields without creating a second guest identity model ahead of Build 048;
- explicit winterization-required handoff for later winter-readiness builds;
- Build 039 seasonal/yearly package-rate selection with immutable charge snapshot evidence;
- active/ended/cancelled non-nightly lifecycle with optimistic row-version checks;
- append-only lifecycle events and privileged audit evidence;
- campground `seasonal.manage` authorization and FORCE RLS;
- Web/PWA management desk plus verified-staff IVR/DTMF and SMS/MMS safe fallbacks.

## One authoritative inventory

Build 047 extends `public.seasonal_assignments`; it does not create a parallel long-term reservation or inventory table.

An active assignment continues to be consumed by the existing Build 035 live-availability function and `seasonal_assignments_no_live_conflict` trigger. This preserves the same concurrency authority used against reservations, temporary holds, management restrictions, turnover blockers and other active long-term assignments.

Ending or cancelling an assignment changes `assignment_state` away from `active`, which releases the Build 035 blocker without deleting the long-term record.

## Long-term pricing and charge evidence

Build 039 already owns canonical `seasonal_cents` and `yearly_cents`. Build 047 selects one applicable active rate plan that:

- matches the exact accommodation or its accommodation kind;
- covers the full assignment term;
- contains the selected seasonal or yearly package price.

`public.seasonal_assignment_charges` stores one immutable source obligation per assignment with rate-plan identity, package period, currency, amount, due date and pricing snapshot.

This build records the financial source obligation only. It does not collect card data or rewrite Build 042 reservation payment schedules. Later finance workflows can reference the immutable assignment charge when long-term billing/settlement is implemented.

## Permanent-unit integration

Build 039 rate-plan scope now recognizes `permanent_unit`, allowing future permanent units to use the same long-term package-rate model without introducing a second pricing engine.

Build 047 permits long-term assignment to campsites and permanent units only. Rental cottages remain on the transient reservation engine unless a later roadmap decision explicitly changes that policy.

## Winterization integration point

`winterization_required` is stored on the canonical assignment so later winterization/readiness records can reference the stable assignment identity and distinguish long-term units that require shutdown/readiness workflows.

Build 047 does not implement the later winterization sign-off workflow.

## Lifecycle evidence

`public.seasonal_assignment_events` is append-only and records:

- created;
- ended;
- cancelled;
- previous/next state;
- source channel;
- staff reason;
- actor and timestamp.

Mutation operations also write the existing privileged audit log using `seasonal.manage`.

## Security

- `public.seasonal_assignments`, `public.seasonal_assignment_charges` and `public.seasonal_assignment_events` FORCE RLS.
- Direct `anon` and `authenticated` access remains revoked.
- Long-term writes require campground `seasonal.manage`.
- Immutable charge/event evidence grants `icamp_app` SELECT/INSERT only; triggers reject UPDATE/DELETE.
- Actor identity is validated against transaction-local `icamp.user_id`.

## Channel support

- **Web/PWA:** full long-term assignment, charge review and lifecycle management.
- **IVR/DTMF:** verified-staff guided site/term/action equivalent; staff transfer for complex review.
- **SMS/MMS:** concise verified-staff command equivalent with secure-link handoff for long-form review.
- **Payments:** custom voice/SMS never collects raw payment-card details.

All channels use the same seasonal-assignment domain and authorization boundary.

## Free-first and portability

Build 047 adds only PostgreSQL schema/domain/application code. It introduces no new paid provider, hosting project, queue or proprietary long-term billing dependency.

## Build boundary

Build 048 remains responsible for Guest Profiles & Saved Stay Information. Later winterization, permanent-unit transfer/financing and long-term collection workflows remain separate roadmap capabilities.
