import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  deriveEscalationSignals,
  formatEscalationTrigger,
  formatMaintenanceResponsibility,
  maintenanceEscalationTriggers,
  maintenanceResponsibilityLevels,
  mayAssignResponsibility,
  responsibilityRank,
  validateEscalationThresholdMinutes,
} from "../lib/maintenance-foreman/core.mjs";

test("Build 066 exposes the canonical maintenance responsibility hierarchy", () => {
  assert.deepEqual(maintenanceResponsibilityLevels, [
    "crew",
    "foreman",
    "main_foreman",
    "manager",
  ]);
  assert.equal(responsibilityRank("crew"), 1);
  assert.equal(responsibilityRank("manager"), 4);
  assert.equal(mayAssignResponsibility("crew", "crew"), false);
  assert.equal(mayAssignResponsibility("foreman", "crew"), true);
  assert.equal(mayAssignResponsibility("foreman", "foreman"), false);
  assert.equal(mayAssignResponsibility("main_foreman", "foreman"), true);
  assert.equal(mayAssignResponsibility("main_foreman", "main_foreman"), false);
  assert.equal(mayAssignResponsibility("manager", "manager"), true);
  assert.equal(formatMaintenanceResponsibility("main_foreman"), "Main Foreman");
});

test("Build 066 derives high-priority, blocked and overdue escalation signals", () => {
  const policies = maintenanceEscalationTriggers.map((triggerKey) => ({
    triggerKey,
    targetLevel:
      triggerKey === "blocked" || triggerKey === "completion_overdue"
        ? "main_foreman"
        : "foreman",
    thresholdMinutes: triggerKey === "urgent_priority" ? 30 : 0,
    isActive: true,
  }));
  const signals = deriveEscalationSignals(
    {
      priorityKey: "urgent",
      status: "blocked",
      createdAt: "2026-10-20T10:00:00.000Z",
      updatedAt: "2026-10-20T11:00:00.000Z",
      respondedAt: null,
      responseDueAt: "2026-10-20T10:30:00.000Z",
      completionDueAt: "2026-10-20T12:00:00.000Z",
    },
    policies,
    "2026-10-20T13:00:00.000Z",
  );
  assert.deepEqual(
    signals.map((signal) => signal.triggerKey).sort(),
    [
      "blocked",
      "completion_overdue",
      "response_overdue",
      "urgent_priority",
    ],
  );
  assert.equal(formatEscalationTrigger("response_overdue"), "Response Overdue");
});

test("Build 066 validates bounded escalation thresholds", () => {
  assert.equal(validateEscalationThresholdMinutes("0"), 0);
  assert.equal(validateEscalationThresholdMinutes("1440"), 1440);
  assert.throws(
    () => validateEscalationThresholdMinutes("-1"),
    /Escalation threshold/u,
  );
  assert.throws(
    () => validateEscalationThresholdMinutes("1.5"),
    /Escalation threshold/u,
  );
});

test("Build 066 schema reuses Build 065 and enforces hierarchy in PostgreSQL", () => {
  const migration = fs.readFileSync(
    new URL(
      "../database/migrations/0085_maintenance_roles_foreman_escalation.sql",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(migration, /maintenance\.triage/u);
  assert.match(migration, /maintenance\.escalate/u);
  assert.match(migration, /maintenance_foreman/u);
  assert.match(migration, /maintenance_main_foreman/u);
  assert.match(migration, /maintenance_responsibility_rank/iu);
  assert.match(
    migration,
    /references public\.maintenance_work_orders/iu,
  );
  assert.match(migration, /force row level security/iu);
  assert.doesNotMatch(
    migration,
    /grant[^;]*delete[^;]*maintenance_(?:escalation|work_order_escalations)/iu,
  );
  assert.match(
    migration,
    /Maintenance assignment cannot target an equal or higher responsibility level/u,
  );
  assert.match(
    migration,
    /Resolved maintenance escalations are terminal/u,
  );
});

test("Build 066 foreman workspace exposes triage, assignment and escalation controls", () => {
  const page = fs.readFileSync(
    new URL(
      "../app/workspaces/maintenance/foreman/page.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const actions = fs.readFileSync(
    new URL(
      "../app/workspaces/maintenance/foreman/actions.ts",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(page, /Foreman queue & escalation/u);
  assert.match(page, /Maintenance roster/u);
  assert.match(page, /Save assignment/u);
  assert.match(page, /Raise/u);
  assert.match(page, /Acknowledge/u);
  assert.match(page, /Resolve escalation/u);
  assert.match(page, /Campground escalation policy/u);
  assert.match(actions, /maintenance\.triage/u);
  assert.match(actions, /maintenance\.escalate/u);
  assert.match(actions, /maintenance\.assign/u);
});
