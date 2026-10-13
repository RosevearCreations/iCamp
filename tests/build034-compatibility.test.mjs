import assert from "node:assert/strict";
import test from "node:test";

import { assertCompatibleBookingChoice, evaluateAccommodationCompatibility } from "../lib/accommodation-compatibility/core.mjs";

const rvSite = {
  id: "site-1", accommodationKind: "campsite", campsiteType: "rv",
  maxRvLengthMeters: 12, maxRvWidthMeters: 3.5, maxRvHeightMeters: 4.2,
  electricalAmperage: 50, waterService: "site", wastewaterService: "sewer", wifiService: "shared",
  accessibleSite: true, petsAllowed: true, maxPets: 2,
};

test("Build 034 accepts a compatible RV request", () => {
  const result = evaluateAccommodationCompatibility({
    accommodation: rvSite,
    request: { lodgingKind: "rv", occupants: 4, pets: 1, rvLengthMeters: 10, rvWidthMeters: 3, rvHeightMeters: 3.8, electricalAmperage: 30, needsWaterAtSite: true, needsWastewaterAtSite: true, needsWifi: true, needsStepFreeAccess: true },
    capacity: { eligible: true, issues: [] },
  });
  assert.equal(result.eligible, true);
});

test("Build 034 rejects incompatible RV dimensions, utilities and pets", () => {
  const result = evaluateAccommodationCompatibility({
    accommodation: { ...rvSite, petsAllowed: false, maxPets: 0 },
    request: { lodgingKind: "rv", occupants: 4, pets: 1, rvLengthMeters: 13, electricalAmperage: 50, needsWaterAtSite: true },
    capacity: { eligible: false, issues: ["Vehicles exceed the effective maximum of 1."] },
  });
  assert.equal(result.eligible, false);
  assert.match(result.issues.join(" "), /RV length exceeds/u);
  assert.match(result.issues.join(" "), /Pets are not allowed/u);
  assert.match(result.issues.join(" "), /Vehicles exceed/u);
});

test("Build 034 evaluates cottage accessibility and features", () => {
  const result = evaluateAccommodationCompatibility({
    accommodation: {
      id: "cottage-1", accommodationKind: "rental_cottage", physicalMaxOccupancy: 4,
      stepFreeAccess: false, accessibleWashroom: false, kitchenType: "none", washroomType: "shared", showerType: "shared",
      hasRefrigerator: false, petsAllowed: false, maxPets: 0,
    },
    request: { lodgingKind: "cottage", occupants: 5, pets: 1, needsStepFreeAccess: true, needsAccessibleWashroom: true, requiredFeatures: ["kitchen","private_washroom","private_shower","refrigerator"] },
    capacity: { eligible: true, issues: [] },
  });
  assert.equal(result.eligible, false);
  assert.ok(result.issues.length >= 8);
});

test("Build 034 exposes a throwing server rejection contract", () => {
  assert.throws(() => assertCompatibleBookingChoice({
    accommodation: rvSite,
    request: { lodgingKind: "tent", occupants: 2 },
    capacity: { eligible: true, issues: [] },
  }), (error) => error.code === "ICAMP_ACCOMMODATION_INCOMPATIBLE");
});
