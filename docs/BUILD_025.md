# Build 025 — Campsite Types & Utility/Service Model

## Status
**IMPLEMENTED — PROMOTION IN PROGRESS.**

## Roadmap scope
- tent, RV and mixed campsite classification;
- serviced/unserviced summary plus transient, seasonal, yearly and walk-up operating profiles;
- waterfront flag;
- electrical amperage, water, sewer/septic and Wi-Fi service detail;
- site dimensions and RV fit limits;
- practical physical characteristics used by later compatibility and booking builds.

## Architecture boundary
Build 025 extends the existing Build 024 `public.campsites` subtype. It does not create a second campsite inventory and does not pre-implement Build 034 booking compatibility.

Individual utility fields are authoritative. `service_level` is a concise campground-facing summary only.

## Availability integration
Changes to campsite type, utilities, dimensions or physical characteristics advance the parent accommodation `availability_revision`. This preserves the shared Build 024 hook so later availability/compatibility systems can detect campsite-fit changes without replacing the canonical accommodation identity.

## Authorization and audit
- `accommodation.read` or `accommodation.manage` reads campsite detail through the existing forced-RLS accommodation path;
- `accommodation.manage` is required to change campsite detail;
- optimistic campsite-detail row versions prevent silent overwrite;
- changes append `accommodation.campsite.configure` audit evidence.

## Channel support
- Web/PWA: full campsite type, utility, dimension and physical-characteristic administration.
- IVR/DTMF: future guest/staff flows may read concise campsite facts by accommodation code; structural configuration remains staff-assisted.
- SMS/MMS: future flows may return concise campsite facts and compatibility guidance; configuration remains authenticated Web/PWA or staff-assisted.

## Platform impact
Build 025 remains on the existing Next.js/PostgreSQL/Supabase stack. No new Vercel project, Cloudflare project, paid mapping service or new storage resource is required.

## Promotion evidence
Promotion evidence will be recorded after the exact feature tree is verified on `dev`, the hosted migration is applied, and `main` production checks are GREEN.

## Manual action
No manual user action is expected.

## Next build
**Build 026 — Rental Cottage Model**
