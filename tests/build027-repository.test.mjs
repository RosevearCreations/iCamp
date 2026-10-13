import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Build 027 creates protected cottage housekeeping and turnover records", async () => {
  const migration = await readFile(
    "database/migrations/0030_cottage_turnover_housekeeping.sql",
    "utf8",
  );

  assert.match(migration, /cottage_housekeeping_templates/u);
  assert.match(migration, /cottage_inventory_checklist_items/u);
  assert.match(migration, /cottage_turnovers/u);
  assert.match(migration, /cottage_turnover_item_checks/u);
  assert.match(migration, /cottage_damage_inspections/u);
  assert.match(migration, /linen_requirements/u);
  assert.match(migration, /housekeeping_requirements/u);
  assert.match(migration, /damage_inspection_required/u);
  assert.match(migration, /security_inspection_required/u);
  assert.match(migration, /cottage_turnovers_bump_parent_revisions/u);
  assert.match(migration, /force row level security/u);
  assert.match(
    migration,
    /revoke all on public\.cottage_turnovers from authenticated/u,
  );
});

test("Build 027 exposes audited turnover workflow services and actions", async () => {
  const service = await readFile("lib/housekeeping/postgres.mjs", "utf8");
  const actions = await readFile(
    "app/workspaces/management/campgrounds/accommodations/actions.ts",
    "utf8",
  );
  const help = await readFile("lib/help/topics.ts", "utf8");

  assert.match(service, /listCottageHousekeeping/u);
  assert.match(service, /createCottageHousekeepingTemplate/u);
  assert.match(service, /addCottageInventoryChecklistItem/u);
  assert.match(service, /createCottageTurnover/u);
  assert.match(service, /recordCottageTurnoverItemCheck/u);
  assert.match(service, /recordCottageDamageInspection/u);
  assert.match(service, /accommodation\.cottage\.turnover\.inspect/u);
  assert.match(actions, /createCottageHousekeepingTemplateAction/u);
  assert.match(actions, /recordCottageDamageInspectionAction/u);
  assert.match(help, /"cottage\.housekeeping"/u);
  assert.match(help, /Build 030/u);
  assert.match(help, /Build 034/u);
});

test("Build 027 is fully promoted and hands off to Build 028", async () => {
  const build = await readFile("docs/BUILD_027.md", "utf8");
  const queue = await readFile("docs/BUILD_QUEUE.md", "utf8");

  assert.match(build, /Build 027 — Cottage Turnover & Housekeeping Model/u);
  assert.match(build, /FULLY PROMOTED — `main` GREEN/u);
  assert.match(build, /Web\/PWA/u);
  assert.match(build, /IVR\/DTMF/u);
  assert.match(build, /SMS\/MMS/u);
  assert.match(build, /20261013011632/u);
  assert.match(build, /20261013012145/u);
  assert.match(build, /38332092924/u);
  assert.match(
    queue,
    /Build 027 — Cottage Turnover & Housekeeping Model[\s\S]*FULLY PROMOTED — `main` GREEN[\s\S]*Next active build[\s\S]*Build 028 — Site\/Cottage Public Gallery: Up to 10 Images[\s\S]*QUEUED — NOT STARTED/u,
  );
});

test("Build 027 covers hosted foreign-key advisor findings", async () => {
  const indexes = await readFile(
    "database/migrations/0031_cottage_turnover_fk_indexes.sql",
    "utf8",
  );

  assert.match(indexes, /cottage_turnovers_template_scope_idx/u);
  assert.match(indexes, /cottage_turnover_item_checks_source_scope_idx/u);
  assert.match(indexes, /cottage_turnover_item_checks_cottage_idx/u);
});
