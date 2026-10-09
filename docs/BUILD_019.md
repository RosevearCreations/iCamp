# Build 019 — Zoom/Pan Coordinate Engine

## Status

**FULLY PROMOTED — `main` GREEN.**

## Roadmap scope

Build 019 delivers:
- geometry coordinates in original-image and normalized spaces;
- one shared transform for image, future polygons, labels and hit testing;
- zoom/pan correctness;
- high-DPI correctness;
- clickable-area drift prevention.

## Delivered design

- provider-independent affine transform library;
- original-image ↔ normalized coordinate conversion;
- dual-coordinate stored-point schema/version contract;
- stored-coordinate drift validation;
- fit-to-viewport scaling;
- bounded 25%–1600% zoom;
- focal-point-preserving zoom;
- bounded CSS-pixel pan;
- invertible pointer hit testing;
- device-pixel transform derived from the CSS transform;
- interactive management inspection surface for the active Build 018 image;
- mouse, pointer/touch and keyboard controls;
- live original-image and normalized pointer readouts;
- shared image/SVG overlay transform;
- contextual circular ⓘ help and freshness controls.

## Build boundary

Build 019 **does not create or persist polygons**. Polygon creation, closing, vertex editing and polygon validation remain owned by Build 020.

No new database migration is required because Build 018 already persists the authoritative source-image dimensions. Build 019 defines the coordinate contract that future persisted geometry uses.

## Verification

Automated tests cover:
- image/normalized round trips;
- stored-coordinate drift rejection;
- fit/centre correctness;
- affine inverse round trips;
- focal-point zoom invariance;
- CSS/device-pixel equivalence at high DPI;
- repeated zoom cycles without hit-test drift;
- pan visibility bounds;
- repository/UI/help/build-boundary contracts.

## Omnichannel

- Web/PWA: full coordinate inspection and zoom/pan controls.
- IVR/DTMF: staff-assisted fallback.
- SMS/MMS: secure-link handoff.
- No telephone/text pathway bypasses map authorization.

## Cost and portability

No paid provider, mapping API, GIS subscription or new environment variable is introduced.

## Promotion evidence

- Feature PR: #68 — final feature SHA `c15c8ddb04e1c54ae4f44b91df213b2d90922e2c`.
- Feature gates: CI `37997219570`, CodeQL `37997219522`, Secret Scan `37997219686` — all GREEN.
- `dev` merge: `d06585bc6e43948f12eae54ff2a9398aeb9641c8`.
- Independent `dev` gates: CI `37997642077`, CodeQL `37997642018`, Secret Scan `37997641991` — all GREEN.
- Production PR: #69 — exact GREEN `dev` tree promoted to protected `main`.
- Production PR gates: CI `37997846595`, CodeQL `37997846651`, Secret Scan `37997846601` — all GREEN.
- Production merge: `28492a56fc6846e55db8117910096a2029e78205`.
- Independent `main` gates: CI `37998058186`, CodeQL `37998058131`, Secret Scan `37998058085` — all GREEN.
- Independent `main` CI jobs: Verify, Browser end-to-end and Database migrations — all GREEN.
- File comparison between GREEN `dev` and production merge: zero file differences; merge topology only.

## Manual action

No manual action was required to promote Build 019.

A real visual inspection later requires only an active overhead image from Build 018.
