import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  evaluateCredentialAdmission,
  normalizeReconciliationReview,
  reconciliationId,
} from "../lib/access-reconciliation/core.mjs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const now = new Date("2026-11-02T12:00:00.000Z");
const valid = {
  status: "active",
  validFrom: "2026-11-01T00:00:00Z",
  validUntil: "2026-11-03T00:00:00Z",
  sourceKind: "visitor",
  sourceStatus: "active",
  sourceValidFrom: "2026-11-01T00:00:00Z",
  sourceValidUntil: "2026-11-03T00:00:00Z",
  duplicateCount: 1,
  assignmentStatus: null,
};

test("Build188 enforces credential and visitor/vehicle source status fail closed", () => {
  assert.deepEqual(evaluateCredentialAdmission(valid, now), {
    allowed: true,
    reason: "valid_in_app",
  });
  for (const [change, reason] of [
    [{ status: "revoked" }, "revoked"],
    [{ validFrom: "2026-11-03T00:00:00Z" }, "not_yet_valid"],
    [{ validUntil: "2026-11-02T12:00:00Z" }, "expired"],
    [{ sourceStatus: "revoked" }, "source_inactive"],
    [{ sourceValidUntil: "2026-11-02T12:00:00Z" }, "source_outside_window"],
    [{ duplicateCount: 2 }, "duplicate_assignment"],
    [
      { sourceKind: "vehicle_pass", sourceStatus: "pending_payment" },
      "source_inactive",
    ],
    [
      { sourceKind: "reservation", sourceStatus: "checked_out" },
      "stay_inactive",
    ],
    [{ assignmentStatus: "replaced" }, "assignment_ended"],
  ]) {
    assert.deepEqual(
      evaluateCredentialAdmission({ ...valid, ...change }, now),
      { allowed: false, reason },
    );
  }
  assert.deepEqual(
    evaluateCredentialAdmission(
      { ...valid, override: "approved", status: "revoked" },
      now,
    ),
    { allowed: false, reason: "revoked" },
  );
});

test("Build188 requires a scoped credential, current version and reasoned review", () => {
  const credentialId = "1aaa0000-0000-4000-8000-000000000188";
  assert.equal(reconciliationId(credentialId), credentialId);
  assert.throws(() => reconciliationId("other-tenant"), /UUID/);
  assert.deepEqual(
    normalizeReconciliationReview({
      disposition: "override_reviewed",
      reason: "Verified pass mismatch; await desk correction.",
      rowVersion: 3,
    }),
    {
      disposition: "override_reviewed",
      reason: "Verified pass mismatch; await desk correction.",
      rowVersion: 3,
    },
  );
  assert.throws(
    () =>
      normalizeReconciliationReview({
        disposition: "override_reviewed",
        reason: "ok",
        rowVersion: 1,
      }),
    /reason/,
  );
  assert.throws(
    () =>
      normalizeReconciliationReview({
        disposition: "physical_gate_open",
        reason: "Verified pass mismatch; await desk correction.",
        rowVersion: 1,
      }),
    /decision/,
  );
  assert.throws(
    () =>
      normalizeReconciliationReview({
        disposition: "acknowledged",
        reason: "Verified pass mismatch; await desk correction.",
        rowVersion: 0,
      }),
    /version/,
  );
});

test("Build188 source boundaries retain the canonical model and no hardware writes", () => {
  const migration = read(
    "../database/migrations/0198_build188_access_credential_reconciliation.sql",
  );
  const service = read("../lib/access-reconciliation/postgres.mjs");
  const page = read("../app/workspaces/security/credentials/page.tsx");
  assert.match(migration, /force row level security/);
  assert.match(migration, /security definer set search_path=''/);
  assert.match(migration, /has_campground_permission/);
  assert.match(migration, /immutable/);
  assert.doesNotMatch(migration, /grant execute.*(?:anon|authenticated)/i);
  assert.doesNotMatch(
    service,
    /gate_override_requests|provider_command|sendSms|dispatchEmergency/,
  );
  assert.doesNotMatch(
    service,
    /validation_fingerprint|secret_fingerprint|contact_phone|plate_number/,
  );
  assert.match(page, /Physical gate execution: HELD/);
  assert.match(page, /requireStaff/);
  assert.match(
    read("../app/workspaces/security/credentials/actions.ts"),
    /requireCampgroundPermission/,
  );
});
