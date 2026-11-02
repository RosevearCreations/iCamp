import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  buildTurnoverReleaseBoard,
  evaluateTurnoverRelease,
  normalizeReleaseFilters,
} from "../lib/turnover-release/core.mjs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const cottage = {
  id: "cottage-turnover-1",
  cottageCode: "C-07",
  cottageName: "Birch Lodge",
  accommodationStatusState: "inspection",
  releaseRequired: true,
  releasedAt: null,
  status: "inspection",
  finalInspectionTemplateId: "template-1",
  rowVersion: 7,
  requiredItems: 4,
  checkedRequiredItems: 4,
  checklistIssues: 0,
  housekeepingInspectionResult: "pass",
  linenComplete: true,
  housekeepingComplete: true,
  inventoryComplete: true,
  damageFound: false,
  securityIssueFound: false,
  inspectionStatus: "signed_off",
  openCorrectiveWorkOrders: 0,
  openSiteWorkOrders: 0,
};
const campsite = {
  id: "site-cleanup-1",
  campsiteCode: "T-03",
  campsiteName: "Riverside Tent",
  accommodationStatusState: "inspection",
  programId: "program-1",
  rowVersion: 5,
  blockRebookingUntilClear: true,
  inspectionStatus: "signed_off",
  clearedAt: null,
  openCorrectiveWorkOrders: 0,
  openSiteWorkOrders: 0,
};

test("Build186 makes readiness depend on all housekeeping, sign-off and site work orders", () => {
  assert.deepEqual(evaluateTurnoverRelease({ ...cottage, kind: "cottage" }), {
    status: "ready",
    blockers: [],
    restoresAvailability: true,
    recordOnly: false,
  });
  const blocked = evaluateTurnoverRelease({
    ...cottage,
    kind: "cottage",
    linenComplete: false,
    openSiteWorkOrders: 2,
  });
  assert.equal(blocked.status, "blocked");
  assert.match(
    blocked.blockers.join(" "),
    /linen.*2 accommodation maintenance/i,
  );
  assert.equal(
    evaluateTurnoverRelease({
      ...cottage,
      kind: "cottage",
      inspectionStatus: "submitted",
    }).status,
    "blocked",
  );
  assert.equal(
    evaluateTurnoverRelease({ ...cottage, kind: "cottage", checklistIssues: 1 })
      .status,
    "blocked",
  );
});

test("Build186 preserves protected and nonblocking canonical availability state", () => {
  assert.deepEqual(evaluateTurnoverRelease({ ...campsite, kind: "campsite" }), {
    status: "ready",
    blockers: [],
    restoresAvailability: true,
    recordOnly: false,
  });
  const nonblocking = evaluateTurnoverRelease({
    ...campsite,
    kind: "campsite",
    blockRebookingUntilClear: false,
  });
  assert.equal(nonblocking.status, "ready");
  assert.equal(nonblocking.restoresAvailability, false);
  const maintenance = evaluateTurnoverRelease({
    ...campsite,
    kind: "campsite",
    accommodationStatusState: "maintenance",
  });
  assert.equal(maintenance.restoresAvailability, false);
  assert.equal(
    evaluateTurnoverRelease({ ...campsite, kind: "campsite", programId: null })
      .status,
    "blocked",
  );
  assert.equal(
    evaluateTurnoverRelease({
      ...campsite,
      kind: "campsite",
      openSiteWorkOrders: 1,
    }).status,
    "blocked",
  );
  assert.equal(
    evaluateTurnoverRelease({
      ...campsite,
      kind: "campsite",
      clearedAt: "2026-11-01T00:00:00Z",
    }).status,
    "released",
  );
});

test("Build186 combines and filters canonical sources without mixing campgrounds", () => {
  assert.deepEqual(
    normalizeReleaseFilters({
      view: "inject",
      kind: "invalid",
      query: "  C-07  ",
    }),
    { view: "all", kind: "all", query: "c-07" },
  );
  assert.equal(
    normalizeReleaseFilters({ query: "x".repeat(200) }).query.length,
    80,
  );
  const board = buildTurnoverReleaseBoard({
    cottages: [cottage, { ...cottage, id: "cancelled", status: "cancelled" }],
    campsites: [{ ...campsite, openSiteWorkOrders: 1 }],
    filters: { view: "blocked", kind: "campsite", query: "maintenance" },
  });
  assert.deepEqual(board.counts, {
    total: 2,
    ready: 1,
    blocked: 1,
    released: 0,
  });
  assert.equal(board.rows.length, 1);
  assert.equal(
    board.rows[0].sourceHref,
    "/workspaces/maintenance/departure-cleanup",
  );
});

test("Build186 uses authoritative source mutations and SQL database release guard", () => {
  const cottageSql = read("../lib/cottage-turnover-operations/postgres.mjs");
  const siteSql = read("../lib/campsite-departure-cleanup/postgres.mjs");
  const guard = read(
    "../database/migrations/0196_build186_turnover_maintenance_release_guard.sql",
  );
  const page = read("../app/workspaces/maintenance/turnover-release/page.tsx");
  assert.match(cottageSql, /open_site_work_orders/);
  assert.match(siteSql, /Open maintenance work orders for this campsite/);
  assert.match(guard, /new\.status_state='available'/);
  assert.match(guard, /wo\.status not in \('completed','cancelled'\)/);
  assert.match(page, /releaseReviewedCottageTurnoverAction/);
  assert.match(page, /clearReviewedCampsiteTurnoverAction/);
  assert.doesNotMatch(page, /payment\.capture|sendSMS|chargeCard/);
});
