import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  normalizeAgingFilter,
  classifyOwnerDecisionAging,
  normalizeOwnerDecisionReassessment,
} from "../lib/permanent-unit-owner-retention/aging-core.mjs";

const source = "110b0000-0000-4000-8000-000000000001";
const target = "110b0000-0000-4000-8000-000000000002";
const decisionId = "110b0000-0000-4000-8000-000000000003";
const caseId = "110b0000-0000-4000-8000-000000000004";
const now = new Date("2026-10-26T12:00:00.000Z");
const base = {
  id: "110b0000-0000-4000-8000-000000000005",
  decisionId,
  sourceCampgroundId: source,
  targetCampgroundId: target,
  assessmentKind: "continue_monitoring",
  basisCaseId: "",
  nextDueAt: "2026-11-02",
  evidenceReference: "REVIEW-REFERENCE",
  reassessmentNote: "Independent reassessment of current evidence.",
};
const read = (file) =>
  readFileSync(new URL(file, import.meta.url), "utf8").toLowerCase();

test("owner aging classification is based on latest due date without treating advice as closure", () => {
  const date = (days) =>
    new Date(now.getTime() + days * 86400000).toISOString();
  assert.equal(
    classifyOwnerDecisionAging(
      { decisionKind: "closed_no_action", effectiveDueAt: null },
      now,
    ),
    "closed_no_action",
  );
  assert.equal(
    classifyOwnerDecisionAging(
      {
        decisionKind: "monitor",
        assessmentKind: "closure_recommended",
        effectiveDueAt: null,
      },
      now,
    ),
    "closure_recommended",
  );
  for (const [days, expected] of [
    [-1, "overdue"],
    [1, "due_week"],
    [7, "due_week"],
    [12, "due_month"],
    [30, "due_month"],
    [31, "later"],
  ])
    assert.equal(
      classifyOwnerDecisionAging(
        { decisionKind: "monitor", effectiveDueAt: date(days) },
        now,
      ),
      expected,
    );
  for (const v of ["unexpected", null, 12])
    assert.equal(normalizeAgingFilter(v), "all");
  assert.equal(normalizeAgingFilter("overdue"), "overdue");
});

test("independent reassessment validation enforces permitted dispositions, due dates and reference hygiene", () => {
  assert.equal(
    normalizeOwnerDecisionReassessment(base, now).decisionId,
    decisionId,
  );
  assert.equal(
    normalizeOwnerDecisionReassessment(
      {
        ...base,
        assessmentKind: "escalation_recommended",
        basisCaseId: caseId,
      },
      now,
    ).basisCaseId,
    caseId,
  );
  assert.equal(
    normalizeOwnerDecisionReassessment(
      { ...base, assessmentKind: "closure_recommended", nextDueAt: "" },
      now,
    ).nextDueAt,
    null,
  );
  for (const bad of [
    { assessmentKind: "accepted_closure" },
    { assessmentKind: "escalation_recommended" },
    { assessmentKind: "closure_recommended" },
    { nextDueAt: "2027-03-01" },
    { nextDueAt: "2026-10-20" },
    { sourceCampgroundId: target },
    { decisionId: "forged" },
    { evidenceReference: "someone@example.net" },
    { reassessmentNote: "bank account 123456789" },
  ])
    assert.throws(() =>
      normalizeOwnerDecisionReassessment({ ...base, ...bad }, now),
    );
});

test("Build 110 migration is strictly private, immutable, independent and serial with Build 109", () => {
  const migration = read(
    "../database/migrations/0141_owner_export_followup_aging_reassessment.sql",
  );
  const verify = read(
    "../database/verify/0141_owner_export_followup_aging_reassessment.sql",
  );
  for (const required of [
    "force row level security",
    "grant select,insert",
    "is_campground_finance_owner(source_campground_id)",
    "is_campground_finance_owner(target_campground_id)",
    "winterization_append_only()",
    "pg_advisory_xact_lock",
    "109109",
    "decided_by_user_id",
    "latest_id<>decision_row.id",
    "closure_recommended",
    "new.observed_unclosed_cases",
    "new.new_cases_since_review",
    "review_kind='accepted'",
    "basis_case_id",
    "within 90 days",
  ])
    assert.ok(
      migration.includes(required),
      `Missing database invariant: ${required}`,
    );
  assert.ok(!migration.includes("security definer"));
  assert.ok(!migration.includes("grant select,insert,update"));
  assert.match(verify, /relforcerowsecurity/);
  assert.match(verify, /has_table_privilege/);
});

test("private server and owner workbench report complete aging while limiting individual audit records", () => {
  const server = read(
    "../lib/permanent-unit-owner-retention/aging-postgres.mjs",
  );
  const page = read(
    "../app/workspaces/management/campgrounds/permanent-units/financing/owner-portfolio/planning/outcomes/review/evidence/retention/exceptions/oversight/reviews/aging/page.tsx",
  );
  const earlier = read(
    "../app/workspaces/management/campgrounds/permanent-units/financing/owner-portfolio/planning/outcomes/review/evidence/retention/exceptions/oversight/reviews/page.tsx",
  );
  for (const required of [
    "getcampgroundauthorization",
    "set local role icamp_app",
    'includes("owner_admin")',
    'includes("permanent_unit.transfer")',
    "set_config('icamp.user_id'",
    "begin read only",
    "distinct on (d.review_id)",
    "latest_with_reassessment",
    "coalesce(a.next_due_at,d.original_due_at)",
    "count(*) filter(where stage='overdue')",
    "limit 101",
    "limit 151",
    "itemslimited",
    "historylimited",
    "caseslimited",
    "insert into public.owner_export_oversight_reassessments",
    "d.review_id",
    "d.source_campground_id=$3",
  ])
    assert.ok(
      server.includes(required),
      `Missing server assurance: ${required}`,
    );
  assert.match(page, /helptopic="permanent.owner-followup-aging"/);
  assert.match(page, /report\.itemslimited/);
  assert.match(page, /reassessownerdecisionaction/);
  assert.match(earlier, /owner-oversight-aging/);
  assert.match(
    read("../lib/help/topics.ts"),
    /"permanent.owner-followup-aging"/,
  );
});
