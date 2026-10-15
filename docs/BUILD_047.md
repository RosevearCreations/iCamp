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


## Promotion evidence

- exact final feature `dev` SHA `1f43ae2cf8af73397eadab9a88a1479cf82c9619`;
- feature PR #181 merged to `main`;
- production merge SHA `62bb1bcb81b3f23439ffd5e076718f3f53e11b46`;
- final `dev` gates GREEN: CI `38755058081`, CodeQL `38755057765`, Secret Scan `38755057834`;
- independent production `main` gates GREEN: CI `38755407473`, CodeQL `38755407352`, Secret Scan `38755407705`;
- hosted Supabase migrations `20261015144641 / seasonal_yearly_assignment_foundation` and `20261015144714 / build047_seasonal_assignment_event_scope_index` applied successfully;
- hosted Build 047 verification contract passed;
- Supabase Security Advisor returned zero findings;
- the Build 047 unindexed-foreign-key performance finding was closed; only expected unused-index INFO notices remain;
- no new paid provider, hosting project, database, object-storage bucket or manual operator action was required.

## Final status

**FULLY PROMOTED — `main` GREEN.**

## Next build

**Build 048 — Guest Profiles & Saved Stay Information.**
