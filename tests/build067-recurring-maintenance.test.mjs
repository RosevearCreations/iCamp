import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  maintenanceCatchUpModes,
  maintenanceRecurrenceKinds,
  recurrenceLabel,
  validateFirstOccurrenceLocal,
  validateMaintenanceScheduleInput,
} from "../lib/maintenance-scheduler/core.mjs";

test("Build 067 supports the required maintenance recurrence kinds", () => {
  assert.deepEqual(maintenanceRecurrenceKinds, [
    "hourly",
    "every_n_hours",
    "daily",
    "weekly",
    "monthly",
    "seasonal",
    "custom",
  ]);
  assert.deepEqual(maintenanceCatchUpModes, ["create_late", "mark_missed"]);
});

test("Build 067 validates recurring maintenance definitions", () => {
  const base = {
    title: "Inspect washroom fixtures",
    categoryId: "category",
    priorityPolicyId: "priority",
    locationDescription: "Main washroom",
    firstOccurrenceLocal: "2026-10-21T08:00",
    missedAfterMinutes: "120",
    catchUpMode: "create_late",
  };

  assert.equal(
    validateMaintenanceScheduleInput({
      ...base,
      recurrenceKind: "daily",
    }).intervalValue,
    1,
  );
  assert.equal(
    validateMaintenanceScheduleInput({
      ...base,
      recurrenceKind: "every_n_hours",
      intervalValue: "6",
    }).intervalValue,
    6,
  );
  assert.equal(
    validateMaintenanceScheduleInput({
      ...base,
      recurrenceKind: "monthly",
      monthDay: "21",
    }).monthDay,
    21,
  );
  assert.equal(
    recurrenceLabel({
      recurrenceKind: "custom",
      intervalValue: 90,
    }),
    "Every 90 minutes",
  );
  assert.throws(
    () => validateFirstOccurrenceLocal("2026-10-21"),
    /local date and time/u,
  );
});

test("Build 067 migration reuses Build 007 and Build 065 authorities", () => {
  const migration = fs.readFileSync(
    new URL(
      "../database/migrations/0086_recurring_maintenance_scheduler.sql",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(migration, /maintenance\.schedule/u);
  assert.match(migration, /icamp_private\.job_schedules/u);
  assert.match(migration, /maintenance\.schedule\.materialize/u);
  assert.match(migration, /references public\.maintenance_work_orders/iu);
  assert.match(migration, /maintenance_schedule_occurrences_scope_unique/u);
  assert.match(migration, /force row level security/iu);
  assert.match(migration, /next_maintenance_occurrence/iu);
  assert.match(
    migration,
    /definition is immutable; deactivate and create a replacement schedule/u,
  );
});

test("Build 067 service provides durable occurrence materialization and worker orchestration", () => {
  const service = fs.readFileSync(
    new URL(
      "../lib/maintenance-scheduler/postgres.mjs",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(service, /runDueSchedules/u);
  assert.match(service, /claimJob/u);
  assert.match(service, /completeJob/u);
  assert.match(service, /failJob/u);
  assert.match(service, /maintenance_schedule_occurrences/u);
  assert.match(service, /maintenance_work_orders/u);
  assert.match(service, /schedule\.missed_window/u);
  assert.match(service, /schedule\.stale_occurrence/u);
  assert.match(service, /earlier recurring-maintenance occurrence is still pending/iu);
  assert.match(service, /runMaintenanceSchedulerCycle/u);
});

test("Build 067 Web/PWA workspace exposes schedule and occurrence controls", () => {
  const page = fs.readFileSync(
    new URL(
      "../app/workspaces/maintenance/schedules/page.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const actions = fs.readFileSync(
    new URL(
      "../app/workspaces/maintenance/schedules/actions.ts",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(page, /Recurring Maintenance Scheduler/u);
  assert.match(page, /Hourly/u);
  assert.match(page, /Every N hours/u);
  assert.match(page, /Weekly/u);
  assert.match(page, /Monthly/u);
  assert.match(page, /Seasonal/u);
  assert.match(page, /Custom minute interval/u);
  assert.match(page, /Latest maintenance occurrences/u);
  assert.match(actions, /maintenance\.schedule/u);
});
