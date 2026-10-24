import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  ENFORCEMENT_SCOPES,
  normalizeEnforcementCase,
  normalizeEnforcementDecision,
} from "../lib/safety-enforcement/core.mjs";

const caseId = "7d390069-38e0-440e-9610-76c5324ddf76";
const reservationId = "b4b86fb9-4c83-4a7e-a318-1f1db4ff0f6f";
const facilityId = "1da3fd8d-a786-4122-aeb2-5fce17d89167";
const reason =
  "Observed repeated use of the closed pool area after posted hours.";
const base = {
  caseId,
  reservationId,
  kind: "suspension",
  scopeType: "campground",
  reason,
};
const migration = fs.readFileSync(
  new URL(
    "../database/migrations/0113_warning_suspension_reinstatement.sql",
    import.meta.url,
  ),
  "utf8",
);

test("case input is reservation-linked, scoped and documented", () => {
  assert.deepEqual(ENFORCEMENT_SCOPES, [
    "campground",
    "facility",
    "access_zone",
    "feature",
  ]);
  assert.deepEqual(normalizeEnforcementCase(base), {
    caseId,
    reservationId,
    ruleVersionId: null,
    kind: "suspension",
    scopeType: "campground",
    facilityId: null,
    accessZoneId: null,
    feature: null,
    reason,
  });
  assert.equal(
    normalizeEnforcementCase({ ...base, scopeType: "facility", facilityId })
      .facilityId,
    facilityId,
  );
  for (const bad of [
    { caseId: "retry" },
    { reservationId: "not-uuid" },
    { kind: "automatic_ban" },
    { scopeType: "unknown" },
    { scopeType: "facility" },
    { scopeType: "campground", facilityId },
    { scopeType: "feature", feature: "unavailable" },
    { reason: "Unclear" },
  ]) {
    assert.throws(() => normalizeEnforcementCase({ ...base, ...bad }));
  }
});

test("management decisions require a case revision and a detailed note", () => {
  assert.deepEqual(
    normalizeEnforcementDecision({
      caseId,
      decision: "reinstate",
      expectedVersion: 2,
      note: "The manager confirmed the restriction can now be lifted.",
    }),
    {
      caseId,
      decision: "reinstate",
      expectedVersion: 2,
      note: "The manager confirmed the restriction can now be lifted.",
    },
  );
  assert.throws(() =>
    normalizeEnforcementDecision({
      caseId,
      decision: "approve",
      expectedVersion: 0,
      note: reason,
    }),
  );
  assert.throws(() =>
    normalizeEnforcementDecision({
      caseId,
      decision: "close",
      expectedVersion: 1,
      note: reason,
    }),
  );
  assert.throws(() =>
    normalizeEnforcementDecision({
      caseId,
      decision: "deny",
      expectedVersion: 1,
      note: "No",
    }),
  );
});

test("SQL enforces independent management review, append-only audit and guest isolation", () => {
  assert.equal((migration.match(/force row level security/g) ?? []).length, 2);
  assert.match(migration, /old\.created_by_user_id=actor/);
  assert.match(
    migration,
    /r\.role_code in \('campground_manager','owner_admin'\)/,
  );
  assert.match(migration, /case_state='pending_review'/);
  assert.match(migration, /case_state='active'/);
  assert.match(migration, /'reinstated'/);
  assert.match(migration, /unique\(case_id,case_version\)/);
  assert.match(migration, /safety_enforcement_events_immutable/);
  assert.match(migration, /has_campground_permission/);
  assert.match(migration, /guest_user_id=nullif/);
  assert.match(migration, /from public,anon,authenticated/);
  assert.match(
    migration,
    /grant select on public\.safety_enforcement_events to icamp_app/,
  );
  assert.doesNotMatch(
    migration,
    /grant (?:select,)?insert on public\.safety_enforcement_events to icamp_app/,
  );
  assert.match(migration, /old\.case_state='active'/);
});
