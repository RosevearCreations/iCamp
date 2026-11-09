import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  assertDailyCapacity,
  normalizeDailyCapacity,
  validateFulfillmentUpdate,
} from "../lib/booking-charges/fulfillment-core.mjs";
import { validateServiceCatalogEntry } from "../lib/booking-charges/catalog-editor.mjs";
import { checkoutErrorCode } from "../lib/reservation-checkout/core.mjs";

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Build 235 shared daily capacity is optional but never an inferred per-booking limit", () => {
  assert.equal(normalizeDailyCapacity(""), null);
  assert.equal(normalizeDailyCapacity(null), null);
  assert.equal(normalizeDailyCapacity("1"), 1);
  assert.equal(normalizeDailyCapacity("10000"), 10000);
  for (const invalid of [
    "0",
    "-1",
    "1.5",
    "1e2",
    "Infinity",
    "10001",
    " 2.1 ",
  ]) {
    assert.throws(() => normalizeDailyCapacity(invalid));
  }
  assert.doesNotThrow(() =>
    assertDailyCapacity({ capacity: null, used: 150, requested: 900 }),
  );
  assert.doesNotThrow(() =>
    assertDailyCapacity({ capacity: 12, used: 9, requested: 3 }),
  );
  assert.throws(
    () => assertDailyCapacity({ capacity: 12, used: 9, requested: 4 }),
    /ICAMP_SERVICE_CAPACITY_EXCEEDED/u,
  );
  assert.equal(
    validateServiceCatalogEntry({
      code: "ice",
      displayName: "Ice",
      pricingBasis: "per_unit",
      unitLabel: "bag",
      priceDollars: "6.00",
      minimumQuantity: 1,
      maximumQuantity: 5,
      dailyCapacity: "24",
      isPublic: true,
    }).dailyCapacity,
    24,
  );
});

test("Build 235 service scheduling stays inside a reservation and follows audited transitions", () => {
  const input = {
    currentState: "queued",
    nextState: "scheduled",
    arrivalDate: "2027-07-01",
    departureDate: "2027-07-05",
    serviceDate: "2027-07-04",
    serviceWindow: "afternoon",
    staffNote: "Pump-out arranged",
  };
  assert.deepEqual(validateFulfillmentUpdate(input), {
    nextState: "scheduled",
    serviceDate: "2027-07-04",
    serviceWindow: "afternoon",
    staffNote: "Pump-out arranged",
  });
  for (const next of ["completed", "in_progress", "queued"]) {
    assert.throws(() =>
      validateFulfillmentUpdate({ ...input, nextState: next }),
    );
  }
  assert.throws(
    () => validateFulfillmentUpdate({ ...input, serviceDate: "2027-07-05" }),
    /within/u,
  );
  assert.throws(
    () => validateFulfillmentUpdate({ ...input, serviceDate: "2027-02-30" }),
    /within/u,
  );
  assert.throws(
    () => validateFulfillmentUpdate({ ...input, serviceWindow: "midnight" }),
    /window/u,
  );
  assert.throws(
    () => validateFulfillmentUpdate({ ...input, staffNote: "x".repeat(501) }),
    /long/u,
  );
  assert.throws(
    () => validateFulfillmentUpdate({ ...input, currentState: "completed" }),
    /transition/u,
  );
});

test("Build 235 checkout creates scoped work atomically and gives a recoverable capacity error", () => {
  const checkout = read("lib/reservation-checkout/postgres.mjs");
  const page = read(
    "app/booking/accommodations/[accommodationId]/checkout/page.tsx",
  );
  const migration = read(
    "database/migrations/0220_build235_add_on_fulfillment.sql",
  );
  assert.match(checkout, /insert into public\.reservation_charge_lines/u);
  assert.match(checkout, /insert into public\.service_fulfillment_jobs/u);
  assert.match(checkout, /chargeLineId|savedLine\.rows\[0\]\.id/u);
  assert.match(checkout, /await client\.query\("commit"\)/u);
  assert.match(checkout, /await client\.query\("rollback"\)/u);
  assert.match(migration, /pg_advisory_xact_lock/u);
  assert.match(migration, /for share/u);
  assert.match(
    migration,
    /reserved_quantity \+ new\.quantity > configured_capacity/u,
  );
  assert.match(migration, /charge_line_id uuid not null unique/u);
  assert.match(
    migration,
    /r\.status in \('pending','confirmed','checked_in'\)/u,
  );
  assert.match(page, /No reservation or payment was created/u);
  assert.equal(
    checkoutErrorCode(new Error("ICAMP_SERVICE_CAPACITY_EXCEEDED")),
    "ICAMP_SERVICE_CAPACITY_EXCEEDED",
  );
});

test("Build 235 staff queue is tenant scoped, role gated and auditable without guest PII", () => {
  const pg = read("lib/booking-charges/fulfillment-postgres.mjs");
  const page = read(
    "app/workspaces/management/campgrounds/service-fulfillment/page.tsx",
  );
  const action = read(
    "app/workspaces/management/campgrounds/service-fulfillment/actions.ts",
  );
  const schema = read(
    "database/migrations/0220_build235_add_on_fulfillment.sql",
  );
  assert.match(
    pg,
    /hasCampgroundPermission\(userId, campgroundId, "reservation\.modify"\)/u,
  );
  assert.match(pg, /set local role icamp_app/u);
  assert.match(pg, /set_config\('icamp\.user_id'/u);
  assert.match(pg, /for update of j/u);
  assert.match(pg, /row_version = \$8/u);
  assert.match(pg, /appendAuditEvent/u);
  assert.match(action, /requireCampgroundPermission\(/u);
  assert.match(page, /listAssignedCampgrounds\(session\.user\.id\)/u);
  assert.match(page, /getCampgroundAuthorization/u);
  assert.match(page, /not send guest messages/u);
  assert.match(schema, /force row level security/u);
  assert.match(
    schema,
    /grant select, update on public\.service_fulfillment_jobs to icamp_app/u,
  );
  assert.doesNotMatch(
    schema,
    /grant insert on public\.service_fulfillment_jobs to icamp_app/u,
  );
});
