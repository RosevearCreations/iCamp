import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  cleanlinessStates,
  facilityIssueKinds,
  facilityUpkeepKinds,
  fixtureStates,
  supplyStates,
  validateFacilityIssueInput,
  validateFacilitySnapshotInput,
  validateFacilityUpkeepProgramInput,
} from "../lib/facility-upkeep/core.mjs";

test("Build 070 models washroom, shower and laundry upkeep states", () => {
  assert.deepEqual(facilityUpkeepKinds, [
    "washroom",
    "shower",
    "laundry",
    "combined",
  ]);
  assert.deepEqual(cleanlinessStates, [
    "clean",
    "service_due",
    "closed_for_service",
  ]);
  assert.deepEqual(fixtureStates, [
    "operational",
    "attention",
    "out_of_service",
  ]);
  assert.deepEqual(supplyStates, ["stocked", "low", "out", "not_applicable"]);
  assert.ok(facilityIssueKinds.includes("laundry_machine"));
});

test("Build 070 validates programs, snapshots and issue escalation", () => {
  const program = validateFacilityUpkeepProgramInput({
    assetId: "asset",
    facilityKind: "combined",
    inspectionTemplateId: "template",
    maintenanceScheduleId: "schedule",
    notes: "Main comfort station",
  });
  assert.equal(program.facilityKind, "combined");
  assert.equal(program.isActive, true);

  const snapshot = validateFacilitySnapshotInput({
    cleanlinessState: "service_due",
    fixtureState: "attention",
    supplyState: "low",
    notes: "Paper stock is low.",
  });
  assert.equal(snapshot.supplyState, "low");

  const issue = validateFacilityIssueInput({
    issueKind: "fixture",
    title: "Shower valve leaking",
    description: "Valve is leaking after shutoff.",
    categoryId: "building",
    priorityPolicyId: "normal",
  });
  assert.equal(issue.issueKind, "fixture");

  assert.throws(
    () =>
      validateFacilitySnapshotInput({
        cleanlinessState: "bad",
        fixtureState: "operational",
        supplyState: "stocked",
      }),
    /Cleanliness state is invalid/u,
  );
});

test("Build 070 schema reuses canonical scheduler, inspection and work orders", () => {
  const migration = fs.readFileSync(
    new URL(
      "../database/migrations/0090_washroom_shower_laundry_upkeep.sql",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(migration, /facility_upkeep_programs/u);
  assert.match(migration, /facility_upkeep_inspection_evidence/u);
  assert.match(migration, /facility_upkeep_snapshots/u);
  assert.match(migration, /facility_upkeep_issue_links/u);
  assert.match(migration, /references public\.maintenance_schedules/iu);
  assert.match(migration, /references public\.inspection_templates/iu);
  assert.match(migration, /references public\.inspection_occurrences/iu);
  assert.match(migration, /references public\.maintenance_work_orders/iu);
  assert.match(migration, /force row level security/iu);
  assert.doesNotMatch(migration, /grant[^;]*delete[^;]*facility_upkeep/iu);
  assert.match(
    migration,
    /Work-order status is the sole issue closure authority/u,
  );
});

test("Build 070 service creates canonical work orders and links scheduled evidence", () => {
  const service = fs.readFileSync(
    new URL("../lib/facility-upkeep/postgres.mjs", import.meta.url),
    "utf8",
  );

  assert.match(service, /createMaintenanceWorkOrder/u);
  assert.match(service, /maintenance_schedule_occurrences/u);
  assert.match(service, /inspection_occurrences/u);
  assert.match(service, /facility_upkeep_issue_links/u);
  assert.match(service, /maintenance\.schedule/u);
  assert.match(service, /maintenance\.create/u);
  assert.match(service, /inspection\.perform/u);
  assert.match(service, /completed.*cancelled/u);
});

test("Build 070 Web/PWA exposes scheduled cleaning, status and corrective work", () => {
  const page = fs.readFileSync(
    new URL(
      "../app/workspaces/maintenance/facilities/page.tsx",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(page, /Washroom, Shower & Laundry Upkeep/u);
  assert.match(page, /Recurring cleaning schedule/u);
  assert.match(page, /Start scheduled inspection/u);
  assert.match(page, /Record facility status/u);
  assert.match(page, /Create maintenance work order/u);
  assert.match(page, /Facility corrective-work register/u);
  assert.match(page, /does not maintain a second issue-status field/u);
});

test("Build 070 preserves the theme prerequisite recorded by Build 068", () => {
  const roadmap = fs.readFileSync(
    new URL("../docs/BUILD_ROADMAP.md", import.meta.url),
    "utf8",
  );
  assert.match(roadmap, /standard theme ruleset and token contract/u);
  assert.match(roadmap, /No future visual\/style build should bypass/u);
});
