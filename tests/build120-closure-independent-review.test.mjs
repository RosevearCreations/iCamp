import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  normalizeIndependentClosureFollowupReview,
  classifyIndependentClosureFollowup,
} from "../lib/permanent-unit-owner-retention/recurrence-core.mjs";

const now = new Date("2026-10-26T12:00:00.000Z");
const pair = {
  sourceCampgroundId: "a1111111-1111-4111-8111-111111111111",
  targetCampgroundId: "b2222222-2222-4222-8222-222222222222",
};
const input = {
  id: "f5555555-5555-4555-8555-555555555555",
  ownerDecisionId: "d4444444-4444-4444-8444-444444444444",
  ...pair,
  reviewKind: "request_new_evidence",
  nextDueAt: "2026-11-01",
  evidenceReference: "Independent audit evidence 120",
  reviewNote:
    "Require refreshed evidence before any next independent audit review.",
};

test("Build 120 independent follow-up validates pair, review type, UTC deadlines", () => {
  assert.equal(
    normalizeIndependentClosureFollowupReview(input, now).nextDueAt,
    "2026-11-01T23:59:00.000Z",
  );
  assert.throws(
    () =>
      normalizeIndependentClosureFollowupReview(
        { ...input, reviewKind: "auto_release" },
        now,
      ),
    /Unknown independent/,
  );
  assert.throws(
    () =>
      normalizeIndependentClosureFollowupReview(
        { ...input, nextDueAt: "2026-10-20" },
        now,
      ),
    /within 90 days/,
  );
  assert.throws(
    () =>
      normalizeIndependentClosureFollowupReview(
        { ...input, nextDueAt: "2027-06-01" },
        now,
      ),
    /within 90 days/,
  );
  assert.throws(
    () =>
      normalizeIndependentClosureFollowupReview(
        { ...input, nextDueAt: "2026-11-31" },
        now,
      ),
    /within 90 days/,
  );
  assert.throws(
    () =>
      normalizeIndependentClosureFollowupReview(
        { ...input, reviewKind: "confirm_audit_acknowledged" },
        now,
      ),
    /no follow-up date/,
  );
  assert.equal(
    normalizeIndependentClosureFollowupReview(
      { ...input, reviewKind: "confirm_audit_acknowledged", nextDueAt: "" },
      now,
    ).nextDueAt,
    null,
  );
  assert.throws(
    () =>
      normalizeIndependentClosureFollowupReview(
        { ...input, targetCampgroundId: pair.sourceCampgroundId },
        now,
      ),
    /different campgrounds/,
  );
});

test("Build 120 surfaces overdue escalation and post-review outcomes", () => {
  assert.equal(
    classifyIndependentClosureFollowup(
      { decision_kind: "keep_exception_open", next_due_at: "2026-09-01" },
      null,
      now,
    ),
    "overdue_30_plus_escalate",
  );
  assert.equal(
    classifyIndependentClosureFollowup(
      { decision_kind: "request_evidence", next_due_at: "2026-10-25" },
      null,
      now,
    ),
    "overdue_independent_review",
  );
  assert.equal(
    classifyIndependentClosureFollowup(
      { decision_kind: "keep_exception_open", next_due_at: "2026-11-01" },
      null,
      now,
    ),
    "independent_review_pending",
  );
  assert.equal(
    classifyIndependentClosureFollowup(
      { decision_kind: "acknowledge_audit_closure" },
      null,
      now,
    ),
    "awaiting_independent_confirmation",
  );
  assert.equal(
    classifyIndependentClosureFollowup(
      {},
      { review_kind: "manual_escalation" },
      now,
    ),
    "independently_escalated",
  );
  assert.equal(
    classifyIndependentClosureFollowup(
      {},
      { review_kind: "confirm_audit_acknowledged" },
      now,
    ),
    "audit_independently_confirmed",
  );
});

test("Build 120 database hardens independent review, snapshots, escalation and RLS", () => {
  const sql = readFileSync(
    new URL(
      "../database/migrations/0150_closure_decision_recurrence_independent_review.sql",
      import.meta.url,
    ),
    "utf8",
  );
  for (const guard of [
    "owner_decision_id uuid not null unique",
    "force row level security",
    "winterization_append_only",
    "pg_advisory_xact_lock",
    "reviewed_by_user_id=decision_record.decided_by_user_id",
    "reviewed_by_user_id=recheck_record.rechecked_by_user_id",
    "observed_recurring_decisions",
    "observed_overdue_decisions",
    "observed_escalation_decisions",
    "observed_owner_days_overdue>=30",
    "interval '90 days'",
    "confirm_audit_acknowledged",
  ])
    assert.ok(sql.includes(guard), `Missing SQL invariant: ${guard}`);
  assert.ok(!/update public\.owner_export_closure_owner_decisions/i.test(sql));
});

test("Build 120 management UI exposes independent review and avoids public side effects", () => {
  const page = readFileSync(
    new URL(
      "../app/workspaces/management/campgrounds/permanent-units/financing/owner-portfolio/planning/outcomes/review/evidence/retention/exceptions/oversight/reviews/aging/outcomes/reopen/plans/oversight/decisions/page.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(page, /recordIndependentClosureFollowupAction/);
  assert.match(page, /overdue escalation/);
  assert.match(page, /observed_recurring_decisions/);
  assert.match(page, /observed_owner_days_overdue/);
});
