import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  normalizeRecurrenceReview,
  normalizeRecurrenceDecision,
} from "../lib/permanent-unit-owner-retention/recurrence-core.mjs";
const a = "11111111-1111-4111-8111-111111111111",
  b = "22222222-2222-4222-8222-222222222222";
const base = {
  id: a,
  sourceCampgroundId: a,
  targetCampgroundId: b,
  evidenceReference: "internal-audit-ref-001",
};
test("owner review validates pair and privacy", () => {
  assert.equal(
    normalizeRecurrenceReview({
      ...base,
      acceptanceId: b,
      reviewNote: "Manual owner recurrence investigation.",
    }).acceptanceId,
    b,
  );
  assert.throws(
    () =>
      normalizeRecurrenceReview({
        ...base,
        acceptanceId: b,
        targetCampgroundId: a,
        reviewNote: "Manual owner recurrence investigation.",
      }),
    /different/,
  );
  assert.throws(
    () =>
      normalizeRecurrenceReview({
        ...base,
        acceptanceId: b,
        reviewNote: "Call abc@example.com",
      }),
    /identifiers/,
  );
});
test("independent decision validates no-action and due date", () => {
  const input = {
    ...base,
    recurrenceReviewId: b,
    decisionKind: "continue_monitoring",
    nextDueAt: "2026-11-15",
    decisionNote: "Monitor open source evidence independently.",
  };
  assert.equal(
    normalizeRecurrenceDecision(input, new Date("2026-10-26")).decisionKind,
    "continue_monitoring",
  );
  assert.throws(
    () =>
      normalizeRecurrenceDecision(
        { ...input, decisionKind: "independent_no_action" },
        new Date("2026-10-26"),
      ),
    /No-action/,
  );
  assert.throws(
    () =>
      normalizeRecurrenceDecision(
        { ...input, nextDueAt: "2027-05-01" },
        new Date("2026-10-26"),
      ),
    /90 days/,
  );
});
test("SQL retains independent, immutable, pair-scoped follow-up", () => {
  const sql = readFileSync(
    new URL(
      "../database/migrations/0145_hold_recurrence_owner_review_decisions.sql",
      import.meta.url,
    ),
    "utf8",
  );
  for (const token of [
    "force row level security",
    "owner_hold_recurrence_review_immutable",
    "owner_hold_recurrence_decision_immutable",
    "observed_plan_count",
    "observed_continued_holds",
    "observed_overdue_plans",
    "reviewed_by_user_id",
    "decided_by_user_id",
    "latest_review",
    "109109",
  ])
    assert.ok(sql.includes(token), `missing ${token}`);
});
