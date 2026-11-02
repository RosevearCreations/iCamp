import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  infrastructureIssueKinds,
  infrastructureMaintenanceKinds,
  safetyStates,
  serviceStates,
  surfaceStates,
  validateInfrastructureIssueInput,
  validateInfrastructureMaintenanceProgramInput,
  validateInfrastructureSnapshotInput,
} from "../lib/infrastructure-maintenance/core.mjs";

test("Build 072 models canonical infrastructure profiles and condition states", () => {
  assert.deepEqual(infrastructureMaintenanceKinds, [
    "road",
    "parking",
    "utility",
    "garbage_area",
    "septic_area",
  ]);
  assert.deepEqual(surfaceStates, [
    "ready",
    "attention",
    "unsafe",
    "not_applicable",
  ]);
  assert.deepEqual(safetyStates, [
    "clear",
    "monitor",
    "restrict_use",
    "close_area",
  ]);
  assert.deepEqual(serviceStates, [
    "operational",
    "attention",
    "out_of_service",
    "not_applicable",
  ]);
  assert.ok(infrastructureIssueKinds.includes("road_surface"));
  assert.ok(infrastructureIssueKinds.includes("water_supply"));
  assert.ok(infrastructureIssueKinds.includes("sewer_septic"));
  assert.ok(infrastructureIssueKinds.includes("garbage_recycling"));
});

test("Build 072 validates programs, snapshots and issue escalation", () => {
  const program = validateInfrastructureMaintenanceProgramInput({
    assetId: "asset",
    profileKind: "utility",
    inspectionTemplateId: "template",
    maintenanceScheduleId: "schedule",
    notes: "North campground water service",
  });
  assert.equal(program.profileKind, "utility");
  assert.equal(program.isActive, true);

  const snapshot = validateInfrastructureSnapshotInput({
    surfaceState: "not_applicable",
    safetyState: "monitor",
    serviceState: "operational",
    notes: "Pressure stable; inspect enclosure after overnight rain.",
  });
  assert.equal(snapshot.safetyState, "monitor");

  const issue = validateInfrastructureIssueInput({
    issueKind: "water_supply",
    title: "Low pressure at north loop",
    description: "Pressure is below the normal service range.",
    categoryId: "utilities",
    priorityPolicyId: "urgent",
  });
  assert.equal(issue.issueKind, "water_supply");

  assert.throws(
    () =>
      validateInfrastructureSnapshotInput({
        surfaceState: "bad",
        safetyState: "clear",
        serviceState: "operational",
      }),
    /Surface state is invalid/u,
  );
});

test("Build 072 schema reuses canonical scheduler, inspection, work orders and infrastructure assets", () => {
  const migration = fs.readFileSync(
    new URL(
      "../database/migrations/0092_roads_utilities_garbage_septic_maintenance.sql",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(migration, /infrastructure_maintenance_programs/u);
  assert.match(migration, /infrastructure_maintenance_inspection_evidence/u);
  assert.match(migration, /infrastructure_maintenance_snapshots/u);
  assert.match(migration, /infrastructure_maintenance_issue_links/u);
  assert.match(migration, /references public\.maintenance_schedules/iu);
  assert.match(migration, /references public\.inspection_templates/iu);
  assert.match(migration, /references public\.inspection_occurrences/iu);
  assert.match(migration, /references public\.maintenance_work_orders/iu);
  assert.match(
    migration,
    /'road','parking','utility','garbage_area','septic_area'/u,
  );
  assert.match(migration, /profile_kind <> facility_type_value/u);
  assert.match(migration, /force row level security/iu);
  assert.doesNotMatch(
    migration,
    /grant[^;]*delete[^;]*infrastructure_maintenance/iu,
  );
  assert.match(
    migration,
    /Work-order status is the sole issue closure authority/u,
  );
});

test("Build 072 service creates canonical work orders and links scheduled evidence", () => {
  const service = fs.readFileSync(
    new URL("../lib/infrastructure-maintenance/postgres.mjs", import.meta.url),
    "utf8",
  );

  assert.match(service, /createMaintenanceWorkOrder/u);
  assert.match(service, /maintenance_schedule_occurrences/u);
  assert.match(service, /inspection_occurrences/u);
  assert.match(service, /infrastructure_maintenance_issue_links/u);
  assert.match(service, /maintenance\.schedule/u);
  assert.match(service, /maintenance\.create/u);
  assert.match(service, /inspection\.perform/u);
  assert.match(service, /completed.*cancelled/u);
  assert.match(service, /program\.profileKind === facilityType/u);
});

test("Build 072 Web/PWA exposes condition, status and corrective work", () => {
  const page = fs.readFileSync(
    new URL(
      "../app/workspaces/maintenance/infrastructure/page.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const actions = fs.readFileSync(
    new URL(
      "../app/workspaces/maintenance/infrastructure/actions.ts",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(page, /Roads, Utilities, Garbage & Septic Maintenance/u);
  assert.match(page, /Recurring maintenance schedule/u);
  assert.match(page, /Start scheduled inspection/u);
  assert.match(page, /Record infrastructure condition/u);
  assert.match(page, /Create maintenance work order/u);
  assert.match(page, /Infrastructure corrective-work register/u);
  assert.match(page, /Canonical operating state/u);
  assert.match(actions, /transitionOperationalAssetStatus/u);
  assert.match(actions, /asset\.manage/u);
});

test("Build 072 preserves the theme prerequisite recorded by Build 068", () => {
  const roadmap = fs.readFileSync(
    new URL("../docs/BUILD_ROADMAP.md", import.meta.url),
    "utf8",
  );
  assert.match(roadmap, /standard theme ruleset and token contract/u);
  assert.match(roadmap, /No future visual\/style build should bypass/u);
});
