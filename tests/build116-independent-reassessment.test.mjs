import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  classifyRecurrenceFollowUp,
  normalizeIndependentReassessment,
} from "../lib/permanent-unit-owner-retention/recurrence-core.mjs";

const source = "a1111111-1111-4111-8111-111111111111";
const target = "b2222222-2222-4222-8222-222222222222";
const decision = "c3333333-3333-4333-8333-333333333333";
const id = "d4444444-4444-4444-8444-444444444444";
const raw = {
  id,
  recurrenceDecisionId: decision,
  sourceCampgroundId: source,
  targetCampgroundId: target,
  assessmentKind: "continue_hold",
  evidenceReference: "Audit evidence #42",
  assessmentNote: "A separate owner reviewed the open hold.",
};

test("Build 116 follow-up aging does not silently close holds", () => {
  const now = new Date("2026-10-26T12:00:00Z");
  assert.equal(
    classifyRecurrenceFollowUp(
      {
        decision_kind: "continue_monitoring",
        next_due_at: "2026-10-20T00:00:00Z",
      },
      now,
    ),
    "overdue",
  );
  assert.equal(
    classifyRecurrenceFollowUp(
      {
        decision_kind: "continue_monitoring",
        next_due_at: "2026-09-01T00:00:00Z",
      },
      now,
    ),
    "overdue_30_plus",
  );
  assert.equal(
    classifyRecurrenceFollowUp(
      {
        decision_kind: "continue_monitoring",
        next_due_at: "2026-11-20T00:00:00Z",
      },
      now,
    ),
    "pending",
  );
  assert.equal(
    classifyRecurrenceFollowUp(
      { decision_kind: "continue_monitoring", reassessment_id: id },
      now,
    ),
    "reassessed",
  );
  assert.equal(
    classifyRecurrenceFollowUp({ decision_kind: "independent_no_action" }, now),
    "closed",
  );
});
test("Build 116 validates scoped independent evidence", () => {
  assert.deepEqual(normalizeIndependentReassessment(raw), raw);
  assert.throws(
    () =>
      normalizeIndependentReassessment({
        ...raw,
        assessmentKind: "auto_release",
      }),
    /Unknown/,
  );
  assert.throws(
    () =>
      normalizeIndependentReassessment({ ...raw, targetCampgroundId: source }),
    /different/,
  );
  assert.throws(
    () =>
      normalizeIndependentReassessment({
        ...raw,
        assessmentNote: "person@example.com",
      }),
    /identifiers/,
  );
});
test("Build 116 database enforces independent immutable, private follow-up", () => {
  const sql = readFileSync(
    new URL(
      "../database/migrations/0146_recurrence_followup_independent_reassessment.sql",
      import.meta.url,
    ),
    "utf8",
  );
  for (const invariant of [
    "force row level security",
    "assessed_by_user_id=d.decided_by_user_id",
    "assessed_by_user_id=r.reviewed_by_user_id",
    "winterization_append_only",
    "confirm_resolution",
    "pg_advisory_xact_lock",
    "unique references",
  ])
    assert.ok(sql.includes(invariant), invariant);
});
