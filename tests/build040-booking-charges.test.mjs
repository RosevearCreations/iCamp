import assert from "node:assert/strict";
import test from "node:test";

import {
  bookingChargePriceLabel,
  listApplicableBookingCharges,
  quoteBookingCharges,
} from "../lib/booking-charges/core.mjs";

const catalog = [
  {
    id: "wifi",
    scopeKind: "campground",
    accommodationKind: null,
    accommodationId: null,
    chargeKind: "add_on",
    applicationMode: "optional",
    code: "wifi-premium",
    displayName: "Premium Wi-Fi",
    currencyCode: "CAD",
    pricingBasis: "per_night",
    unitPriceCents: 1000,
    percentageBasisPoints: null,
    unitLabel: "connection",
    minimumQuantity: 1,
    maximumQuantity: 2,
    taxCategoryCode: "service",
    feeCategoryCode: null,
    isPublic: true,
    isActive: true,
  },
  {
    id: "visitor-day",
    scopeKind: "campground",
    accommodationKind: null,
    accommodationId: null,
    chargeKind: "pass",
    applicationMode: "optional",
    code: "visitor-day-pass",
    displayName: "Visitor day pass",
    currencyCode: "CAD",
    pricingBasis: "per_unit",
    unitPriceCents: 500,
    percentageBasisPoints: null,
    unitLabel: "pass",
    passDurationDays: 1,
    minimumQuantity: 1,
    maximumQuantity: 8,
    taxCategoryCode: "pass",
    feeCategoryCode: null,
    isPublic: true,
    isActive: true,
  },
  {
    id: "service-fee",
    scopeKind: "campground",
    accommodationKind: null,
    accommodationId: null,
    chargeKind: "service_fee",
    applicationMode: "automatic",
    code: "booking-service-fee",
    displayName: "Booking service fee",
    currencyCode: "CAD",
    pricingBasis: "percent_of_stay",
    unitPriceCents: null,
    percentageBasisPoints: 500,
    unitLabel: null,
    minimumQuantity: 1,
    maximumQuantity: 1,
    taxCategoryCode: "service-fee",
    feeCategoryCode: "booking",
    isPublic: true,
    isActive: true,
  },
  {
    id: "cottage-cleaning",
    scopeKind: "accommodation_type",
    accommodationKind: "rental_cottage",
    accommodationId: null,
    chargeKind: "add_on",
    applicationMode: "optional",
    code: "cottage-cleaning",
    displayName: "Extra cottage cleaning",
    currencyCode: "CAD",
    pricingBasis: "per_stay",
    unitPriceCents: 2500,
    percentageBasisPoints: null,
    unitLabel: "service",
    minimumQuantity: 1,
    maximumQuantity: 1,
    taxCategoryCode: "service",
    feeCategoryCode: null,
    isPublic: true,
    isActive: true,
  },
];

test("Build 040 filters charge catalog by accommodation scope", () => {
  const items = listApplicableBookingCharges({
    catalog,
    accommodationId: "site-1",
    accommodationKind: "campsite",
    publicOnly: true,
  });
  assert.deepEqual(items.map((item) => item.code).sort(), [
    "booking-service-fee",
    "visitor-day-pass",
    "wifi-premium",
  ]);
});

test("Build 040 quotes selected add-ons, passes and automatic service fees", () => {
  const quote = quoteBookingCharges({
    catalog,
    selections: [
      { code: "wifi-premium", quantity: 1 },
      { code: "visitor-day-pass", quantity: 2 },
    ],
    accommodationId: "site-1",
    accommodationKind: "campsite",
    nights: 3,
    staySubtotalCents: 30000,
    currencyCode: "CAD",
  });

  assert.equal(quote.automaticTotalCents, 1500);
  assert.equal(quote.optionalTotalCents, 4000);
  assert.equal(quote.totalCents, 5500);
  assert.equal(quote.lines.length, 3);
});

test("Build 040 rejects unavailable and automatic manual selections", () => {
  assert.throws(
    () =>
      quoteBookingCharges({
        catalog,
        selections: [{ code: "cottage-cleaning", quantity: 1 }],
        accommodationId: "site-1",
        accommodationKind: "campsite",
        nights: 2,
        staySubtotalCents: 20000,
      }),
    /unavailable for this accommodation/u,
  );

  assert.throws(
    () =>
      quoteBookingCharges({
        catalog,
        selections: [{ code: "booking-service-fee", quantity: 1 }],
        accommodationId: "site-1",
        accommodationKind: "campsite",
        nights: 2,
        staySubtotalCents: 20000,
      }),
    /cannot be selected manually/u,
  );
});

test("Build 040 exposes deterministic public price labels", () => {
  assert.equal(bookingChargePriceLabel(catalog[0]), "$10.00 / night");
  assert.equal(bookingChargePriceLabel(catalog[1]), "$5.00 / pass");
  assert.equal(bookingChargePriceLabel(catalog[2]), "5% of stay");
});
