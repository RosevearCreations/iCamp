import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  BOOKING258_PROTOCOL,
  BOOKING258_SCHEMA,
  buildICampInstrumentSignal,
  reviewBookingWindow,
  reviewWaitlistInterest,
  summarizePublicInventory,
} from "../lib/release/build258-booking-core.mjs";

const source = (path) =>
  readFileSync(new URL("../" + path, import.meta.url), "utf8");
const campground = "11111111-2222-4333-8444-555555555555";
const accommodation = "55555555-4444-4333-8222-111111111111";

test("calendar nights are exact date-only and checkout exclusive across DST", () => {
  assert.equal(BOOKING258_SCHEMA, "icamp.booking-date-window.v1");
  const spring = reviewBookingWindow({
    arrivalDate: "2027-03-13",
    departureDate: "2027-03-15",
  });
  assert.equal(spring.valid, true);
  assert.equal(spring.nights, 2);
  assert.equal(spring.departureExclusive, true);
  assert.equal(spring.bookingConfirmed, false);
  const autumn = reviewBookingWindow({
    arrivalDate: "2027-11-06",
    departureDate: "2027-11-08",
  });
  assert.equal(autumn.nights, 2);
  assert.equal(
    reviewBookingWindow({
      arrivalDate: "2027-01-01",
      departureDate: "2027-01-02",
    }).nightsLabel,
    "1 night",
  );
});

test("invalid leap days, reversed, same-day, overlong and past dates HOLD", () => {
  for (const dates of [
    ["2027-02-29", "2027-03-01"],
    ["2027-03-10", "2027-03-10"],
    ["2027-03-11", "2027-03-10"],
    ["2027-01-01", "2027-04-05"],
  ]) {
    assert.equal(
      reviewBookingWindow({
        arrivalDate: dates[0],
        departureDate: dates[1],
      }).valid,
      false,
    );
  }
  assert.equal(
    reviewBookingWindow({
      arrivalDate: "2027-01-01",
      departureDate: "2027-01-03",
      nowDate: "2027-01-02",
    }).code,
    "HOLD_ARRIVAL_IN_PAST",
  );
});

test("map summary never treats held, closed, maintenance as available", () => {
  const window = reviewBookingWindow({
    arrivalDate: "2027-07-10",
    departureDate: "2027-07-12",
  });
  const result = summarizePublicInventory(
    [
      { tone: "green", selectable: true },
      { tone: "grey", selectable: false },
      { tone: "yellow", selectable: false },
      { tone: "red", selectable: false },
    ],
    window,
  );
  assert.equal(result.status, "LIVE_SOURCE_SUMMARY_READ_ONLY");
  assert.deepEqual(result.counts, {
    available: 1,
    reservedOrHeld: 1,
    maintenance: 1,
    closed: 1,
    total: 4,
  });
  assert.equal(result.noInventoryReservation, true);
  assert.equal(
    summarizePublicInventory([{ tone: "green", selectable: false }], window)
      .status,
    "HOLD_MAP_AVAILABILITY_MISMATCH",
  );
  assert.equal(
    summarizePublicInventory([{ tone: "purple", selectable: true }], window)
      .status,
    "HOLD_UNKNOWN_MAP_STATUS",
  );
});

test("waitlist is only a staff-reviewed note for a source-blocked site", () => {
  const input = {
    campgroundId: campground,
    accommodationId: accommodation,
    requestKey: "w".repeat(24),
    arrivalDate: "2027-07-10",
    departureDate: "2027-07-12",
  };
  const accepted = reviewWaitlistInterest({
    ...input,
    availabilityBlockers: ["temporary_hold"],
  });
  assert.equal(accepted.valid, true);
  assert.equal(accepted.allocatesInventory, false);
  assert.equal(accepted.automaticPromotion, false);
  assert.equal(accepted.bookingConfirmed, false);
  for (const overrides of [
    { availabilityBlockers: [] },
    { availabilityBlockers: undefined },
    { requestKey: "!" },
    { campgroundId: "wrong" },
    { departureDate: "2027-07-09" },
  ]) {
    assert.equal(
      reviewWaitlistInterest({
        ...input,
        availabilityBlockers: ["reservation"],
        ...overrides,
      }).valid,
      false,
    );
  }
});

test("instrument adapter carries only sanitized iCamp status, no fake YW state", () => {
  assert.equal(BOOKING258_PROTOCOL.minor, 1);
  assert.equal(BOOKING258_PROTOCOL.legacyMinor, 0);
  assert.equal(BOOKING258_PROTOCOL.independentRelease, true);
  const status = buildICampInstrumentSignal({
    sourceRevision: "a".repeat(40),
    observedAt: "2026-11-16T12:00:00.000Z",
    databaseStatus: "HEALTHY",
    integrationStatus: "CONNECTED_AUTHENTICATED",
    availability: {
      status: "LIVE_SOURCE_SUMMARY_READ_ONLY",
      counts: {
        available: 2,
        reservedOrHeld: 1,
        maintenance: 0,
        closed: 1,
        total: 4,
      },
    },
  });
  assert.equal(status.sourceAppId, "icamp");
  assert.equal(status.platformRole, "GOVERNED_EXTERNAL_SHELL");
  assert.equal(status.integration, "UNVERIFIED_RUNTIME_ACK");
  assert.equal(status.homeAutomationCommandsAllowed, false);
  assert.equal(status.crossAppDeliveryAuthorized, false);
  assert.equal(status.customerDataIncluded, false);
  assert.equal(status.receiverConnected, false);
  assert.equal(
    buildICampInstrumentSignal({
      sourceRevision: "unknown",
      observedAt: "2026-11-16T12:00:00.000Z",
    }).status,
    "HOLD_UNVERIFIED_SOURCE_REVISION",
  );
  assert.equal(JSON.stringify(status).includes("ywStatus"), false);
});

test("new ledger is append-only, RLS scoped and never auto-promotes offers", () => {
  const sql = source("database/migrations/0237_build258_waitlist_review.sql");
  const verify = source("database/verify/0237_build258_waitlist_review.sql");
  for (const token of [
    "force row level security",
    "icamp_waitlist_interest258",
    "icamp_waitlist_review258",
    "icamp-live-availability:",
    "live_accommodation_availability",
    "unique(campground_id,request_key)",
    "reservation.create",
    "reservation.modify",
  ])
    assert.ok(sql.toLowerCase().includes(token.toLowerCase()));
  assert.doesNotMatch(sql, /grant (?:update|delete)/iu);
  assert.match(verify, /Build258 two FORCE RLS ledgers required/u);
  assert.match(verify, /create_reservation_hold/u);
});

test("CI executes genuine concurrent PostgreSQL hold collision on isolated seed", () => {
  const workflow = source(".github/workflows/ci.yml");
  const script = source("scripts/build258-hold-concurrency.mjs");
  assert.match(workflow, /Build 258 real two-session booking hold collision/u);
  assert.match(workflow, /node scripts\/build258-hold-concurrency.mjs/u);
  assert.match(script, /Promise.all\(\[attempt\(1\), attempt\(2\)\]\)/u);
  assert.match(script, /CANONICAL_CONFLICT_DENIED/u);
  assert.match(script, /ISOLATED_DB_ONLY/u);
  assert.match(script, /postgres:postgres@127/u);
  assert.match(script, /assert.equal\(persisted.rows\[0\].count, 1\)/u);
});

test("site map, responsive Slave shell and staff hold service remain canonical", () => {
  const page = source("app/booking/map/page.tsx");
  const staff = source(
    "app/workspaces/management/campgrounds/booking-review/page.tsx",
  );
  const ops = source("lib/release/build258-booking-postgres.mjs");
  const actions = source(
    "app/workspaces/management/campgrounds/booking-review/actions.ts",
  );
  assert.match(page, /stay.nightsLabel/u);
  assert.match(page, /summarizePublicInventory/u);
  assert.match(page, /ask campground staff/u);
  assert.match(staff, /Master instrument/u);
  assert.match(staff, /SLAVE APPLICATION SHELL/u);
  assert.match(staff, /Authoritative temporary holds/u);
  assert.match(ops, /getLiveAvailabilitySnapshot/u);
  assert.match(ops, /on conflict \(campground_id,request_key\) do nothing/u);
  assert.match(actions, /assuranceLevel !== "aal2"/u);
  assert.match(source("components/app-shell.tsx"), /SLAVE APPLICATION SHELL/u);
  assert.match(source("app/settings/themes/page.tsx"), /Orbit/u);
  assert.match(
    source("lib/reservation-holds/postgres.mjs"),
    /create_reservation_hold/u,
  );
});
