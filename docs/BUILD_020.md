# Build 020 — Polygon Plotter Core

## Status
**FULLY PROMOTED — `main` GREEN.**

## Roadmap scope
- click-to-create irregular polygons;
- explicit close-shape workflow;
- vertex add/move/delete;
- polygon validation;
- persistence against the exact active map-image version.

## Architecture
Build 020 consumes the Build 019 source-image/normalized coordinate contract. Polygon geometry stores both original-image pixels and normalized 0–1 coordinates and is bound to one Build 018 map image version.

The canonical object represented by a polygon is deliberately not assigned yet; Build 023 owns canonical map-object binding.

## Channel support
- Web/PWA: full visual plotting and editing.
- IVR/DTMF: graphical-only task; provide secure visual handoff or staff-assisted fallback.
- SMS/MMS: graphical-only task; provide secure visual handoff or staff-assisted fallback.

## Platform decision checkpoint
See `docs/PLATFORM_DECISIONS.md`. This build does not add a paid map service or any new external provider.

## Promotion evidence
- feature PR #72 passed CI, CodeQL and Secret Scan on tested head `f9b26bd4ebd4a4e7073ad30e8e13da9082df378b`;
- production PR #73 independently passed CI, CodeQL and Secret Scan from `dev` head `f7dbbb15111912e83054ae78b0d086ef45ff14ff`;
- production feature merge: `13d3d32909318347e859a0480bae54c0e61507d9`;
- hosted iCamp Supabase is current through migrations 0020, 0021 and 0022;
- hosted database verification confirms both map tables exist, the Build 020 migration is recorded, and `anon`/`authenticated` cannot select the private polygon table;
- Supabase Security Advisor reports zero findings after the hosted schema promotion.

## Manual action
No manual action was required to implement, verify, migrate or promote Build 020.
