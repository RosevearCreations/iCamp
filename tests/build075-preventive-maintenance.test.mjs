import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  formatPreventiveAssetClass,
  preventiveAssetClasses,
  preventiveInstructionSteps,
  validatePreventiveMaintenanceProgramInput,
  validatePreventiveMaintenanceTemplateInput,
} from "../lib/preventive-maintenance/core.mjs";

test("Build 075 validates preventive templates and immutable program bindings", () => {
  assert.deepEqual(preventiveAssetClasses, [
    "facility",
    "equipment",
    "either",
  ]);

  const template = validatePreventiveMaintenanceTemplateInput({
    targetAssetClass: "equipment",
    name: "Seasonal mower service",
    description: "Pre-season service definition.",
    serviceInstructions:
      "Change engine oil\nInspect belt condition\nSharpen mower blades",
  });
  assert.equal(template.targetAssetClass, "equipment");
  assert.equal(preventiveInstructionSteps(template.serviceInstructions).length, 3);
  assert.equal(formatPreventiveAssetClass("either"), "Facility or equipment");

  const program = validatePreventiveMaintenanceProgramInput({
    assetId: "asset",
    templateId: "template",
    maintenanceScheduleId: "schedule",
    notes: "Run before peak season.",
  });
  assert.equal(program.isActive, true);

  assert.throws(
    () =>
      validatePreventiveMaintenanceTemplateInput({
        targetAssetClass: "unknown",
        name: "Bad template",
        serviceInstructions: "Do work",
      }),
    /target class is invalid/u,
  );
});

test("Build 075 schema reuses canonical assets and recurring schedules", () => {
  const migration = fs.readFileSync(
    new URL(
      "../database/migrations/0096_preventive_maintenance_program.sql",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(migration, /preventive_maintenance_templates/u);
  assert.match(migration, /preventive_maintenance_programs/u);
  assert.match(migration, /references public\.operational_assets/iu);
  assert.match(migration, /references public\.maintenance_schedules/iu);
  assert.match(migration, /maintenance\.preventive/u);
  assert.match(
    migration,
    /schedule must target the exact canonical asset/u,
  );
  assert.match(migration, /force row level security/iu);
  assert.doesNotMatch(
    migration,
    /grant[^;]*delete[^;]*preventive_maintenance/iu,
  );
});

test("Build 075 service reads parts and labour from canonical work orders", () => {
  const service = fs.readFileSync(
    new URL("../lib/preventive-maintenance/postgres.mjs", import.meta.url),
    "utf8",
  );

  assert.match(service, /maintenance_schedule_occurrences/u);
  assert.match(service, /maintenance_work_orders/u);
  assert.match(service, /maintenance_work_order_materials/u);
  assert.match(service, /maintenance_work_order_labor/u);
  assert.match(service, /maintenance\.preventive/u);
  assert.match(service, /maintenance\.schedule/u);
  assert.doesNotMatch(
    service,
    /insert into public\.maintenance_work_orders/u,
  );
});

test("Build 075 Web/PWA exposes overdue service and canonical history", () => {
  const page = fs.readFileSync(
    new URL(
      "../app/workspaces/maintenance/preventive/page.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const workspace = fs.readFileSync(
    new URL("../app/workspaces/[workspace]/page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(page, /Preventive Maintenance Program/u);
  assert.match(page, /Create service template/u);
  assert.match(page, /Bind template to recurring schedule/u);
  assert.match(page, /Overdue preventive work/u);
  assert.match(page, /Parts & labour history/u);
  assert.match(page, /Build 067 owns service intervals/u);
  assert.match(page, /Build 065 owns work-order completion/u);
  assert.match(page, /Web\/PWA/u);
  assert.match(page, /IVR\/DTMF/u);
  assert.match(page, /SMS\/MMS/u);
  assert.match(workspace, /maintenance-preventive-heading/u);
  assert.match(workspace, /Build 075/u);
});

test("Build 075 preserves the standard multi-theme prerequisite", () => {
  const roadmap = fs.readFileSync(
    new URL("../docs/BUILD_ROADMAP.md", import.meta.url),
    "utf8",
  );
  assert.match(roadmap, /standard theme ruleset and token contract/u);
  assert.match(roadmap, /No future visual\/style build should bypass/u);
});
