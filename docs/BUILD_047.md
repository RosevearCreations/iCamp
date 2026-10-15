# iCamp Build 047 — Seasonal/Yearly Assignment Foundation

## Purpose

Build 047 turns the Build 035 seasonal-assignment availability placeholder into the canonical long-term campsite assignment foundation.

## Delivered scope

- Seasonal and yearly assignment kinds on the existing `public.seasonal_assignments` authority.
- Occupant display/contact context without creating a second guest or reservation inventory.
- Non-nightly lifecycle state for assigned, temporarily vacant and winter-closed sites.
- Append-style assignment lifecycle evidence for assign, winter close, reopen, end, cancel and charge snapshot actions.
- Build 039 seasonal/yearly rate-plan reuse with a charge snapshot stored on the assignment.
- Campground-scoped RLS using `campground.operations.manage`.
- Existing Build 035 advisory-lock/conflict trigger remains the final inventory authority.
- Winter closure remains an active assignment and therefore continues blocking transient booking availability.

## Channel contract

- Web/PWA: server domain/service foundation is available for the management UI.
- IVR/DTMF: staff-assisted/status workflows may read this same canonical assignment state; no long-term contract acceptance is performed by keypad in this build.
- SMS/MMS: secure-link/staff-assisted fallback; no sensitive long-term agreement terms are accepted by plain SMS in this build.

## Security/privacy

Direct anon/authenticated access remains denied. The application role requires campground-scoped operations permission. Lifecycle evidence is RLS protected. No payment credentials or provider secrets are stored.

## Cost/portability

No new paid service, hosting project, database, storage bucket or provider. The build remains PostgreSQL/Next.js portable.

## Boundary

Build 047 does not perform winterization inspections/sign-off, permanent-unit ownership transfer, financing, or payment-provider collection. Those remain later roadmap work.
