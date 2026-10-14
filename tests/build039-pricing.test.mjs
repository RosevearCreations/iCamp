import assert from "node:assert/strict";
import test from "node:test";
import { formatMoney, quoteAccommodationStay, selectRatePlan } from "../lib/pricing/core.mjs";

const plans = [{
  id: "kind-plan",
  accommodationId: null,
  accommodationKind: "campsite",
  code: "standard",
  displayName: "Standard",
  currencyCode: "CAD",
  nightlyCents: 5000,
  weeklyCents: 30000,
  monthlyCents: 100000,
  seasonalCents: null,
  yearlyCents: null,
  startsOn: "2027-01-01",
  endsOn: "2027-12-31",
  priority: 100,
  isActive: true,
}, {
  id: "site-plan",
  accommodationId: "site-1",
  accommodationKind: "campsite",
  code: "site-special",
  displayName: "Site special",
  currencyCode: "CAD",
  nightlyCents: 6000,
  weeklyCents: 35000,
  monthlyCents: null,
  seasonalCents: null,
  yearlyCents: null,
  startsOn: "2027-01-01",
  endsOn: "2027-12-31",
  priority: 500,
  isActive: true,
}];

test("Build 039 prefers accommodation-specific plans", () => {
  assert.equal(selectRatePlan({
    plans,
    accommodationId: "site-1",
    accommodationKind: "campsite",
    arrivalDate: "2027-07-01",
    departureDate: "2027-07-03",
  }).id, "site-plan");
});

test("Build 039 calculates package pricing plus dynamic date rules", () => {
  const quote = quoteAccommodationStay({
    plans,
    accommodationId: "site-2",
    accommodationKind: "campsite",
    arrivalDate: "2027-07-02",
    departureDate: "2027-07-10",
    weekendIsoDays: [6, 7],
    periods: [{ id: "holiday-1", startsOn: "2027-07-05", endsOn: "2027-07-05", isActive: true }],
    rules: [
      { ratePlanId: "kind-plan", ruleKind: "weekend", code: "weekend", displayName: "Weekend", adjustmentPercent: 10, adjustmentCents: 0, priority: 10, isActive: true },
      { ratePlanId: "kind-plan", ruleKind: "holiday", calendarPeriodId: "holiday-1", code: "holiday", displayName: "Holiday", adjustmentPercent: 20, adjustmentCents: 0, priority: 20, isActive: true },
    ],
  });

  assert.equal(quote.status, "quoted");
  assert.equal(quote.baseCents, 35000);
  assert.equal(quote.adjustments.length, 3);
  assert.equal(quote.totalCents, 37000);
  assert.equal(formatMoney(quote.totalCents, "CAD"), "$370.00");
});

test("Build 039 never fabricates a quote without a matching plan", () => {
  const quote = quoteAccommodationStay({
    plans,
    accommodationId: "cottage-1",
    accommodationKind: "rental_cottage",
    arrivalDate: "2027-07-01",
    departureDate: "2027-07-02",
  });
  assert.equal(quote.status, "unavailable");
  assert.equal(quote.totalCents, null);
});
