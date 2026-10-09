import assert from "node:assert/strict";
import test from "node:test";

import {
  addPolygonVertex,
  createStoredMapPolygon,
  deletePolygonVertex,
  movePolygonVertex,
  validateMapPolygonVertices,
  validateStoredMapPolygon,
} from "../lib/map-polygons/geometry.mjs";

const square = [
  { x: 100, y: 100 },
  { x: 500, y: 100 },
  { x: 500, y: 400 },
  { x: 100, y: 400 },
];

test("Build 020 validates and stores a closed irregular polygon", () => {
  const validation = validateMapPolygonVertices(square, 1000, 800);
  assert.equal(validation.valid, true);
  assert.ok(validation.area > 0);
  const stored = createStoredMapPolygon(square, 1000, 800);
  assert.equal(stored.closed, true);
  assert.equal(stored.vertices.length, 4);
  assert.deepEqual(validateStoredMapPolygon(stored, 1000, 800), stored);
});

test("Build 020 rejects self-intersecting polygons", () => {
  const crossed = [
    { x: 100, y: 100 },
    { x: 500, y: 400 },
    { x: 500, y: 100 },
    { x: 100, y: 400 },
  ];
  const validation = validateMapPolygonVertices(crossed, 1000, 800);
  assert.equal(validation.valid, false);
  assert.match(validation.errors.join(" "), /edges cannot cross/u);
});

test("Build 020 supports vertex add move and delete", () => {
  const added = addPolygonVertex(square, 0, { x: 300, y: 100 });
  assert.equal(added.length, 5);
  const moved = movePolygonVertex(added, 1, { x: 320, y: 120 });
  assert.deepEqual(moved[1], { x: 320, y: 120 });
  const deleted = deletePolygonVertex(moved, 1);
  assert.equal(deleted.length, 4);
  assert.throws(
    () => deletePolygonVertex(square.slice(0, 3), 1),
    /at least 3 vertices/u,
  );
});
