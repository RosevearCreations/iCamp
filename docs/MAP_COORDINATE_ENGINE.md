# iCamp Map Coordinate Engine

Build 019 establishes the canonical coordinate and viewport-transform contract for the virtually realistic campground map.

## Coordinate spaces

Every future geometry point is represented in two linked spaces:

1. **Original-image pixels** — precise x/y coordinates measured against the active source image dimensions recorded by Build 018.
2. **Normalized 0–1 coordinates** — x/sourceWidth and y/sourceHeight, independent of CSS size, viewport size and device-pixel ratio.

The canonical stored-point helper records both representations with coordinate schema version 1. Validation recomputes normalized values from the original-image coordinates and rejects pairs that have drifted beyond tolerance.

Build 019 does not create or persist polygons. Build 020 owns polygon creation and will consume this coordinate contract.

## Shared affine transform

One six-value affine matrix maps original-image coordinates into CSS viewport coordinates.

The same matrix is used for:
- the overhead raster image;
- the diagnostic source frame and overlay layer;
- future polygon/layer rendering;
- future label placement;
- pointer hit-testing through the exact inverse matrix.

There is no independent scaling formula for clicks. This prevents clickable-area drift as zoom and pan change.

## Zoom

Zoom is bounded from 25% to 1600% of the fit-to-viewport scale.

Mouse-wheel/button zoom can be anchored at a viewport point. Before changing scale, the engine resolves the source-image point under the anchor through the inverse matrix. It then derives the new pan offset so that source point remains under the same viewport position.

This focal-point invariant is covered by automated tests, including repeated zoom-in/zoom-out cycles.

## Pan

Pan is expressed in CSS viewport pixels after fit/zoom scaling. Bounds keep a minimum portion of the source image visible so an operator cannot accidentally lose the entire map off-screen.

Pointer dragging and keyboard arrow controls both use the same bounded view state.

## High-DPI rendering

Source coordinates never change with device pixel ratio.

The engine derives a device-pixel matrix by multiplying the CSS transform by the device pixel ratio. Automated tests prove that:
- source → CSS viewport → device pixels; and
- source → device matrix

produce the same point.

This lets future canvas/WebGL or high-DPI overlay renderers use physical device pixels without changing hit-testing or persisted geometry.

## Management inspection surface

Authorized users with `campground.map` can open:

`/workspaces/management/campgrounds/maps/coordinate-engine`

The surface:
- loads the active Build 018 image through the existing authorized signed-media route;
- supports mouse/touch pointer pan;
- supports wheel/buttons for zoom;
- supports keyboard arrows, +/− and 0/reset;
- shows source-image and normalized pointer coordinates;
- displays CSS and high-DPI scale information;
- draws the source frame and centre marker through the shared transform.

## Omnichannel

Zoom/pan inspection and coordinate plotting are inherently visual.

- Web/PWA: full visual coordinate engine.
- IVR/DTMF: staff-assisted fallback.
- SMS/MMS: secure-link handoff to the authenticated visual editor.
- Later non-visual commands may reference stable map object identifiers after Build 023 binding exists.

## Security and privacy

- The coordinate surface reuses `campground.map` authorization.
- The image URL still comes from Build 008/018 signed private-media access.
- No provider URL, storage secret or raw image bytes are persisted by the coordinate engine.
- Pointer coordinates remain transient in the browser.
- Build 019 introduces no new personal-data collection.

## Cost and portability

No paid provider, external mapping API, proprietary GIS dependency or new environment variable is required.

The engine uses ordinary affine math and the existing application/browser platform so future rendering technology can change without changing stored campground geometry.
