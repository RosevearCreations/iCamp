import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  surfaceStates,
  recreationIssueKinds,
  recreationMaintenanceKinds,
  safetyStates,
  amenityStates,
  validateRecreationIssueInput,
  validateRecreationSnapshotInput,
  validateRecreationMaintenanceProgramInput,
} from "../lib/recreation-maintenance/core.mjs";

test("Build 071 models washroom, shower and laundry upkeep states", () => {
  assert.deepEqual(recreationMaintenanceKinds, [
    "sports_field",
    "shower",
    "laundry",
    "baseball_softball",
  ]);
  assert.deepEqual(surfaceStates, [
    "ready",
    "attention",
    "closed_for_service",
  ]);
  assert.deepEqual(safetyStates, [
    "operational",
    "attention",
    "out_of_service",
  ]);
  assert.deepEqual(amenityStates, ["operational", "low", "out", "not_applicable"]);
  assert.ok(recreationIssueKinds.includes("laundry_machine"));
});

test("Build 071 validates programs, snapshots and issue escalation", () => {
  const program = validateRecreationMaintenanceProgramInput({
    assetId: "asset",
    profileKind: "baseball_softball",
    inspectionTemplateId: "template",
    maintenanceScheduleId: "schedule",
    notes: "Main comfort station",
  });
  assert.equal(program.profileKind, "baseball_softball");
  assert.equal(program.isActive, true);

  const snapshot = validateRecreationSnapshotInput({
    surfaceState: "attention",
    safetyState: "attention",
    amenityState: "low",
    notes: "Paper stock is low.",
  });
  assert.equal(snapshot.amenityState, "low");

  const issue = validateRecreationIssueInput({
    issueKind: "safety",
    title: "Shower valve leaking",
    description: "Valve is leaking after shutoff.",
    categoryId: "building",
    priorityPolicyId: "normal",
  });
  assert.equal(issue.issueKind, "safety");

  assert.throws(
    () =>
      validateRecreationSnapshotInput({
        surfaceState: "bad",
        safetyState: "operational",
        amenityState: "operational",
      }),
    /Cleanliness state is invalid/u,
  );
});

test("Build 071 schema reuses canonical scheduler, inspection and work orders", () => {
  const migration = fs.readFileSync(
    new URL(
      "../database/migrations/0091_baseball_sports_playground_hall_maintenance.sql",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(migration, /recreation_maintenance_programs/u);
  assert.match(migration, /recreation_maintenance_inspection_evidence/u);
  assert.match(migration, /recreation_maintenance_snapshots/u);
  assert.match(migration, /recreation_maintenance_issue_links/u);
  assert.match(migration, /references public\.maintenance_schedules/iu);
  assert.match(migration, /references public\.inspection_templates/iu);
  assert.match(migration, /references public\.inspection_occurrences/iu);
  assert.match(migration, /references public\.maintenance_work_orders/iu);
  assert.match(migration, /force row level security/iu);
  assert.doesNotMatch(migration, /grant[^;]*delete[^;]*recreation_maintenance/iu);
  assert.match(
    migration,
    /Work-order status is the sole issue closure authority/u,
  );
});

test("Build 071 service creates canonical work orders and links scheduled evidence", () => {
  const service = fs.readFileSync(
    new URL("../lib/recreation-maintenance/postgres.mjs", import.meta.url),
    "utf8",
  );

  assert.match(service, /createMaintenanceWorkOrder/u);
  assert.match(service, /maintenance_schedule_occurrences/u);
  assert.match(service, /inspection_occurrences/u);
  assert.match(service, /recreation_maintenance_issue_links/u);
  assert.match(service, /maintenance\.schedule/u);
  assert.match(service, /maintenance\.create/u);
  assert.match(service, /inspection\.perform/u);
  assert.match(service, /completed.*cancelled/u);
});

test("Build 071 Web/PWA exposes scheduled cleaning, status and corrective work", () => {
  const page = fs.readFileSync(
    new URL(
      "../app/workspaces/maintenance/recreation/page.tsx",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(page, /Baseball, Sports, Playground & Hall Maintenance/u);
  assert.match(page, /Recurring maintenance schedule/u);
  assert.match(page, /Start scheduled inspection/u);
  assert.match(page, /Record recreation condition/u);
  assert.match(page, /Create maintenance work order/u);
  assert.match(page, /Recreation corrective-work register/u);
  assert.match(page, /does not maintain a second issue-status field/u);
});

test("Build 071 preserves the theme prerequisite recorded by Build 068", () => {
  const roadmap = fs.readFileSync(
    new URL("../docs/BUILD_ROADMAP.md", import.meta.url),
    "utf8",
  );
  assert.match(roadmap, /standard theme ruleset and token contract/u);
  assert.match(roadmap, /No future visual\/style build should bypass/u);
});
