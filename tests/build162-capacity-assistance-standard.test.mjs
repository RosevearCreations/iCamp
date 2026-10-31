import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { summarizeOccupancyRows } from "../lib/command-centre/occupancy-core.mjs";

function dates(length, overrides = {}) {
  return Array.from({ length }, (_, i) => ({
    date: `2026-10-${String(i + 1).padStart(2, "0")}`,
    totalSites: 20,
    operatingSites: 18,
    pausedSites: 2,
    bookedSites: 10,
    heldSites: 1,
    pendingSites: 3,
    ...overrides,
  }));
}

test("Build 162 computes occupancy ratios from full campground denominators", () => {
  const result = summarizeOccupancyRows(
    dates(14),
    new Date("2026-10-31T02:00:00Z"),
  );
  assert.equal(result.days.length, 14);
  assert.equal(result.totalSites, 20);
  assert.equal(result.days[0].bookedPercent, 50);
  assert.equal(result.days[0].pausedPercent, 10);
  assert.equal(result.averageBookedPercent, 50);
  assert.equal(result.bookedSiteNights, 140);
  assert.equal(result.heldSiteNights, 14);
  assert.equal(result.pausedSiteNights, 28);
});

test("Build 162 distinguishes legitimate zero inventory from an unavailable source", () => {
  const result = summarizeOccupancyRows(
    dates(14, {
      totalSites: 0,
      operatingSites: 0,
      pausedSites: 0,
      bookedSites: 0,
      heldSites: 0,
      pendingSites: 0,
    }),
  );
  assert.equal(result.days[0].bookedPercent, 0);
  assert.throws(() => summarizeOccupancyRows([]), /fourteen/);
  assert.throws(() => summarizeOccupancyRows(dates(13)), /fourteen/);
});

test("Build 162 rejects invalid or contradictory source counts", () => {
  assert.throws(
    () => summarizeOccupancyRows(dates(14, { bookedSites: 21 })),
    /impossible/,
  );
  assert.throws(
    () => summarizeOccupancyRows(dates(14, { pendingSites: -1 })),
    /Invalid/,
  );
  assert.throws(
    () => summarizeOccupancyRows(dates(14, { pausedSites: 1.3 })),
    /Invalid/,
  );
});

test("Build 162 occupancy SQL is scope-bound, read-only and includes all relevant states", () => {
  const code = readFileSync(
    new URL("../lib/command-centre/occupancy-postgres.mjs", import.meta.url),
    "utf8",
  );
  assert.match(code, /reports\.read/);
  assert.match(code, /reservation\.read/);
  assert.match(code, /accommodation\.read/);
  assert.match(code, /set local role icamp_app/);
  assert.match(code, /set_config\('icamp\.user_id'/);
  assert.match(code, /r\.campground_id=\$1/);
  assert.match(code, /seasonal_assignments/);
  assert.match(code, /reservation_holds/);
  assert.match(
    code,
    /status_state in \('closed','maintenance','inspection','winterized'\)/,
  );
  assert.doesNotMatch(code, /\binsert\s+into\b|\bdelete\s+from\b/i);
});

test("Build 162 assistance board links to real triage and never activates messaging", () => {
  const board = readFileSync(
    new URL("../components/camper-assistance-board.tsx", import.meta.url),
    "utf8",
  );
  const page = readFileSync(
    new URL(
      "../app/workspaces/management/command/assistance/page.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(board, /assistance-case-/);
  assert.match(board, /"urgent"/);
  assert.match(board, /"unassigned"/);
  assert.match(board, /Read-only board/);
  assert.match(
    page,
    /listAssistanceQueue\(\s*session\.user\.id,\s*selected\.campgroundId,?\s*\)/,
  );
  assert.match(page, /reports\.read/);
  assert.doesNotMatch(
    page,
    /recordAssistanceGuestMessageAction|sendSms|sendEmail/,
  );
});

test("Build 162 owner review is explicit feedback, not persisted authorization", () => {
  const review = readFileSync(
    new URL("../components/standard-theme-owner-review.tsx", import.meta.url),
    "utf8",
  );
  const route = readFileSync(
    new URL("../app/settings/themes/acceptance/page.tsx", import.meta.url),
    "utf8",
  );
  assert.match(review, /not a stored approval/);
  assert.match(review, /navigator\.clipboard\.writeText/);
  assert.match(route, /requireAnyCampgroundPermission\(\s*"reports\.read"/);
  assert.match(route, /does not enable subscription billing/);
});
