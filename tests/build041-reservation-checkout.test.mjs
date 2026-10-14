import assert from "node:assert/strict";
import test from "node:test";

import {
  checkoutErrorCode,
  finalReservationQuote,
  normalizeCheckoutChargeSelections,
  normalizeReservationCheckoutInput,
} from "../lib/reservation-checkout/core.mjs";

test("Build 041 normalizes guest, party, compatibility and charge input", () => {
  assert.deepEqual(
    normalizeReservationCheckoutInput({
      primaryFirstName: "Ree",
      primaryLastName: "Guest",
      contactEmail: "REE@EXAMPLE.COM",
      contactPhone: "519-555-0100",
      occupants: 2,
      visitors: 1,
      pets: 1,
      vehicles: 1,
      lodgingKind: "rv",
      rvLengthMeters: "7.25",
      electricalAmperage: 30,
      needsWaterAtSite: "on",
      rulesAcknowledged: "on",
      selections: [{ code: "wifi-premium", quantity: 1 }],
    }),
    {
      primaryFirstName: "Ree",
      primaryLastName: "Guest",
      contactEmail: "ree@example.com",
      contactPhone: "519-555-0100",
      occupants: 2,
      visitors: 1,
      pets: 1,
      vehicles: 1,
      lodgingKind: "rv",
      rvLengthMeters: 7.25,
      rvWidthMeters: null,
      rvHeightMeters: null,
      electricalAmperage: 30,
      needsWaterAtSite: true,
      needsWastewaterAtSite: false,
      needsWifi: false,
      needsStepFreeAccess: false,
      needsAccessibleWashroom: false,
      selections: [{ code: "wifi-premium", quantity: 1 }],
      rulesAcknowledged: true,
    },
  );
});

test("Build 041 requires rule acknowledgement and rejects duplicate add-ons", () => {
  assert.throws(
    () =>
      normalizeReservationCheckoutInput({
        primaryFirstName: "Guest",
        primaryLastName: "Camper",
        contactEmail: "guest@example.com",
        contactPhone: "519-555-0100",
        occupants: 1,
        lodgingKind: "tent",
      }),
    /must be acknowledged/u,
  );

  assert.throws(
    () =>
      normalizeCheckoutChargeSelections([
        { code: "visitor-pass", quantity: 1 },
        { code: "visitor-pass", quantity: 2 },
      ]),
    /Duplicate booking charge selection/u,
  );
});

test("Build 041 accepts only server-authoritative final quote components", () => {
  assert.deepEqual(
    finalReservationQuote({
      stayQuote: {
        status: "quoted",
        currencyCode: "CAD",
        totalCents: 30000,
      },
      chargeQuote: {
        currencyCode: "CAD",
        totalCents: 4500,
      },
    }),
    {
      currencyCode: "CAD",
      staySubtotalCents: 30000,
      chargeTotalCents: 4500,
      totalCents: 34500,
    },
  );

  assert.throws(
    () =>
      finalReservationQuote({
        stayQuote: {
          status: "unavailable",
          currencyCode: null,
          totalCents: null,
        },
        chargeQuote: { currencyCode: "CAD", totalCents: 0 },
      }),
    /current accommodation rate/u,
  );
});

test("Build 041 maps checkout-safe errors without exposing form content", () => {
  assert.equal(
    checkoutErrorCode(new Error("ICAMP_CHECKOUT_HOLD_EXPIRED")),
    "ICAMP_CHECKOUT_HOLD_EXPIRED",
  );
  assert.equal(
    checkoutErrorCode(
      new Error("Accommodation conflicts with an active reservation"),
    ),
    "ICAMP_CHECKOUT_HOLD_REVALIDATION_FAILED",
  );
});
