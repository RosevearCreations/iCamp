import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateReservationFinancialDelta,
  classifyReservationChange,
  normalizeReservationManagementInput,
  parseManagementChargeSelections,
} from "../lib/reservation-management/core.mjs";

test("Build 044 parses optional managed charge selections", () => {
  assert.deepEqual(parseManagementChargeSelections("wifi:1,extra-vehicle:2"), [
    { code: "wifi", quantity: 1 },
    { code: "extra-vehicle", quantity: 2 },
  ]);
});

test("Build 044 validates managed reservation dates and guest input", () => {
  const input = normalizeReservationManagementInput({
    accommodationId: "123e4567-e89b-12d3-a456-426614174000",
    arrivalDate: "2027-07-01",
    departureDate: "2027-07-04",
    guestDisplayName: "Guest Example",
    contactEmail: "guest@example.com",
    chargeSelections: "wifi:1",
  });

  assert.equal(input.arrivalDate, "2027-07-01");
  assert.equal(input.departureDate, "2027-07-04");
  assert.equal(input.selections[0].code, "wifi");
});

test("Build 044 classifies move, extend, shorten, fees and cancel", () => {
  const base = {
    status: "confirmed",
    accommodationId: "a",
    arrivalDate: "2027-07-01",
    departureDate: "2027-07-04",
    currentTotalCents: 30000,
    chargeSelections: [],
  };

  assert.equal(
    classifyReservationChange(base, { ...base, accommodationId: "b" }),
    "move",
  );
  assert.equal(
    classifyReservationChange(base, {
      ...base,
      departureDate: "2027-07-05",
    }),
    "extend",
  );
  assert.equal(
    classifyReservationChange(base, {
      ...base,
      departureDate: "2027-07-03",
    }),
    "shorten",
  );
  assert.equal(
    classifyReservationChange(base, {
      ...base,
      currentTotalCents: 32000,
    }),
    "fees",
  );
  assert.equal(
    classifyReservationChange(base, { ...base, status: "cancelled" }),
    "cancel",
  );
});

test("Build 044 flags paid financial changes for Build 045 review", () => {
  const changed = calculateReservationFinancialDelta({
    previousTotalCents: 30000,
    revisedTotalCents: 34000,
    capturedCents: 10000,
    hasPaymentSchedule: true,
  });
  assert.equal(changed.deltaCents, 4000);
  assert.equal(changed.financialReviewRequired, true);

  const cancellation = calculateReservationFinancialDelta({
    previousTotalCents: 30000,
    revisedTotalCents: 30000,
    capturedCents: 10000,
    hasPaymentSchedule: true,
    cancelled: true,
  });
  assert.equal(cancellation.financialReviewRequired, true);
  assert.match(cancellation.financialReviewReason, /Build 045/u);
});
