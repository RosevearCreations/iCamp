# Build 020 — Polygon Plotter Core

## Status
**IN DEVELOPMENT — feature branch verification pending.**

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

## Manual action
No manual action is required to implement or promote Build 020.
