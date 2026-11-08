import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  listApplicableBookingCharges,
  quoteBookingCharges,
} from "../lib/booking-charges/core.mjs";
import { parsePublicQuoteSelections } from "../lib/public-accommodation-detail/quote-preview.mjs";

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const campingServices = [
  {
    id: "dump",
    code: "dump-station",
    displayName: "Dump station",
    scopeKind: "campground",
    chargeKind: "add_on",
    applicationMode: "optional",
    isActive: true,
    isPublic: true,
    pricingBasis: "per_unit",
    unitPriceCents: 1500,
    minimumQuantity: 1,
    maximumQuantity: 3,
    startsOn: "2027-05-01",
    endsOn: "2027-10-31",
    currencyCode: "CAD",
  },
  {
    id: "pump",
    code: "pump-out",
    displayName: "Pump-out",
    scopeKind: "campground",
    chargeKind: "add_on",
    applicationMode: "optional",
    isActive: true,
    isPublic: true,
    pricingBasis: "per_night",
    unitPriceCents: 850,
    minimumQuantity: 1,
    maximumQuantity: 2,
    startsOn: "2027-06-01",
    endsOn: "2027-09-01",
    currencyCode: "CAD",
  },
];

test("Build 234 only advertises services covering the whole selected stay", () => {
  assert.deepEqual(
    listApplicableBookingCharges({
      catalog: campingServices,
      arrivalDate: "2027-05-28",
      departureDate: "2027-06-03",
    }).map((item) => item.code),
    ["dump-station"],
  );
  assert.deepEqual(
    listApplicableBookingCharges({
      catalog: campingServices,
      arrivalDate: "2027-06-01",
      departureDate: "2027-09-01",
    }).map((item) => item.code),
    ["dump-station", "pump-out"],
  );
  assert.deepEqual(
    listApplicableBookingCharges({
      catalog: campingServices,
      arrivalDate: "2027-11-01",
      departureDate: "2027-11-04",
    }),
    [],
  );
});

test("Build 234 enforces availability and exact dynamic price on final quote", () => {
  assert.throws(
    () =>
      quoteBookingCharges({
        catalog: campingServices,
        selections: [{ code: "pump-out", quantity: 1 }],
        arrivalDate: "2027-05-30",
        departureDate: "2027-06-03",
        nights: 4,
        staySubtotalCents: 18000,
      }),
    /unavailable/u,
  );
  const quote = quoteBookingCharges({
    catalog: campingServices,
    selections: [
      { code: "dump-station", quantity: 2 },
      { code: "pump-out", quantity: 1 },
    ],
    arrivalDate: "2027-07-01",
    departureDate: "2027-07-05",
    nights: 4,
    staySubtotalCents: 18000,
  });
  assert.equal(quote.optionalTotalCents, 6400);
  assert.deepEqual(
    quote.lines.map((item) => item.lineTotalCents),
    [3000, 3400],
  );
  assert.throws(
    () =>
      quoteBookingCharges({
        catalog: campingServices,
        selections: [{ code: "dump-station", quantity: 4 }],
        arrivalDate: "2027-07-01",
        departureDate: "2027-07-05",
        nights: 4,
      }),
    /quantity must be between/u,
  );
});

test("Build 234 rejects duplicate or invented public extras", () => {
  assert.throws(
    () =>
      parsePublicQuoteSelections({
        extra1: "dump-station",
        extra2: "dump-station",
      }),
    /duplicate/u,
  );
  assert.throws(
    () => parsePublicQuoteSelections({ extra1: "fake extra" }),
    /code is invalid/u,
  );
});

test("Build 234 preserves selected extras into checkout and reprices server-side", () => {
  const action = read(
    "app/booking/accommodations/[accommodationId]/checkout/actions.ts",
  );
  const detail = read("app/booking/accommodations/[accommodationId]/page.tsx");
  const checkout = read(
    "app/booking/accommodations/[accommodationId]/checkout/page.tsx",
  );
  const selector = read("components/booking-extras-selector.tsx");
  const publicDatabase = read("lib/public-accommodation-detail/postgres.mjs");
  const checkoutDatabase = read("lib/reservation-checkout/postgres.mjs");

  assert.ok(detail.includes("name={`extra${index + 1}`}"));
  assert.match(action, /parsePublicQuoteSelections\(extras\)/u);
  assert.match(
    action,
    /redirect\(checkoutPath\(accommodationId, holdId, selections\)\)/u,
  );
  assert.match(checkout, /<BookingExtrasSelector/u);
  assert.match(checkout, /parsePublicQuoteSelections\(query\)/u);
  assert.match(selector, /quoteBookingCharges\(/u);
  assert.match(selector, /name="chargeCode"/u);
  assert.match(selector, /not a locked quote/u);
  assert.match(checkoutDatabase, /selections: normalized\.selections/u);
  assert.match(checkoutDatabase, /arrivalDate: reference\.arrivalDate/u);
  for (const source of [publicDatabase, checkoutDatabase]) {
    assert.match(source, /starts_on is null or starts_on <= \$3::date/u);
    assert.match(source, /ends_on is null or ends_on >= \$4::date/u);
  }
});
