import assert from "node:assert/strict";
import test from "node:test";

import {
  accommodationKinds,
  accommodationMapObjectKind,
  createAvailabilityHook,
  createStatusHook,
  validateAccommodationKind,
} from "../lib/accommodations/hooks.mjs";

test("Build 024 exposes the three canonical accommodation families", () => {
  assert.deepEqual(accommodationKinds, [
    "campsite",
    "rental_cottage",
    "permanent_unit",
  ]);
  assert.equal(accommodationMapObjectKind("campsite"), "site");
  assert.equal(accommodationMapObjectKind("rental_cottage"), "cottage");
  assert.equal(accommodationMapObjectKind("permanent_unit"), "permanent_unit");
  assert.throws(
    () => validateAccommodationKind("hotel_room"),
    /kind is invalid/u,
  );
});

test("Build 024 shared hooks are lifecycle-aware without inventing Build 030 states", () => {
  const source = {
    id: "accommodation-1",
    campgroundId: "campground-1",
    kind: "campsite",
    lifecycleState: "active",
    availabilityRevision: 3,
    statusRevision: 4,
  };
  assert.deepEqual(createAvailabilityHook(source), {
    accommodationId: "accommodation-1",
    campgroundId: "campground-1",
    kind: "campsite",
    lifecycleState: "active",
    revision: 3,
    inventoryEligible: true,
  });
  assert.deepEqual(createStatusHook(source), {
    accommodationId: "accommodation-1",
    campgroundId: "campground-1",
    kind: "campsite",
    lifecycleState: "active",
    revision: 4,
  });
  assert.equal(
    createAvailabilityHook({ ...source, lifecycleState: "inactive" })
      .inventoryEligible,
    false,
  );
});
