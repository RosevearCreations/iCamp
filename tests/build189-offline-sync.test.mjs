import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { validateOfflineMaintenanceOperation } from "../lib/offline-maintenance/core.mjs";
import { offlineOperationFingerprint } from "../lib/offline-maintenance/postgres.mjs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const ids = {
  campground: "a0000000-0000-4000-8000-000000000189",
  target: "b0000000-0000-4000-8000-000000000189",
  operation: "c0000000-0000-4000-8000-000000000189",
  original: "d0000000-0000-4000-8000-000000000189",
};
const note = {
  campgroundId: ids.campground,
  targetId: ids.target,
  clientOperationId: ids.operation,
  operationKind: "work_order_note",
  expectedWorkOrderRowVersion: 3,
  note: "Road edge is eroded near lot 12.",
};

test("Build189 validates human-reviewed replay with new operation identity and reason", () => {
  const first = validateOfflineMaintenanceOperation(note);
  assert.equal(first.reviewedConflictOperationId, null);
  const replay = validateOfflineMaintenanceOperation({
    ...note,
    clientOperationId: ids.original,
    reviewedConflictOperationId: ids.operation,
    resolutionReason:
      "Checked live assignment and version; retain this field note.",
  });
  assert.equal(replay.reviewedConflictOperationId, ids.operation);
  assert.notEqual(
    offlineOperationFingerprint(note),
    offlineOperationFingerprint(replay),
  );
  assert.throws(
    () =>
      validateOfflineMaintenanceOperation({
        ...note,
        reviewedConflictOperationId: ids.operation,
        resolutionReason: "Sufficiently long review reason with identical ID.",
      }),
    /new operation ID/,
  );
  assert.throws(
    () =>
      validateOfflineMaintenanceOperation({
        ...note,
        resolutionReason: "Review without a conflict ID.",
      }),
    /conflict review ID/,
  );
  assert.throws(
    () =>
      validateOfflineMaintenanceOperation({
        ...note,
        clientOperationId: ids.original,
        reviewedConflictOperationId: ids.operation,
        resolutionReason: "okay",
      }),
    /20 and 500/,
  );
});

test("Build189 legacy receipts retain their original payload fingerprint", () => {
  const oldPayload = {
    campgroundId: ids.campground,
    expectedWorkOrderRowVersion: 3,
    note: note.note,
    operationKind: "work_order_note",
    targetId: ids.target,
  };
  const oldFingerprint = createHash("sha256")
    .update(JSON.stringify(oldPayload))
    .digest("hex");
  assert.equal(offlineOperationFingerprint(note), oldFingerprint);
});

test("Build189 keeps sync ledger immutable, scoped and non-duplicative", () => {
  const sql = read(
    "../database/migrations/0200_build189_offline_sync_conflicts.sql",
  );
  const hardening = read(
    "../database/migrations/0201_build189_conflict_rls_initplan.sql",
  );
  const service = read("../lib/offline-maintenance/postgres.mjs");
  const route = read("../app/api/maintenance/offline/audit/route.ts");
  assert.match(sql, /force row level security/i);
  assert.match(sql, /guard_offline_sync_conflict_immutability/);
  assert.match(sql, /scope_fk/);
  assert.match(sql, /reviewed_conflict_id/);
  assert.match(
    hardening,
    /alter policy maintenance_offline_sync_conflicts_read/,
  );
  assert.match(hardening, /\(select current_setting\('icamp.user_id'/);
  assert.doesNotMatch(
    sql,
    /grant[^;]*(update|delete)[^;]*maintenance_offline_sync_conflicts/i,
  );
  assert.match(service, /pg_advisory_xact_lock/);
  assert.match(
    service,
    /on conflict \(actor_user_id,campground_id,client_operation_id\) do nothing/,
  );
  assert.match(service, /reviewedConflictId/);
  assert.match(route, /getCurrentSession/);
  assert.match(route, /no-store/);
  assert.doesNotMatch(
    service,
    /update public\.maintenance_work_orders[\s\S]{0,300}status=/i,
  );
});

test("Build189 device queue protects drafts, resolves conflicts visibly and never completes offline", () => {
  const client = read("../public/offline-maintenance.js");
  const page = read("../app/workspaces/maintenance/offline/page.tsx");
  assert.match(client, /DB_VERSION = 2/);
  assert.match(client, /DRAFTS/);
  assert.match(client, /previousActorId/);
  assert.match(client, /data-filter-priority/);
  assert.match(client, /data-review-form/);
  assert.match(client, /reviewedConflictOperationId/);
  assert.match(client, /window\.confirm/);
  assert.match(client, /12\) \* 1024 \* 1024/);
  assert.match(page, /Final decisions stay online/);
  assert.match(page, /Build 189/);
});
