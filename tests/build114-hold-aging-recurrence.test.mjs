import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyHoldFollowup,
  normalizeHoldAgingFilter,
  summarizeHoldAging,
} from "../lib/permanent-unit-owner-retention/hold-aging-core.mjs";
const now = new Date("2026-10-26T12:00:00Z");
const plan = (id, days, review = "review-1") => ({
  id,
  exception_review_id: review,
  next_due_at: new Date(now.getTime() + days * 86400000),
});
test("aging keeps overdue held cases visible", () => {
  assert.equal(
    classifyHoldFollowup(
      plan("one", -1),
      { resolution_kind: "continue_hold" },
      now,
    ),
    "overdue",
  );
  assert.equal(classifyHoldFollowup(plan("two", 2), null, now), "due_week");
  assert.equal(classifyHoldFollowup(plan("three", 20), null, now), "due_month");
  assert.equal(classifyHoldFollowup(plan("four", 40), null, now), "later");
  assert.equal(
    classifyHoldFollowup(
      plan("five", -1),
      { resolution_kind: "independently_resolved" },
      now,
    ),
    "resolved",
  );
  assert.equal(normalizeHoldAgingFilter("nonsense"), "all");
});
test("recurrence derives from preserved plans and independent resolutions", () => {
  const result = summarizeHoldAging(
    [plan("p1", -2), plan("p2", 20)],
    [{ action_plan_id: "p2", resolution_kind: "continue_hold" }],
    [{ id: "review-1", acceptance_id: "a1" }],
    now,
  );
  assert.equal(result.counts.overdue, 1);
  assert.equal(result.recurrence[0].plans, 2);
  assert.equal(result.recurrence[0].continuedHolds, 1);
});
