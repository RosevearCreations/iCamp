# Build 025 — Campsite Types & Utility/Service Model

## Status
**FULLY PROMOTED — `main` GREEN.**

## Roadmap scope
- tent, RV and mixed campsite classification;
- serviced/unserviced summary plus transient, seasonal, yearly and walk-up operating profiles;
- waterfront flag;
- electrical amperage, water, sewer/septic and Wi-Fi service detail;
- site dimensions and RV fit limits;
- practical physical characteristics used by later compatibility and booking builds.

## Delivered
- extended the Build 024 canonical `public.campsites` subtype instead of creating a second campsite inventory;
- added campsite type, service level and stay profile;
- added 0/15/20/30/50A electrical service plus independent water, sewer/septic and Wi-Fi service facts;
- added site dimensions, RV length/width/height limits, waterfront, pull-through, surface, shade, fire-ring and picnic-table facts;
- preserved the Build 024 availability contract by incrementing the parent accommodation `availability_revision` when campsite fit/service data changes;
- added optimistic campsite-detail row-version conflict protection;
- added `accommodation.campsite.configure` audit evidence;
- added protected Web/PWA administration and contextual `campsite.services` help;
- retained staff-assisted/secure handoff boundaries for structural IVR/DTMF and SMS/MMS administration;
- added PostgreSQL migration verification and repository coverage.

## Architecture boundary
Build 025 extends the existing Build 024 `public.campsites` subtype. It does not create a second campsite inventory and does not pre-implement Build 034 booking compatibility.

Individual utility fields are authoritative. `service_level` is a concise campground-facing summary only.

## Availability integration
Changes to campsite type, utilities, dimensions or physical characteristics advance the parent accommodation `availability_revision`. This preserves the shared Build 024 hook so later availability/compatibility systems can detect campsite-fit changes without replacing the canonical accommodation identity.

## Authorization and audit
- `accommodation.read` or `accommodation.manage` reads campsite detail through the existing forced-RLS accommodation path;
- `accommodation.manage` is required to change campsite detail;
- optimistic campsite-detail row versions prevent silent overwrite;
- changes append `accommodation.campsite.configure` audit evidence;
- direct `anon` and `authenticated` campsite table reads remain revoked.

## Channel support
- Web/PWA: full campsite type, utility, dimension and physical-characteristic administration.
- IVR/DTMF: future guest/staff flows may read concise campsite facts by accommodation code; structural configuration remains staff-assisted.
- SMS/MMS: future flows may return concise campsite facts and compatibility guidance; configuration remains authenticated Web/PWA or staff-assisted.

## Hosted database
- Supabase project: iCamp (`cxgszmpbeswdikzofvjv`).
- Migration: `0028_campsite_types_utilities`.
- Hosted migration version: `20261012161432`.
- Hosted verification: all 21 Build 025 campsite columns present; touch and availability-revision triggers present; `anon` and `authenticated` direct SELECT remain false.
- Security Advisor after migration: zero findings.
- Performance Advisor after migration: informational unused-index observations only, expected on the new/low-traffic schema; no Build 025 unindexed-FK blocker.

## Promotion evidence
### Feature PR to `dev`
- PR #96: `Build 025 — Campsite Types & Utility/Service Model`.
- Exact feature head: `035abad61294d6b8fba46d1d98407e4910e437ed`.
- PR gates GREEN:
  - CI `38275527749`;
  - CodeQL `38275527891`;
  - Secret Scan `38275527784`.
- `dev` merge: `5e208f559ace8cf86598ffcc74c10661aada5381`.
- Independent `dev` push gates GREEN:
  - CI `38275767656`;
  - CodeQL `38275770011`;
  - Secret Scan `38275767519`.

### Production PR to `main`
- PR #97: `Build 025 — Promote Campsite Types & Utility/Service Model`.
- Production PR gates GREEN:
  - CI `38276074888`;
  - CodeQL `38276073998`;
  - Secret Scan `38276074021`.
- Production merge: `d86b5d02a5d4def4f962981d371b137f4a1ae2d0`.
- Independent `main` push gates GREEN:
  - CI `38276344528`;
  - CodeQL `38276344446`;
  - Secret Scan `38276344613`.
- CI included formatter verification, lint, typecheck, repository tests, application build, Browser E2E and clean PostgreSQL migration verification.

## Platform impact
Build 025 remains on the existing Next.js/PostgreSQL/Supabase stack. No new Vercel project, Cloudflare project, paid mapping service or new storage resource was required.

## Manual action
No manual user action was required to implement or promote Build 025.

## Next build
**Build 026 — Rental Cottage Model**
