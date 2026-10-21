import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  aquaticFacilityTypes,
  aquaticOperationalState,
  aquaticPublicStateFromOperational,
  aquaticPublicStates,
  validateAquaticDecisionInput,
  validateAquaticProgramInput,
} from "../lib/aquatics/core.mjs";

test("Build 069 models Pool/Water-Park operating states without duplicating asset status", () => {
  assert.deepEqual(aquaticFacilityTypes, ["pool", "water_park"]);
  assert.deepEqual(aquaticPublicStates, ["open", "limited", "closed"]);
  assert.equal(aquaticOperationalState("open"), "operational");
  assert.equal(aquaticOperationalState("limited"), "limited");
  assert.equal(aquaticOperationalState("closed"), "closed");
  assert.equal(aquaticPublicStateFromOperational("maintenance"), "closed");
});

test("Build 069 validates operating programs and safety decision reasons", () => {
  const program = validateAquaticProgramInput({
    assetId: "asset",
    inspectionTemplateId: "template",
    maintenanceScheduleId: "schedule",
    reopenInspectionMaxAgeMinutes: "240",
    notes: "Main pool opening checks",
  });
  assert.equal(program.reopenInspectionMaxAgeMinutes, 240);
  assert.equal(program.isActive, true);

  const decision = validateAquaticDecisionInput({
    publicState: "closed",
    reason: "Water chemistry requires immediate closure.",
  });
  assert.equal(decision.operationalState, "closed");

  assert.throws(
    () =>
      validateAquaticDecisionInput({
        publicState: "open",
        reason: "short",
      }),
    /between 8 and 1000 characters/u,
  );
});

test("Build 069 schema binds existing scheduler, inspection and asset authorities", () => {
  const migration = fs.readFileSync(
    new URL(
      "../database/migrations/0089_pool_waterpark_maintenance_operations.sql",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(migration, /aquatic_facility_programs/u);
  assert.match(migration, /aquatic_inspection_evidence/u);
  assert.match(migration, /aquatic_operation_decisions/u);
  assert.match(migration, /references public\.maintenance_schedules/iu);
  assert.match(migration, /references public\.inspection_templates/iu);
  assert.match(migration, /references public\.inspection_occurrences/iu);
  assert.match(migration, /references public\.maintenance_work_orders/iu);
  assert.match(migration, /operational_asset_status_history/u);
  assert.match(migration, /aquatics\.reopen/u);
  assert.match(migration, /'high'/u);
  assert.match(migration, /force row level security/iu);
  assert.match(
    migration,
    /Aquatic reopening is blocked by unresolved failed inspection work/u,
  );
  assert.match(
    migration,
    /Aquatic reopening requires inspection sign-off after the latest restriction/u,
  );
});

test("Build 069 service links due recurring work to signed inspection evidence", () => {
  const service = fs.readFileSync(
    new URL("../lib/aquatics/postgres.mjs", import.meta.url),
    "utf8",
  );

  assert.match(service, /maintenance_schedule_occurrences/u);
  assert.match(service, /inspection_occurrences/u);
  assert.match(service, /aquatic_inspection_evidence/u);
  assert.match(service, /maintenance_work_orders/u);
  assert.match(service, /operational_assets/u);
  assert.match(service, /icamp\.status_reason/u);
  assert.match(service, /operational_asset\.status\.transition/u);
  assert.match(service, /aquatics\.operation\./u);
  assert.match(service, /inspection\.perform/u);
  assert.match(service, /asset\.manage/u);
});

test("Build 069 Web/PWA exposes program, inspection and safety-state controls", () => {
  const page = fs.readFileSync(
    new URL(
      "../app/workspaces/maintenance/aquatics/page.tsx",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(page, /Pool & Water-Park Maintenance Operations/u);
  assert.match(page, /Create program/u);
  assert.match(page, /Start signed safety inspection/u);
  assert.match(page, /Move to limited operation/u);
  assert.match(page, /Close facility/u);
  assert.match(page, /Reopen from signed inspection/u);
  assert.match(page, /Aquatic check history/u);
  assert.match(page, /Restriction & reopen history/u);
  assert.match(page, /does not replace certified pool\/water-park safety/u);
});

test("Build 069 does not bypass the theme prerequisite recorded by Build 068", () => {
  const roadmap = fs.readFileSync(
    new URL("../docs/BUILD_ROADMAP.md", import.meta.url),
    "utf8",
  );
  assert.match(roadmap, /standard theme ruleset and token contract/u);
  assert.match(roadmap, /No future visual\/style build should bypass/u);
});
