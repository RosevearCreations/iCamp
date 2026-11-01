import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { quoteBookingCharges } from "../lib/booking-charges/core.mjs";
import { quoteAccommodationStay } from "../lib/pricing/core.mjs";
import {
  createPublicQuotePreview,
  parsePublicQuoteSelections,
  PUBLIC_QUOTE_TTL_MINUTES,
} from "../lib/public-accommodation-detail/quote-preview.mjs";

const context = {
  accommodationId: "11111111-1111-4111-8111-111111111111",
  accommodationKind: "campsite",
  arrivalDate: "2026-11-10",
  departureDate: "2026-11-13",
};
const plan = {
  id: "plan-1",
  accommodationId: context.accommodationId,
  isActive: true,
  startsOn: "2026-01-01",
  endsOn: "2027-12-31",
  displayName: "Published stay plan",
  currencyCode: "CAD",
  nightlyCents: 10000,
};
const catalog = [
  {
    id: "fee",
    code: "mandatory-fee",
    displayName: "Service fee",
    applicationMode: "automatic",
    chargeKind: "service_fee",
    scopeKind: "campground",
    pricingBasis: "per_stay",
    unitPriceCents: 1200,
    currencyCode: "CAD",
    minimumQuantity: 1,
    maximumQuantity: 1,
  },
  {
    id: "pet",
    code: "extra-pet",
    displayName: "Extra pet",
    applicationMode: "optional",
    chargeKind: "add_on",
    scopeKind: "campground",
    pricingBasis: "per_night",
    unitPriceCents: 300,
    currencyCode: "CAD",
    minimumQuantity: 1,
    maximumQuantity: 2,
  },
];
const paymentPolicy = {
  depositMode: "percentage",
  depositPercentageBasisPoints: 5000,
  depositFixedCents: null,
  securityDepositCents: 15000,
  securityDepositDueStage: "with_deposit",
  balanceDueMode: "on_arrival",
  balanceDueDaysBeforeArrival: null,
  currencyCode: "CAD",
};
const cancellationPolicy = {
  currencyCode: "CAD",
  freeCancellationDaysBeforeArrival: 7,
  earlyRefundBasisPoints: 10000,
  lateRefundBasisPoints: 0,
  securityDepositRefundBasisPoints: 10000,
  cancellationFeeCents: 500,
};

function make(overrides = {}) {
  const pricingQuote = quoteAccommodationStay({
    plans: [plan],
    ...context,
    rules: [
      {
        ratePlanId: plan.id,
        isActive: true,
        ruleKind: "weekend",
        code: "weekend",
        displayName: "Weekend",
        adjustmentPercent: 10,
      },
    ],
    weekendIsoDays: [2],
  });
  const chargeQuote = quoteBookingCharges({
    catalog,
    selections: [{ code: "extra-pet", quantity: 2 }],
    ...context,
    nights: pricingQuote.nights,
    staySubtotalCents: pricingQuote.totalCents,
    currencyCode: pricingQuote.currencyCode,
  });
  return createPublicQuotePreview({
    pricingQuote,
    chargeQuote,
    paymentPolicy,
    cancellationPolicy,
    ...context,
    availabilityRevision: 9,
    quotedAt: "2026-11-01T12:00:00.000Z",
    ...overrides,
  });
}

test("Build 174 parses only bounded, unique server-validated extra slots", () => {
  assert.deepEqual(parsePublicQuoteSelections({}), []);
  assert.deepEqual(
    parsePublicQuoteSelections({ extra1: "extra-pet", quantity1: "2" }),
    [{ code: "extra-pet", quantity: 2 }],
  );
  for (const input of [
    { extra1: "extra-pet", quantity1: "-1" },
    { extra1: "extra-pet", quantity1: "101" },
    { extra1: "extra-pet", quantity1: "1.5" },
    { extra1: "<script>" },
    { extra1: ["extra-pet"] },
    { extra1: "extra-pet", extra2: "extra-pet" },
  ])
    assert.throws(() => parsePublicQuoteSelections(input), /invalid/);
});

test("Build 174 itemized canonical stay + mandatory/selected lines exactly matches subtotal", () => {
  const quote = make();
  assert.equal(quote.status, "quoted");
  assert.equal(quote.currencyCode, "CAD");
  assert.equal(quote.baseCents, 30000);
  assert.equal(quote.adjustmentCents, 1000);
  assert.equal(quote.stayCents, 31000);
  assert.equal(quote.automaticCents, 1200);
  assert.equal(quote.optionalCents, 1800);
  assert.equal(quote.knownSubtotalCents, 34000);
  assert.equal(
    quote.nightly.reduce((sum, night) => sum + night.allocatedCents, 0),
    quote.stayCents,
  );
  assert.equal(
    quote.charges.reduce((sum, line) => sum + line.lineTotalCents, 0),
    3000,
  );
  assert.equal(quote.paymentSchedule.bookingDepositCents, 17000);
  assert.equal(quote.paymentSchedule.securityDepositCents, 15000);
  assert.equal(quote.cancellationPolicy.cancellationFeeCents, 500);
  assert.equal(quote.taxStatus, "unconfigured");
  assert.equal(quote.finalTotalCents, null);
  assert.equal(quote.taxCents, null);
  assert.equal(PUBLIC_QUOTE_TTL_MINUTES, 10);
  assert.equal(quote.expiresAt, "2026-11-01T12:10:00.000Z");
});

test("Build 174 no configured policies, mismatched currency and no rate never invent financial terms", () => {
  const missing = make({ paymentPolicy: null, cancellationPolicy: null });
  assert.equal(missing.paymentSchedule, null);
  assert.equal(missing.cancellationPolicy, null);
  assert.equal(missing.policyWarnings.length, 2);
  const wrongCurrency = make({
    paymentPolicy: { ...paymentPolicy, currencyCode: "USD" },
  });
  assert.equal(wrongCurrency.paymentSchedule, null);
  assert.match(wrongCurrency.policyWarnings[0], /different currency/);
  const unavailable = createPublicQuotePreview({
    pricingQuote: { status: "unavailable" },
    chargeQuote: null,
    ...context,
    availabilityRevision: 5,
  });
  assert.equal(unavailable.status, "rate_unavailable");
  assert.equal(unavailable.expiresAt, null);
});

test("Build 174 preserves canonical zero floor when negative adjustments exceed base", () => {
  const pricingQuote = quoteAccommodationStay({
    plans: [plan],
    ...context,
    rules: [
      {
        ratePlanId: plan.id,
        isActive: true,
        ruleKind: "weekend",
        code: "discount",
        displayName: "Discount",
        adjustmentCents: -40000,
      },
    ],
    weekendIsoDays: [2],
  });
  const chargeQuote = quoteBookingCharges({
    catalog,
    selections: [],
    ...context,
    nights: 3,
    staySubtotalCents: pricingQuote.totalCents,
    currencyCode: "CAD",
  });
  const quote = createPublicQuotePreview({
    pricingQuote,
    chargeQuote,
    ...context,
    availabilityRevision: 1,
  });
  assert.equal(quote.stayCents, 0);
  assert.equal(quote.rateFloorCorrectionCents, 10000);
  assert.equal(quote.knownSubtotalCents, 1200);
});

test("Build 174 public and printable UI share the same server quote, no payment mutation", () => {
  const detail = fs.readFileSync(
    new URL(
      "../app/booking/accommodations/[accommodationId]/page.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const print = fs.readFileSync(
    new URL(
      "../app/booking/accommodations/[accommodationId]/quote/print/page.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const postgres = fs.readFileSync(
    new URL("../lib/public-accommodation-detail/postgres.mjs", import.meta.url),
    "utf8",
  );
  const summary = fs.readFileSync(
    new URL(
      "../app/booking/accommodations/[accommodationId]/quote-summary.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(detail, /<QuoteSummary quote=\{detail\.quotePreview\}/);
  assert.match(print, /<QuoteSummary quote=\{detail\.quotePreview\} printMode/);
  assert.match(print, /force-dynamic/);
  assert.match(postgres, /quoteAccommodationStay/);
  assert.match(postgres, /quoteBookingCharges/);
  assert.match(postgres, /campground_payment_policies/);
  assert.match(postgres, /campground_cancellation_refund_policies/);
  assert.match(summary, /Not a final amount/);
  assert.match(summary, /Billing and IVR\/SMS remain HELD/);
  assert.doesNotMatch(summary, /capturePayment|chargeCard|sendSms/);
});
