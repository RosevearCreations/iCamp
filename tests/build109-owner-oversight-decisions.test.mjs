import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  normalizeOversightReview,
  normalizeOversightDecision,
} from "../lib/permanent-unit-owner-retention/decisions-core.mjs";

const source = "109b0000-0000-4000-8000-000000000001";
const target = "109b0000-0000-4000-8000-000000000002";
const reviewId = "109b0000-0000-4000-8000-000000000003";
const caseId = "109b0000-0000-4000-8000-000000000004";
const now = new Date("2026-10-26T12:00:00.000Z");
const note = {
  id: reviewId,
  sourceCampgroundId: source,
  targetCampgroundId: target,
  windowDays: 90,
  issueKind: "all",
  reviewKind: "monitor",
  nextReviewAt: "2026-11-01",
  evidenceReference: "AUDIT-REFERENCE",
  reviewNote: "Observed exception case recurrence.",
};
const decision = {
  id: "109b0000-0000-4000-8000-000000000005",
  reviewId,
  sourceCampgroundId: source,
  targetCampgroundId: target,
  basisCaseId: "",
  decisionKind: "monitor",
  nextDueAt: "2026-11-01",
  evidenceReference: "AUDIT-REFERENCE",
  decisionNote: "Review current case evidence.",
};
const read = (file) =>
  readFileSync(new URL(file, import.meta.url), "utf8").toLowerCase();

test("owner review restricts pair, category, due date and identifier content", () => {
  assert.equal(normalizeOversightReview(note, now).windowDays, 90);
  for (const change of [
    { windowDays: 365 },
    { issueKind: "risk_score" },
    { reviewKind: "approved" },
    { targetCampgroundId: source },
    { nextReviewAt: "2027-04-01" },
    { nextReviewAt: "2026-10-20" },
    { evidenceReference: "a@b.com" },
    { reviewNote: "Bank account 1234567890" },
  ])
    assert.throws(() => normalizeOversightReview({ ...note, ...change }, now));
  assert.equal(
    normalizeOversightReview(
      { ...note, issueKind: "retention_overdue", windowDays: 180 },
      now,
    ).issueKind,
    "retention_overdue",
  );
});

test("terminal, pending and manually escalated decisions require different evidence", () => {
  assert.equal(
    normalizeOversightDecision(decision, now).nextDueAt,
    "2026-11-01T23:59:00.000Z",
  );
  assert.equal(
    normalizeOversightDecision(
      { ...decision, decisionKind: "closed_no_action", nextDueAt: "" },
      now,
    ).nextDueAt,
    null,
  );
  assert.equal(
    normalizeOversightDecision(
      { ...decision, decisionKind: "escalate", basisCaseId: caseId },
      now,
    ).basisCaseId,
    caseId,
  );
  for (const change of [
    { decisionKind: "escalate" },
    { decisionKind: "closed_no_action" },
    { nextDueAt: "" },
    { nextDueAt: "2027-08-01" },
    { reviewId: "external" },
    { decisionNote: "x" },
    { sourceCampgroundId: target },
  ])
    assert.throws(() =>
      normalizeOversightDecision({ ...decision, ...change }, now),
    );
});

test("private immutable database guards compute real snapshot, validate case evidence and serialize terminal review", () => {
  const migration = read(
    "../database/migrations/0140_owner_export_oversight_review_decision_ledger.sql",
  );
  const verify = read(
    "../database/verify/0140_owner_export_oversight_review_decision_ledger.sql",
  );
  for (const required of [
    "force row level security",
    "is_campground_finance_owner(source_campground_id)",
    "is_campground_finance_owner(target_campground_id)",
    "grant select,insert",
    "winterization_append_only()",
    "new.cases_observed:=counts.total",
    "new.open_cases_observed:=counts.open_count",
    "new.repeat_receipts_observed:=counts.recurring_receipts",
    "review_kind='accepted'",
    "pg_advisory_xact_lock",
    "closed_no_action",
    "parent.snapshot_as_of",
    "new.basis_case_id",
    "new.decided_at:=clock_timestamp()",
    "reviewed_by_user_id=nullif",
    "decided_by_user_id=nullif",
  ])
    assert.ok(migration.includes(required), `Missing DB guard: ${required}`);
  assert.match(verify, /relforcerowsecurity/);
  assert.match(verify, /has_table_privilege/);
  assert.ok(!migration.includes("security definer"));
  assert.ok(!migration.includes("grant select,insert,update"));
});

test("server, UI, and help preserve owner pair permissions, bounded ledgers and audit source links", () => {
  const server = read(
    "../lib/permanent-unit-owner-retention/decisions-postgres.mjs",
  );
  const page = read(
    "../app/workspaces/management/campgrounds/permanent-units/financing/owner-portfolio/planning/outcomes/review/evidence/retention/exceptions/oversight/reviews/page.tsx",
  );
  const oldPage = read(
    "../app/workspaces/management/campgrounds/permanent-units/financing/owner-portfolio/planning/outcomes/review/evidence/retention/exceptions/oversight/page.tsx",
  );
  const help = read("../lib/help/topics.ts");
  for (const required of [
    "getcampgroundauthorization",
    'includes("owner_admin")',
    'includes("permanent_unit.transfer")',
    "set local role icamp_app",
    "set_config('icamp.user_id'",
    "begin read only",
    "limit 51",
    "limit 151",
    "limit 101",
    "reviewslimited",
    "decisionslimited",
    "caseslimited",
    "insert into public.owner_export_oversight_reviews",
    "insert into public.owner_export_oversight_decisions",
  ])
    assert.ok(
      server.includes(required),
      `Missing owner scope gate: ${required}`,
    );
  assert.match(page, /helptopic="permanent.owner-review-decisions"/);
  assert.match(page, /led[ge]er\.reviewslimited/);
  assert.match(page, /legder\.decisionslimited|ledger\.decisionslimited/);
  assert.match(oldPage, /oversight-review-decisions/);
  assert.match(help, /"permanent.owner-review-decisions"/);
});
