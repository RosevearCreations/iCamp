import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  buildDeskQueues,
  normalizeDeskFilters,
  sourceCoverage,
} from "../lib/front-desk-workboard/core.mjs";

const read = (name) => readFileSync(new URL(name, import.meta.url), "utf8");
const access = {
  finance: true,
  visitors: true,
  maintenance: true,
  housekeeping: true,
  holds: true,
};
const reservation = {
  id: "reservation-1",
  campgroundId: "camp-1",
  accommodationId: "site-1",
  status: "confirmed",
  arrivalDate: "2027-07-01",
  departureDate: "2027-07-04",
  accommodationCode: "C01",
  accommodationName: "Cottage 01",
  guestDisplayName: "Test Guest",
  inArrivalWindow: true,
  inDepartureWindow: false,
  plan: {
    state: "submitted",
    reviewCurrent: false,
    reviewOutcome: null,
    assistanceRequested: true,
  },
  finance: {
    outstandingBalanceCents: 4900,
    financialReviewRequired: false,
    currencyCode: "CAD",
  },
};

test("Build185 source filters are allowlisted, trimmed and deterministic", () => {
  assert.deepEqual(
    normalizeDeskFilters({ view: "bad", sort: "drop table", query: "  C01  " }),
    { view: "all", sort: "urgency", query: "c01" },
  );
  assert.equal(
    normalizeDeskFilters({ query: "X".repeat(200) }).query.length,
    80,
  );
  assert.deepEqual(sourceCoverage(5, 5), {
    shown: 5,
    total: 5,
    complete: true,
  });
  assert.deepEqual(sourceCoverage(5, 8), {
    shown: 5,
    total: 8,
    complete: false,
  });
});

test("Build185 combines source-grounded flags, sorted queues and canonical links", () => {
  const result = buildDeskQueues({
    reservations: [reservation],
    visitors: [
      { reservationId: reservation.id, issueCount: 2, pendingCount: 2 },
    ],
    maintenance: [{ accommodationId: "site-1", openCount: 3, blockedCount: 1 }],
    turnovers: [{ accommodationId: "site-1", openCount: 1, blockedCount: 0 }],
    holds: [
      {
        id: "hold-1",
        campgroundId: "camp-1",
        accommodationId: "site-2",
        arrivalDate: "2027-07-01",
        departureDate: "2027-07-03",
        accommodationCode: "C02",
        accommodationName: "Cottage 02",
        expiresAt: "2027-07-01T10:00:00.000Z",
      },
    ],
    permissions: access,
  });
  assert.deepEqual(result.counts, {
    arrivals: 1,
    departures: 0,
    exceptions: 1,
    holds: 1,
  });
  assert.equal(result.rows.length, 2);
  const arrival = result.rows.find((row) => row.kind === "arrivals");
  assert.match(
    arrival.primaryHref,
    /check-in\?campground=camp-1&reservation=reservation-1/,
  );
  assert.match(
    arrival.flags.map((f) => f.label).join(" "),
    /Pre-registration review.*Guest requested arrival assistance.*Outstanding payment status.*visitor.*work order.*turnover/i,
  );
  assert.equal(
    result.rows.find((row) => row.kind === "holds").guestDisplayName,
    "Temporary hold · no guest reservation",
  );
});

test("Build185 derives arrivals/departures independently and filters keyboard-friendly GET queries", () => {
  const result = buildDeskQueues({
    reservations: [
      {
        ...reservation,
        status: "checked_in",
        inDepartureWindow: true,
        plan: null,
        finance: null,
      },
    ],
    permissions: access,
    filters: { view: "departures", sort: "accommodation", query: "C01" },
  });
  assert.deepEqual(result.counts, {
    arrivals: 1,
    departures: 1,
    exceptions: 0,
    holds: 0,
  });
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].kind, "departures");
  assert.match(result.rows[0].primaryHref, /check-out/);
  assert.equal(
    buildDeskQueues({
      reservations: [reservation],
      permissions: access,
      filters: { view: "exceptions", query: "impossible" },
    }).rows.length,
    0,
  );
});

test("Build185 optional scopes hide payment, visitor and maintenance details without their permission", () => {
  const result = buildDeskQueues({
    reservations: [reservation],
    permissions: {
      finance: false,
      visitors: false,
      maintenance: false,
      housekeeping: false,
      holds: false,
    },
    visitors: [{ reservationId: reservation.id, issueCount: 9 }],
    maintenance: [{ accommodationId: "site-1", openCount: 9, blockedCount: 9 }],
    turnovers: [{ accommodationId: "site-1", openCount: 9, blockedCount: 9 }],
    holds: [{ id: "private-hold" }],
  });
  const row = result.rows[0];
  assert.match(row.primaryHref, /reservations\/reservation-1$/);
  assert.equal(
    row.flags.some((flag) =>
      /visitor|payment|work order|turnover/i.test(flag.label),
    ),
    false,
  );
  assert.equal(result.counts.holds, 0);
});

test("Build185 database access is permission-gated, read-only, RLS-scoped and source-complete with disclosed caps", () => {
  const sql = read("../lib/front-desk-workboard/postgres.mjs");
  const page = read(
    "../app/workspaces/management/campgrounds/reservations/front-desk/page.tsx",
  );
  assert.match(sql, /reservation\.read.*reservation\.modify/);
  assert.match(sql, /repeatable read read only/);
  assert.match(sql, /set local role icamp_app/);
  assert.match(sql, /set_config\('icamp\.user_id'/);
  assert.match(sql, /count\(\*\) over\(\)::integer as source_total/);
  assert.match(sql, /from public\.reservation_holds/);
  assert.match(sql, /from public\.visitor_registrations/);
  assert.match(sql, /from public\.maintenance_work_orders/);
  assert.match(sql, /from public\.cottage_turnovers/);
  assert.match(sql, /permissions\.finance && reservations\.length/);
  assert.match(page, /display cap reached/);
  assert.match(page, /Billing and outbound Omnichannel are\s+HELD/);
  assert.doesNotMatch(
    sql,
    /insert into|update public\.|delete from|capturePayment|sendSms|sendEmail|fetch\(/i,
  );
  assert.doesNotMatch(page, /action=\{|"use server"/);
});
