import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  formatTargetMinutes,
  maintenancePriorityKeys,
  sortMaintenancePriorities,
  standardMaintenanceCategories,
  validateMaintenanceCategoryInput,
  validateMaintenancePriorityTarget,
} from "../lib/maintenance-taxonomy/core.mjs";

test("Build 064 exposes the required standard maintenance taxonomy", () => {
  const codes = standardMaintenanceCategories.map((category) => category.code);
  for (const code of [
    "garbage",
    "fire",
    "septic",
    "water",
    "electrical",
    "grounds",
    "building",
  ]) {
    assert.ok(codes.includes(code), `missing standard category ${code}`);
  }
});

test("Build 064 validates extensible custom maintenance categories", () => {
  const category = validateMaintenanceCategoryInput({
    code: "Pool Equipment",
    name: "Pool Equipment",
    description: "Pumps, filters and water-play mechanical equipment.",
  });
  assert.equal(category.code, "pool_equipment");
  assert.equal(category.name, "Pool Equipment");

  assert.throws(
    () =>
      validateMaintenanceCategoryInput({
        code: "1bad",
        name: "Invalid",
      }),
    /Category code/u,
  );
});

test("Build 064 validates priority targets and preserves canonical order", () => {
  assert.deepEqual(maintenancePriorityKeys, [
    "emergency",
    "urgent",
    "normal",
    "preventive",
  ]);

  const target = validateMaintenancePriorityTarget({
    priorityKey: "urgent",
    targetResponseMinutes: 60,
    targetCompletionMinutes: 240,
    instructions: "Same shift.",
  });
  assert.equal(target.priorityKey, "urgent");
  assert.equal(target.targetCompletionMinutes, 240);

  assert.throws(
    () =>
      validateMaintenancePriorityTarget({
        priorityKey: "normal",
        targetResponseMinutes: 480,
        targetCompletionMinutes: 60,
      }),
    /cannot be shorter/u,
  );

  assert.deepEqual(
    sortMaintenancePriorities([
      { priorityKey: "preventive" },
      { priorityKey: "emergency" },
      { priorityKey: "normal" },
      { priorityKey: "urgent" },
    ]).map((entry) => entry.priorityKey),
    ["emergency", "urgent", "normal", "preventive"],
  );
});

test("Build 064 renders human-friendly target durations", () => {
  assert.equal(formatTargetMinutes(15), "15 minutes");
  assert.equal(formatTargetMinutes(60), "1 hour");
  assert.equal(formatTargetMinutes(1440), "1 day");
  assert.equal(formatTargetMinutes(10080), "1 week");
});

test("Build 064 schema preserves RLS, canonical seeds and no-delete posture", () => {
  const migration = fs.readFileSync(
    new URL(
      "../database/migrations/0082_maintenance_taxonomy_priority_model.sql",
      import.meta.url,
    ),
    "utf8",
  );
  const service = fs.readFileSync(
    new URL("../lib/maintenance-taxonomy/postgres.mjs", import.meta.url),
    "utf8",
  );

  assert.match(migration, /create table public\.maintenance_categories/u);
  assert.match(
    migration,
    /create table public\.maintenance_priority_policies/u,
  );
  assert.match(migration, /force row level security/iu);
  assert.match(migration, /campgrounds_seed_maintenance_taxonomy/u);
  assert.match(migration, /'garbage'/u);
  assert.match(migration, /'emergency'/u);
  assert.match(migration, /maintenance\.assign/u);
  assert.doesNotMatch(migration, /grant[^;]*delete/iu);
  assert.match(service, /appendAuditEvent/u);
  assert.match(service, /maintenance\.assign/u);
});
