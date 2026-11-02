import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  utcWeekOptions,
  normalizeTrendAnnotation,
  normalizeHandoffPlan,
} from "../lib/permanent-unit-owner-planning/core.mjs";

const now = new Date("2026-10-25T12:00:00.000Z");
const source = "102b0000-0000-4000-8000-000000000001";
const target = "102b0000-0000-4000-8000-000000000002";
const annotation = "102b0000-0000-4000-8000-000000000003";

test("owner trend weeks are exactly 12 UTC Mondays including the partial current week", () => {
  const weeks = utcWeekOptions(now);
  assert.equal(weeks.length, 12);
  assert.equal(weeks[0], "2026-10-19");
  assert.equal(weeks.at(-1), "2026-08-03");
  assert.ok(!weeks.includes("2026-10-20"));
});
test("owner annotation accepts only retained metric-linked non-personal workflow context", () => {
  const valid = {
    id: annotation,
    campgroundId: source,
    weekStart: "2026-10-19",
    metric: "holds",
    disposition: "monitor_next_cycle",
    evidenceReference: "weekly-run-101",
    note: "Review manual workflow variance next week.",
    nextReviewAt: "2026-10-28",
  };
  const normalized = normalizeTrendAnnotation(valid, now);
  assert.equal(normalized.nextReviewAt, "2026-10-28T23:59:00.000Z");
  for (const values of [
    { weekStart: "2026-10-20" },
    { metric: "applicant_credit_score" },
    { disposition: "approve_loan" },
    { note: "Email applicant@example.com about documents" },
    { note: "Bank account 123456789 must be changed" },
    { nextReviewAt: "2027-03-01" },
  ])
    assert.throws(() => normalizeTrendAnnotation({ ...valid, ...values }, now));
});
test("handoffs require two distinct campgrounds, linked annotation and bounded manual-only plan", () => {
  const valid = {
    id: "102b0000-0000-4000-8000-000000000004",
    sourceCampgroundId: source,
    targetCampgroundId: target,
    sourceAnnotationId: annotation,
    planningScope: "followup_coordination",
    dueAt: "2026-10-29",
    evidenceReference: "ops-trend-october",
    ownerNote: "Discuss staffing and timing at next owner check-in.",
  };
  assert.equal(normalizeHandoffPlan(valid, now).targetCampgroundId, target);
  for (const values of [
    { targetCampgroundId: source },
    { targetCampgroundId: "not-a-uuid" },
    { sourceAnnotationId: "" },
    { planningScope: "auto_transfer" },
    { dueAt: "2025-10-25" },
    { ownerNote: "Call 5195551234 immediately" },
  ])
    assert.throws(() => normalizeHandoffPlan({ ...valid, ...values }, now));
});
test("SQL enforces owner-only dual-campground RLS, immutable planning and no customer case mutation", () => {
  const migration = readFileSync(
    new URL(
      "../database/migrations/0133_owner_finance_trend_handoff.sql",
      import.meta.url,
    ),
    "utf8",
  ).toLowerCase();
  const code = readFileSync(
    new URL(
      "../lib/permanent-unit-owner-planning/postgres.mjs",
      import.meta.url,
    ),
    "utf8",
  ).toLowerCase();
  for (const word of [
    "force row level security",
    "is_campground_finance_owner(source_campground_id)",
    "is_campground_finance_owner(target_campground_id)",
    "recorded_by_user_id=nullif",
    "planned_by_user_id=nullif",
    "winterization_append_only",
    "revoke all",
    "role_code='owner_admin'",
  ])
    assert.ok(migration.includes(word), word);
  for (const word of [
    "getcampgroundauthorization",
    "begin read only",
    "set local role icamp_app",
    "source_campground_id=any",
    "target_campground_id=any",
  ])
    assert.ok(code.includes(word), word);
  for (const forbidden of [
    "buyer_display_name",
    "credit_score",
    "insert into public.permanent_unit_financing",
    "update public.",
    "delete from public.",
  ])
    assert.equal(code.includes(forbidden), false, forbidden);
});
