import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  offlineMaintenanceOperationKinds,
  validateOfflineMaintenanceOperation,
} from "../lib/offline-maintenance/core.mjs";

const UUIDS = {
  campground: "11111111-1111-4111-8111-111111111111",
  operation: "22222222-2222-4222-8222-222222222222",
  target: "33333333-3333-4333-8333-333333333333",
  item: "44444444-4444-4444-8444-444444444444",
};

test("Build 076 accepts evidence-only offline operation kinds", () => {
  assert.deepEqual(offlineMaintenanceOperationKinds, [
    "work_order_note",
    "inspection_result",
    "work_order_media",
  ]);

  const note = validateOfflineMaintenanceOperation({
    clientOperationId: UUIDS.operation,
    campgroundId: UUIDS.campground,
    operationKind: "work_order_note",
    targetId: UUIDS.target,
    expectedWorkOrderRowVersion: 4,
    note: "Pump belt inspected; replacement should be scheduled.",
  });
  assert.equal(note.operationKind, "work_order_note");

  assert.throws(
    () =>
      validateOfflineMaintenanceOperation({
        clientOperationId: UUIDS.operation,
        campgroundId: UUIDS.campground,
        operationKind: "work_order_complete",
        targetId: UUIDS.target,
      }),
    /only accepts note, checklist-result, and media-evidence/u,
  );
});

test("Build 076 checklist conflicts carry both occurrence and result versions", () => {
  const operation = validateOfflineMaintenanceOperation({
    clientOperationId: UUIDS.operation,
    campgroundId: UUIDS.campground,
    operationKind: "inspection_result",
    targetId: UUIDS.target,
    templateItemId: UUIDS.item,
    expectedOccurrenceRowVersion: 3,
    expectedResultRowVersion: 2,
    resultValue: "fail",
    note: "Guard is loose.",
  });
  assert.equal(operation.expectedOccurrenceRowVersion, 3);
  assert.equal(operation.expectedResultRowVersion, 2);
});

test("Build 076 schema provides append-only idempotent receipts and narrow media authority", () => {
  const migration = fs.readFileSync(
    new URL(
      "../database/migrations/0098_offline_maintenance_workspace.sql",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(migration, /maintenance_offline_sync_receipts/u);
  assert.match(migration, /scope_client_unique/u);
  assert.match(migration, /payload_fingerprint/u);
  assert.match(migration, /maintenance\.offline\.media/u);
  assert.match(migration, /force row level security/iu);
  assert.match(
    migration,
    /grant select,insert on public\.maintenance_offline_sync_receipts/u,
  );
  assert.doesNotMatch(
    migration,
    /grant[^;]*(update|delete)[^;]*maintenance_offline_sync_receipts/iu,
  );
});

test("Build 076 sync reuses canonical maintenance, inspection and media evidence", () => {
  const service = fs.readFileSync(
    new URL("../lib/offline-maintenance/postgres.mjs", import.meta.url),
    "utf8",
  );

  assert.match(service, /public\.maintenance_work_orders/u);
  assert.match(service, /public\.maintenance_work_order_notes/u);
  assert.match(service, /public\.inspection_occurrences/u);
  assert.match(service, /public\.inspection_results/u);
  assert.match(service, /public\.maintenance_work_order_media/u);
  assert.match(service, /icamp_private\.media_assets/u);
  assert.match(service, /assigned_to_user_id/u);
  assert.match(service, /row_version/u);
  assert.match(service, /already_applied/u);
  assert.match(service, /OFFLINE_CONFLICT/u);
  assert.doesNotMatch(
    service,
    /update public\.maintenance_work_orders[\s\S]{0,300}status=/iu,
  );
});

test("Build 076 PWA queues notes, checklists and media without caching authenticated pages", () => {
  const client = fs.readFileSync(
    new URL("../public/offline-maintenance.js", import.meta.url),
    "utf8",
  );
  const worker = fs.readFileSync(
    new URL("../public/sw.js", import.meta.url),
    "utf8",
  );
  const page = fs.readFileSync(
    new URL("../app/workspaces/maintenance/offline/page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(client, /indexedDB\.open/u);
  assert.match(client, /work_order_note/u);
  assert.match(client, /inspection_result/u);
  assert.match(client, /work_order_media/u);
  assert.match(client, /data-clear/u);
  assert.match(worker, /offline-maintenance\.html/u);
  assert.match(worker, /workspaces\/maintenance\/offline/u);
  assert.doesNotMatch(worker, /cache\.put\(event\.request/u);
  assert.match(page, /Final decisions stay online/u);
  assert.match(page, /Build 076/u);
});

test("Build 076 remains closed as Build 077 advances the queue and preserves the theme prerequisite", () => {
  const queue = fs.readFileSync(
    new URL("../docs/BUILD_QUEUE.md", import.meta.url),
    "utf8",
  );
  const roadmap = fs.readFileSync(
    new URL("../docs/BUILD_ROADMAP.md", import.meta.url),
    "utf8",
  );

  assert.match(queue, /Build 076 — Offline Maintenance Workspace/u);
  assert.match(queue, /FULLY PROMOTED/u);
  assert.match(queue, /Build 077 — Camper Assistance Request Interface/u);
  assert.match(queue, /Builds 079–081 \(4 builds\)/u);
  assert.match(roadmap, /standard theme ruleset and token contract/u);
  assert.match(roadmap, /No future visual\/style build should bypass/u);
});
