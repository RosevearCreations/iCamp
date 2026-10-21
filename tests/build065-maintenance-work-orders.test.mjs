import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  formatMaintenanceStatus,
  maintenanceWorkOrderStatuses,
  validateCompletionSummary,
  validateMaintenanceLaborInput,
  validateMaintenanceMaterialInput,
  validateMaintenanceStatusTransition,
  validateMaintenanceWorkOrderInput,
} from "../lib/maintenance-work-orders/core.mjs";

test("Build 065 exposes the canonical maintenance work-order lifecycle", () => {
  assert.deepEqual(maintenanceWorkOrderStatuses, [
    "open",
    "assigned",
    "in_progress",
    "blocked",
    "completed",
    "cancelled",
  ]);
  assert.equal(
    validateMaintenanceStatusTransition("open", "assigned"),
    "assigned",
  );
  assert.equal(
    validateMaintenanceStatusTransition("assigned", "in_progress"),
    "in_progress",
  );
  assert.equal(
    validateMaintenanceStatusTransition("in_progress", "completed"),
    "completed",
  );
  assert.throws(
    () => validateMaintenanceStatusTransition("completed", "open"),
    /Unsupported maintenance status transition/u,
  );
  assert.throws(
    () => validateMaintenanceStatusTransition("open", "completed"),
    /Unsupported maintenance status transition/u,
  );
  assert.equal(formatMaintenanceStatus("in_progress"), "In Progress");
});

test("Build 065 requires canonical classification and a real maintenance target", () => {
  const workOrder = validateMaintenanceWorkOrderInput({
    title: "Repair pedestal breaker",
    description: "Breaker trips under ordinary campsite load.",
    categoryId: "category-1",
    priorityPolicyId: "priority-1",
    assetId: "asset-1",
  });
  assert.equal(workOrder.assetId, "asset-1");
  assert.equal(workOrder.sectionId, null);

  assert.throws(
    () =>
      validateMaintenanceWorkOrderInput({
        title: "Repair pedestal breaker",
        categoryId: "category-1",
        priorityPolicyId: "priority-1",
      }),
    /Choose a section, asset, accommodation, or enter a location description/u,
  );
});

test("Build 065 validates material, labour and completion evidence", () => {
  assert.deepEqual(
    validateMaintenanceMaterialInput({
      itemName: "30 amp breaker",
      quantity: "2",
      unit: "each",
      unitCostCents: "1899",
    }),
    {
      itemName: "30 amp breaker",
      quantity: 2,
      unit: "each",
      unitCostCents: 1899,
    },
  );

  assert.deepEqual(
    validateMaintenanceLaborInput({
      workerUserId: "",
      minutes: "75",
      note: "Isolated power before replacement.",
    }),
    {
      workerUserId: null,
      minutes: 75,
      note: "Isolated power before replacement.",
    },
  );

  assert.equal(
    validateCompletionSummary("Breaker replaced and pedestal load-tested."),
    "Breaker replaced and pedestal load-tested.",
  );
  assert.throws(
    () => validateCompletionSummary("fixed"),
    /Completion summary/u,
  );
});

test("Build 065 schema reuses Build 064 authorities and Build 008 secure media", () => {
  const migration = fs.readFileSync(
    new URL(
      "../database/migrations/0083_maintenance_work_order_engine.sql",
      import.meta.url,
    ),
    "utf8",
  );
  const service = fs.readFileSync(
    new URL("../lib/maintenance-work-orders/postgres.mjs", import.meta.url),
    "utf8",
  );

  for (const table of [
    "maintenance_work_orders",
    "maintenance_work_order_status_events",
    "maintenance_work_order_notes",
    "maintenance_work_order_media",
    "maintenance_work_order_materials",
    "maintenance_work_order_labor",
  ]) {
    assert.match(migration, new RegExp(`public\\.${table}`, "u"));
  }

  assert.match(migration, /references public\.maintenance_categories/iu);
  assert.match(migration, /references public\.maintenance_priority_policies/iu);
  assert.match(migration, /references icamp_private\.media_assets/iu);
  assert.match(migration, /force row level security/iu);
  assert.doesNotMatch(migration, /grant[^;]*delete/iu);
  assert.match(migration, /maintenance\.create/u);
  assert.match(migration, /maintenance\.assign/u);
  assert.match(migration, /maintenance\.complete/u);
  assert.match(
    migration,
    /Closed maintenance work orders cannot be reassigned/u,
  );
  assert.match(migration, /created_by_user_id =\s*nullif/iu);
  assert.match(migration, /recorded_by_user_id =\s*nullif/iu);
  assert.match(service, /appendAuditEvent/u);
  assert.match(service, /row_version=\$3/u);
  assert.match(service, /classification='internal'/u);
  assert.match(service, /validation_state='validated'/u);
  assert.match(service, /lifecycle_state='active'/u);
});

test("Build 065 workspace exposes creation, assignment and evidence controls", () => {
  const page = fs.readFileSync(
    new URL(
      "../app/workspaces/maintenance/work-orders/page.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const actions = fs.readFileSync(
    new URL(
      "../app/workspaces/maintenance/work-orders/actions.ts",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(page, /Create maintenance work order/u);
  assert.match(page, /Save assignment/u);
  assert.match(page, /Complete work order/u);
  assert.match(page, /Attach secure media/u);
  assert.match(page, /Record material/u);
  assert.match(page, /Record labour/u);
  assert.match(actions, /maintenance\.complete/u);
  assert.match(actions, /maintenance\.assign/u);
});
