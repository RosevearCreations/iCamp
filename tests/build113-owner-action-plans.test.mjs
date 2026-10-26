import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  normalizeReopenActionPlan,
  normalizeHoldResolution,
} from "../lib/permanent-unit-owner-retention/plans-core.mjs";
const a = "11111111-1111-4111-8111-111111111111",
  b = "22222222-2222-4222-8222-222222222222";
const pair = {
  id: a,
  sourceCampgroundId: a,
  targetCampgroundId: b,
  evidenceReference: "internal-evidence-001",
};
test("owner plans validate due date, scope and evidence", () => {
  const input = {
    ...pair,
    exceptionReviewId: b,
    actionKind: "investigate_source",
    nextDueAt: "2026-11-15",
    actionNote: "Source records need fresh independent checking.",
  };
  assert.equal(
    normalizeReopenActionPlan(input, new Date("2026-10-26T00:00:00Z"))
      .actionKind,
    "investigate_source",
  );
  assert.throws(
    () =>
      normalizeReopenActionPlan(
        { ...input, targetCampgroundId: a },
        new Date("2026-10-26"),
      ),
    /distinct/,
  );
  assert.throws(
    () =>
      normalizeReopenActionPlan(
        { ...input, nextDueAt: "2027-04-01" },
        new Date("2026-10-26"),
      ),
    /90 days/,
  );
  assert.throws(
    () =>
      normalizeReopenActionPlan(
        { ...input, actionNote: "Write to xyz@example.com" },
        new Date("2026-10-26"),
      ),
    /identifiers/,
  );
});
test("independent hold decision is strictly normalized", () => {
  assert.equal(
    normalizeHoldResolution({
      ...pair,
      actionPlanId: b,
      resolutionKind: "continue_hold",
      resolutionNote: "More independently accepted evidence is needed.",
    }).resolutionKind,
    "continue_hold",
  );
  assert.throws(
    () =>
      normalizeHoldResolution({
        ...pair,
        actionPlanId: b,
        resolutionKind: "force_close",
        resolutionNote: "This should be rejected.",
      }),
    /Unknown/,
  );
});
test("database requires independent actors and immutable evidence", () => {
  const sql = readFileSync(
    new URL(
      "../database/migrations/0144_reopen_owner_action_plans_hold_resolution.sql",
      import.meta.url,
    ),
    "utf8",
  );
  for (const required of [
    "force row level security",
    "reopen_action_plan_immutable",
    "reopen_hold_resolution_immutable",
    "planned_by_user_id",
    "reviewed_by_user_id",
    "resolved_by_user_id",
    "current_review",
    "current_plan",
    "current_decision",
    "current_reassessment",
    "current_outcome",
    "observed_unclosed_cases",
    "109109",
  ])
    assert.ok(sql.includes(required), `missing ${required}`);
});
