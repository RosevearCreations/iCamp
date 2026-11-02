import assert from "node:assert/strict";
import test from "node:test";

import {
  polygonBounds,
  snapMapPoint,
  translatePolygon,
  validateMapPolygonVertices,
} from "../lib/map-polygons/geometry.mjs";

const polygon = [
  { x: 100, y: 100 },
  { x: 500, y: 100 },
  { x: 500, y: 400 },
  { x: 100, y: 400 },
];

test("Build 021 translates a whole polygon without changing its shape", () => {
  const moved = translatePolygon(polygon, 25, -10, 1000, 800);
  assert.deepEqual(moved[0], { x: 125, y: 90 });
  assert.deepEqual(moved[2], { x: 525, y: 390 });
  assert.equal(validateMapPolygonVertices(moved, 1000, 800).valid, true);
  assert.deepEqual(polygonBounds(moved), {
    minX: 125,
    minY: 90,
    maxX: 525,
    maxY: 390,
    width: 400,
    height: 300,
    centerX: 325,
    centerY: 240,
  });
});

test("Build 021 refuses translations that leave the source image", () => {
  assert.throws(
    () => translatePolygon(polygon, -101, 0, 1000, 800),
    /outside the source image/u,
  );
});

test("Build 021 snaps precision points to the selected increment", () => {
  assert.deepEqual(snapMapPoint({ x: 103.2, y: 98.8 }, 5, 1000, 800), {
    x: 105,
    y: 100,
  });
  assert.deepEqual(snapMapPoint({ x: 103.24, y: 98.76 }, 0.25, 1000, 800), {
    x: 103.25,
    y: 98.75,
  });
});
