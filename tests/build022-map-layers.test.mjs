import assert from "node:assert/strict";
import test from "node:test";

import {
  mapLayerDefinitions,
  mapLayerVisibilityPermissionKeys,
  validateLayerDisplayName,
  validateLayerIconKey,
  validateLayerVisibilityPermissionKey,
  validateMapLabel,
  validatePolygonIconKey,
} from "../lib/map-layers/config.mjs";

test("Build 022 defines all six ordered operational map layers", () => {
  assert.deepEqual(
    mapLayerDefinitions.map((layer) => layer.key),
    [
      "booking",
      "maintenance",
      "security",
      "utilities",
      "amenities",
      "management",
    ],
  );
  assert.deepEqual(
    mapLayerDefinitions.map((layer) => layer.sortOrder),
    [10, 20, 30, 40, 50, 60],
  );
});

test("Build 022 validates layer visibility permissions and icon vocabulary", () => {
  assert.ok(mapLayerVisibilityPermissionKeys.includes("reservation.read"));
  assert.ok(mapLayerVisibilityPermissionKeys.includes("maintenance.read"));
  assert.ok(mapLayerVisibilityPermissionKeys.includes("access.events.read"));
  assert.equal(validateLayerIconKey("calendar"), "calendar");
  assert.equal(validatePolygonIconKey("tent"), "tent");
  assert.equal(validatePolygonIconKey(""), null);
  assert.equal(
    validateLayerVisibilityPermissionKey("campground.map"),
    "campground.map",
  );
  assert.throws(() => validateLayerIconKey("javascript"), /icon is invalid/u);
  assert.throws(
    () => validateLayerVisibilityPermissionKey("unknown.permission"),
    /visibility permission is invalid/u,
  );
});

test("Build 022 bounds layer names and map-facing labels", () => {
  assert.equal(validateLayerDisplayName("Booking"), "Booking");
  assert.equal(validateMapLabel("Site A12"), "Site A12");
  assert.throws(() => validateLayerDisplayName(""), /between 1 and 80/u);
  assert.throws(() => validateMapLabel(""), /between 1 and 160/u);
});
