import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateSiteAreaSquareMeters,
  evaluateCapacityRules,
  validateCapacityRuleInput,
} from "../lib/capacity-rules/core.mjs";

test("Build 033 validates scoped capacity rules", () => {
  const campground = validateCapacityRuleInput({
    scopeKind: "campground",
    maxOccupants: 6,
    maxVisitors: 4,
    maxVehicles: 2,
    notes: "Campground default.",
  });
  assert.equal(campground.scopeKind, "campground");
  assert.equal(campground.maxOccupants, 6);

  assert.throws(
    () =>
      validateCapacityRuleInput({
        scopeKind: "section",
        maxOccupants: 4,
      }),
    /Choose a campground section/u,
  );
  assert.throws(
    () =>
      validateCapacityRuleInput({
        scopeKind: "campground",
      }),
    /Set at least one/u,
  );
});

test("Build 033 calculates campsite area only from complete positive dimensions", () => {
  assert.equal(
    calculateSiteAreaSquareMeters({
      siteLengthMeters: 12.5,
      siteWidthMeters: 8,
    }),
    100,
  );
  assert.equal(
    calculateSiteAreaSquareMeters({
      siteLengthMeters: 12.5,
      siteWidthMeters: null,
    }),
    null,
  );
});

test("Build 033 resolves layered partial overrides and matching size bands", () => {
  const result = evaluateCapacityRules({
    rules: [
      {
        id: "campground",
        scopeKind: "campground",
        maxOccupants: 6,
        maxVisitors: 4,
        maxVehicles: 2,
      },
      {
        id: "type",
        scopeKind: "accommodation_type",
        accommodationKind: "campsite",
        maxOccupants: 8,
      },
      {
        id: "section",
        scopeKind: "section",
        sectionId: "section-a",
        maxVehicles: 1,
      },
      {
        id: "section-large",
        scopeKind: "section",
        sectionId: "section-a",
        minimumSiteAreaSquareMeters: 90,
        maxOccupants: 10,
      },
      {
        id: "individual",
        scopeKind: "accommodation",
        accommodationId: "site-12",
        maxVisitors: 2,
      },
    ],
    context: {
      accommodationId: "site-12",
      accommodationKind: "campsite",
      sectionId: "section-a",
      siteAreaSquareMeters: 100,
      physicalMaxOccupancy: null,
    },
    occupants: 10,
    visitors: 2,
    vehicles: 1,
  });

  assert.equal(result.eligible, true);
  assert.deepEqual(result.effectiveLimits, {
    maxOccupants: 10,
    maxVisitors: 2,
    maxVehicles: 1,
  });
  assert.deepEqual(result.appliedRuleIds, [
    "campground",
    "type",
    "section",
    "section-large",
    "individual",
  ]);
});

test("Build 033 rejects counts above effective limits", () => {
  const result = evaluateCapacityRules({
    rules: [
      {
        id: "base",
        scopeKind: "campground",
        maxOccupants: 4,
        maxVisitors: 1,
        maxVehicles: 1,
      },
    ],
    context: {
      accommodationId: "site-2",
      accommodationKind: "campsite",
      sectionId: "north",
      siteAreaSquareMeters: null,
      physicalMaxOccupancy: null,
    },
    occupants: 5,
    visitors: 2,
    vehicles: 2,
  });

  assert.equal(result.eligible, false);
  assert.equal(result.issues.length, 3);
  assert.match(result.issues.join(" "), /Occupants exceed/u);
  assert.match(result.issues.join(" "), /Visitors exceed/u);
  assert.match(result.issues.join(" "), /Vehicles exceed/u);
});

test("Build 033 treats cottage sleeping occupancy as a hard ceiling", () => {
  const result = evaluateCapacityRules({
    rules: [
      {
        id: "cottages",
        scopeKind: "accommodation_type",
        accommodationKind: "rental_cottage",
        maxOccupants: 8,
        maxVisitors: 4,
      },
    ],
    context: {
      accommodationId: "cottage-4",
      accommodationKind: "rental_cottage",
      sectionId: "cottages",
      siteAreaSquareMeters: null,
      physicalMaxOccupancy: 5,
    },
    occupants: 6,
    visitors: 2,
    vehicles: 0,
  });

  assert.equal(result.effectiveLimits.maxOccupants, 5);
  assert.equal(result.eligible, false);
  assert.equal(
    result.sources.maxOccupants?.scopeKind,
    "physical_cottage_capacity",
  );
});
