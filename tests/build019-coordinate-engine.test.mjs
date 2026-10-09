import assert from "node:assert/strict";
import test from "node:test";

import {
  applyAffineMatrix,
  constrainMapPan,
  createMapViewportTransform,
  createStoredMapPoint,
  imagePointToNormalized,
  imagePointToViewport,
  normalizedPointToImage,
  validateStoredMapPoint,
  viewportPointToDevice,
  viewportPointToImage,
  zoomMapAtViewportPoint,
} from "../lib/map-coordinates/transform.mjs";

function close(actual, expected, tolerance = 1e-8) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    "Expected " + actual + " to be within " + tolerance + " of " + expected,
  );
}

test("Build 019 pixel and normalized coordinates round-trip without drift", () => {
  const image = { x: 1234.5, y: 987.25 };
  const normalized = imagePointToNormalized(image, 4096, 3072);
  const restored = normalizedPointToImage(normalized, 4096, 3072);

  close(restored.x, image.x, 1e-8);
  close(restored.y, image.y, 1e-8);

  const stored = createStoredMapPoint(image, 4096, 3072);
  assert.equal(stored.schemaVersion, 1);
  assert.deepEqual(validateStoredMapPoint(stored, 4096, 3072), stored);
});

test("Build 019 rejects stored coordinate pairs that have drifted", () => {
  const stored = createStoredMapPoint({ x: 1024, y: 768 }, 4096, 3072);
  assert.throws(
    () =>
      validateStoredMapPoint(
        {
          ...stored,
          normalized: { x: stored.normalized.x + 0.01, y: stored.normalized.y },
        },
        4096,
        3072,
      ),
    /have drifted/u,
  );
});

test("Build 019 fit transform centres the source image", () => {
  const transform = createMapViewportTransform({
    sourceWidth: 4000,
    sourceHeight: 2000,
    viewportWidth: 1000,
    viewportHeight: 500,
  });

  assert.equal(transform.fitScale, 0.25);
  assert.deepEqual(imagePointToViewport({ x: 2000, y: 1000 }, transform), {
    x: 500,
    y: 250,
  });
});

test("Build 019 image and viewport transforms are exact inverses", () => {
  const transform = createMapViewportTransform({
    sourceWidth: 4000,
    sourceHeight: 2000,
    viewportWidth: 1000,
    viewportHeight: 500,
    zoom: 2,
    panX: 80,
    panY: -40,
  });
  const image = { x: 1000, y: 700 };
  const viewport = imagePointToViewport(image, transform);
  const restored = viewportPointToImage(viewport, transform);

  close(restored.x, image.x);
  close(restored.y, image.y);
});

test("Build 019 zoom keeps the source point under the focal anchor", () => {
  const dimensions = {
    sourceWidth: 4000,
    sourceHeight: 2000,
    viewportWidth: 1000,
    viewportHeight: 500,
    devicePixelRatio: 2,
  };
  const anchor = { x: 250, y: 125 };
  const before = createMapViewportTransform({
    ...dimensions,
    zoom: 1,
    panX: 0,
    panY: 0,
  });
  const sourceAtAnchor = viewportPointToImage(anchor, before);
  const nextView = zoomMapAtViewportPoint(
    { zoom: 1, panX: 0, panY: 0 },
    anchor,
    dimensions,
    2,
  );
  const after = createMapViewportTransform({
    ...dimensions,
    ...nextView,
  });
  const sourceAfter = viewportPointToImage(anchor, after);

  close(sourceAfter.x, sourceAtAnchor.x);
  close(sourceAfter.y, sourceAtAnchor.y);
});

test("Build 019 high-DPI matrix is CSS-equivalent in device pixels", () => {
  const transform = createMapViewportTransform({
    sourceWidth: 4096,
    sourceHeight: 3072,
    viewportWidth: 900,
    viewportHeight: 600,
    zoom: 1.75,
    panX: 47,
    panY: -29,
    devicePixelRatio: 2.5,
  });
  const image = { x: 1700, y: 900 };
  const css = imagePointToViewport(image, transform);
  const deviceFromViewport = viewportPointToDevice(css, transform);
  const deviceFromSource = applyAffineMatrix(transform.deviceMatrix, image);

  close(deviceFromSource.x, deviceFromViewport.x);
  close(deviceFromSource.y, deviceFromViewport.y);
});

test("Build 019 repeated zoom cycles do not move the hit-tested source point", () => {
  const dimensions = {
    sourceWidth: 5000,
    sourceHeight: 3500,
    viewportWidth: 1200,
    viewportHeight: 720,
    devicePixelRatio: 1.5,
  };
  const anchor = { x: 730, y: 410 };
  let view = { zoom: 1, panX: 0, panY: 0 };
  const initialTransform = createMapViewportTransform({
    ...dimensions,
    ...view,
  });
  const initialSource = viewportPointToImage(anchor, initialTransform);

  for (let index = 0; index < 20; index += 1) {
    view = zoomMapAtViewportPoint(view, anchor, dimensions, view.zoom * 1.08);
    view = zoomMapAtViewportPoint(view, anchor, dimensions, view.zoom / 1.08);
  }

  const finalTransform = createMapViewportTransform({
    ...dimensions,
    ...view,
  });
  const finalSource = viewportPointToImage(anchor, finalTransform);

  close(finalSource.x, initialSource.x, 1e-6);
  close(finalSource.y, initialSource.y, 1e-6);
});

test("Build 019 pan constraints keep part of the source image visible", () => {
  const dimensions = {
    sourceWidth: 4000,
    sourceHeight: 3000,
    viewportWidth: 800,
    viewportHeight: 600,
  };
  const view = constrainMapPan(
    { zoom: 2, panX: 99999, panY: -99999 },
    { ...dimensions, minimumVisible: 48 },
  );
  const transform = createMapViewportTransform({
    ...dimensions,
    ...view,
  });

  assert.ok(transform.cssMatrix.e <= dimensions.viewportWidth - 48);
  assert.ok(transform.cssMatrix.e + transform.renderedWidth >= 48);
  assert.ok(transform.cssMatrix.f <= dimensions.viewportHeight - 48);
  assert.ok(transform.cssMatrix.f + transform.renderedHeight >= 48);
});
