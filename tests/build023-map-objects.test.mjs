import assert from "node:assert/strict";
import test from "node:test";

import {
  mapObjectKindDefinition,
  mapObjectKinds,
  validateMapObjectCode,
  validateMapObjectKind,
  validateMapObjectName,
} from "../lib/map-objects/config.mjs";

test("Build 023 covers every canonical map object family", () => {
  assert.deepEqual(
    mapObjectKinds.map((kind) => kind.key),
    [
      "site",
      "cottage",
      "permanent_unit",
      "pool",
      "washroom",
      "gate",
      "dock",
      "road",
      "building",
      "asset",
    ],
  );
  assert.equal(mapObjectKindDefinition("site")?.defaultLayerKey, "booking");
  assert.equal(
    mapObjectKindDefinition("permanent_unit")?.defaultLayerKey,
    "booking",
  );
  assert.equal(mapObjectKindDefinition("gate")?.defaultLayerKey, "security");
  assert.equal(mapObjectKindDefinition("road")?.defaultLayerKey, "utilities");
});

test("Build 023 validates canonical map identity labels and codes", () => {
  assert.equal(validateMapObjectKind("pool"), "pool");
  assert.equal(validateMapObjectCode("SITE-A.01"), "SITE-A.01");
  assert.equal(
    validateMapObjectName("Waterfront Site A1"),
    "Waterfront Site A1",
  );
  assert.throws(() => validateMapObjectKind("reservation"), /kind is invalid/u);
  assert.throws(() => validateMapObjectCode("bad code"), /1-64/u);
  assert.throws(() => validateMapObjectName(""), /between 1 and 160/u);
});
