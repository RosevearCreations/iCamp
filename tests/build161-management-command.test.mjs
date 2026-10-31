import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { buildManagementSnapshot } from "../lib/command-centre/management.mjs";

const now = new Date("2026-10-31T02:45:00.000Z");

test("Build 161 has explicit unavailable values, not fabricated zero counts", () => {
  const result = buildManagementSnapshot({ now });
  assert.equal(result.siteCount, null);
  assert.equal(result.arrivalsThisWeek, null);
  assert.equal(result.financialReviews, null);
  assert.equal(result.openWorkOrders, null);
  assert.equal(result.maintenanceAvailable, false);
  assert.equal(result.reservationAvailable, false);
});

test("Build 161 respects campground timezone and excludes cancelled stays", () => {
  const result = buildManagementSnapshot({
    now,
    timezone: "America/Toronto",
    reservations: {
      accommodations: [
        { statusState: "available" },
        { statusState: "maintenance" },
      ],
      reservations: [
        {
          id: "a",
          status: "confirmed",
          arrivalDate: "2026-10-30",
          accommodationCode: "A1",
          guestDisplayName: "Camper A",
          financialReviewRequired: false,
        },
        {
          id: "b",
          status: "checked_in",
          arrivalDate: "2026-10-31",
          accommodationCode: "A2",
          guestDisplayName: "Camper B",
          financialReviewRequired: true,
        },
        {
          id: "c",
          status: "cancelled",
          arrivalDate: "2026-10-31",
          accommodationCode: "A3",
          guestDisplayName: "Camper C",
          financialReviewRequired: false,
        },
        {
          id: "d",
          status: "confirmed",
          arrivalDate: "2026-11-06",
          accommodationCode: "A4",
          guestDisplayName: "Camper D",
          financialReviewRequired: false,
        },
      ],
    },
  });
  assert.equal(result.today, "2026-10-30");
  assert.equal(result.siteCount, 2);
  assert.equal(result.availableSites, 1);
  assert.equal(result.arrivalsThisWeek, 2);
  assert.equal(result.financialReviews, 1);
  assert.deepEqual(
    result.recentArrivals.map((entry) => entry.id),
    ["a", "b"],
  );
  assert.equal(result.reservationRowsCapped, false);
});

test("Build 161 maintenance counters use true source statuses", () => {
  const result = buildManagementSnapshot({
    now,
    maintenance: {
      accommodations: [],
      workOrders: [
        { id: "1", title: "Water", status: "open", priorityKey: "urgent" },
        {
          id: "2",
          title: "Power",
          status: "blocked",
          priorityKey: "emergency",
        },
        { id: "3", title: "Fixed", status: "completed", priorityKey: "normal" },
      ],
    },
  });
  assert.equal(result.openWorkOrders, 2);
  assert.equal(result.blockedWorkOrders, 1);
  assert.deepEqual(
    result.workOrderQueue.map((entry) => entry.id),
    ["1", "2"],
  );
});

test("Build 161 visibly discloses 250-row reservation limit", () => {
  const result = buildManagementSnapshot({
    now,
    reservations: {
      reservations: Array.from({ length: 250 }, (_, i) => ({
        id: `r${i}`,
        status: "pending",
        arrivalDate: "2026-11-01",
      })),
    },
  });
  assert.equal(result.reservationRowsCapped, true);
  assert.equal(result.visibleReservationCount, 250);
});

test("Build 161 management command has tenant authorization and safe HOLD gates", () => {
  const page = readFileSync(
    new URL("../app/workspaces/management/command/page.tsx", import.meta.url),
    "utf8",
  );
  assert.match(
    page,
    /authorization\?\.permissions\.includes\("reports\.read"\)/,
  );
  assert.match(page, /campgroundId: selected\.campgroundId/);
  assert.match(page, /Promise\.allSettled/);
  assert.match(page, /HELD · No charges/);
  assert.match(page, /DISCONNECTED \/ HOLD/);
  assert.match(page, /first 250 reservation records/);
});
