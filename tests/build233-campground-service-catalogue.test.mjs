import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  SERVICE_PRESETS,
  centsToDollars,
  dollarsToCents,
  validateServiceCatalogEntry,
} from "../lib/booking-charges/catalog-editor.mjs";
import {
  listApplicableBookingCharges,
  quoteBookingCharges,
} from "../lib/booking-charges/core.mjs";

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

function entry(overrides = {}) {
  return {
    preset: "dump-station",
    code: "",
    displayName: "",
    description: "",
    pricingBasis: "per_unit",
    priceDollars: "15.25",
    unitLabel: "",
    minimumQuantity: 1,
    maximumQuantity: 3,
    startsOn: "2027-05-01",
    endsOn: "2027-10-31",
    isPublic: true,
    ...overrides,
  };
}

test("Build 233 presets cover practical camping services with a unique stable code", () => {
  assert.deepEqual(
    SERVICE_PRESETS.map((item) => item.code),
    [
      "dump-station",
      "pump-out",
      "fresh-water",
      "propane",
      "firewood",
      "ice",
      "equipment-rental",
      "extra-vehicle",
      "extra-guest",
    ],
  );
  assert.equal(
    new Set(SERVICE_PRESETS.map((item) => item.code)).size,
    SERVICE_PRESETS.length,
  );
  const result = validateServiceCatalogEntry(entry());
  assert.equal(result.code, "dump-station");
  assert.equal(result.displayName, "Dumping station use");
  assert.equal(result.unitLabel, "use");
  assert.equal(result.unitPriceCents, 1525);
  assert.equal(result.minimumQuantity, 1);
  assert.equal(result.maximumQuantity, 3);
});

test("Build 233 CAD cents are exact and invalid prices cannot round into paid bookings", () => {
  for (const value of ["0", "0.00", "12.34", "12345.67", "999999.99"]) {
    assert.equal(
      dollarsToCents(centsToDollars(dollarsToCents(value))),
      dollarsToCents(value),
    );
  }
  for (const value of [
    "-1.00",
    "1.234",
    "1e3",
    "Infinity",
    "1,000",
    "1000000",
    "",
    "01.00",
  ]) {
    assert.throws(() => dollarsToCents(value));
  }
});

test("Build 233 rejects malformed names, codes, quantities and service dates", () => {
  const invalid = [
    { code: "invalid code" },
    { preset: "", code: "" },
    { preset: "", code: "other", displayName: "" },
    { minimumQuantity: 0 },
    { maximumQuantity: 101 },
    { minimumQuantity: 5, maximumQuantity: 4 },
    { startsOn: "2027-02-30" },
    { startsOn: "2027-10-31", endsOn: "2027-05-01" },
    { pricingBasis: "percent_of_stay" },
    { unitLabel: "x".repeat(41) },
  ];
  for (const change of invalid) {
    assert.throws(
      () => validateServiceCatalogEntry(entry(change)),
      JSON.stringify(change),
    );
  }
});

test("Build 233 catalogue values feed the existing authoritative booking calculator", () => {
  const saved = validateServiceCatalogEntry(entry());
  const charge = {
    ...saved,
    id: "demo-service",
    scopeKind: "campground",
    chargeKind: "add_on",
    applicationMode: "optional",
    isActive: true,
    currencyCode: "CAD",
  };
  const quoted = quoteBookingCharges({
    catalog: [charge],
    selections: [{ code: "dump-station", quantity: 2 }],
    accommodationId: "site-a",
    accommodationKind: "campsite",
    nights: 3,
    staySubtotalCents: 9000,
    currencyCode: "CAD",
  });
  assert.equal(quoted.totalCents, 3050);
  assert.equal(quoted.automaticTotalCents, 0);
  assert.equal(quoted.lines[0].displayName, "Dumping station use");
  assert.throws(
    () =>
      quoteBookingCharges({
        catalog: [charge],
        selections: [{ code: "dump-station", quantity: 4 }],
        nights: 3,
        staySubtotalCents: 9000,
      }),
    /quantity must be between/u,
  );
  assert.equal(
    listApplicableBookingCharges({
      catalog: [{ ...charge, isPublic: false }],
      publicOnly: true,
    }).length,
    0,
  );
  assert.equal(
    listApplicableBookingCharges({ catalog: [{ ...charge, isActive: false }] })
      .length,
    0,
  );
});

test("Build 233 editor requires tenant pricing.manage, RLS and optimistic lock", () => {
  const pg = read("lib/booking-charges/catalog-postgres.mjs");
  const action = read(
    "app/workspaces/management/campgrounds/services/actions.ts",
  );
  const page = read("app/workspaces/management/campgrounds/services/page.tsx");
  assert.match(
    pg,
    /hasCampgroundPermission\(userId, campgroundId, "pricing.manage"\)/u,
  );
  assert.match(pg, /set local role icamp_app/u);
  assert.match(pg, /set_config\('icamp.user_id'/u);
  assert.match(pg, /organization_id = \$1 and campground_id = \$2/u);
  assert.match(pg, /row_version = \$15/u);
  assert.match(pg, /row_version = \$5 and is_active = true/u);
  assert.match(pg, /archived_at = statement_timestamp\(\)/u);
  assert.match(pg, /appendAuditEvent/u);
  assert.match(pg, /'campground', 'add_on', 'optional'/u);
  assert.match(
    action,
    /requireCampgroundPermission\(\s*campgroundId,\s*"pricing.manage",\s*path/u,
  );
  assert.match(action, /confirmation.*ARCHIVE/u);
  assert.match(page, /listAssignedCampgrounds\(session.user.id\)/u);
  assert.match(page, /getCampgroundAuthorization/u);
  assert.match(page, /redirect\("\/auth\/not-authorized"\)/u);
  assert.match(page, /SERVICE_PRESETS.map/u);
  assert.match(read("app/campground/page.tsx"), /campgrounds\/services/u);
  assert.match(
    read("app/workspaces/management/campgrounds/page.tsx"),
    /Manage booking services and add-ons/u,
  );
});

test("Build 233 retires obsolete prelaunch forms as blockers but preserves actual financial security", () => {
  const it = read("app/workspaces/it-analysis/page.tsx");
  const status = read("app/workspaces/it-analysis/release-status/page.tsx");
  const command = read("components/standard-ops-command.tsx");
  const launch = read("app/launch/readiness/page.tsx");
  const ql258 = read("app/integration/ql258/page.tsx");
  const comms = read("app/integration/comms-hub/page.tsx");
  assert.match(it, /deployment truth and historic checklist cleanup/i);
  assert.match(status, /getSafeItSnapshot/u);
  assert.match(status, /it.health.read/u);
  assert.match(status, /commercial launch and external communication/u);
  assert.match(status, /Historical worksheets/u);
  assert.match(status, /Paid SaaS subscriptions/u);
  assert.match(command, /Current deployment truth/u);
  assert.doesNotMatch(command, /value: "DISCONNECTED"/u);
  assert.match(launch, /Historical Build 156 worksheet/u);
  assert.match(ql258, /Historical QL-258 owner evidence review/u);
  assert.match(comms, /Historical source preflight tools/u);
});
