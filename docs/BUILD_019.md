# Build 019 — Zoom/Pan Coordinate Engine

## Status

**IN DEVELOPMENT — feature branch verification pending.**

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

## Manual action

No manual action is required to promote this build.

A real visual inspection later requires only an active overhead image from Build 018.
