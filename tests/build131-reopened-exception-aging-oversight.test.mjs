import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  normalizeReopenedExceptionAgingReview,
  classifyReopenedExceptionAgingStatus,
} from "../lib/permanent-unit-owner-retention/recurrence-core.mjs";

const now = new Date("2026-10-27T12:00:00.000Z");
const input = {
  id: "a1111111-1111-4111-8111-111111111111",
  reopenEventId: "b2222222-2222-4222-8222-222222222222",
  sourceCampgroundId: "c3333333-3333-4333-8333-333333333333",
  targetCampgroundId: "d4444444-4444-4444-8444-444444444444",
  reviewKind: "independent_followup_reassessment",
  outcomeKind: "evidence_gap_pending",
  nextDueAt: "2026-11-15",
  evidenceReference: "Independent source-linked review 131",
  reviewNote: "Reopened exception requires another owner evidence audit.",
};
const prior = "e5555555-5555-4555-8555-555555555555";

test("Build 131 validates independent reassessment stages and UTC aging deadlines", () => {
  assert.equal(
    normalizeReopenedExceptionAgingReview(input, now).nextDueAt,
    "2026-11-15T23:59:00.000Z",
  );
  for (const outcomeKind of ["release_hold", "continuity_recheck_verified"]) {
    assert.throws(
      () =>
        normalizeReopenedExceptionAgingReview({ ...input, outcomeKind }, now),
      /Invalid reopened exception/,
    );
  }
  for (const nextDueAt of ["2026-10-26", "2026-11-31", "2027-03-29"]) {
    assert.throws(
      () => normalizeReopenedExceptionAgingReview({ ...input, nextDueAt }, now),
      /within 90 days/,
    );
  }
  assert.throws(
    () =>
      normalizeReopenedExceptionAgingReview(
        { ...input, priorReviewId: prior },
        now,
      ),
    /Initial reassessment cannot cite/,
  );
  assert.throws(
    () =>
      normalizeReopenedExceptionAgingReview(
        {
          ...input,
          sourceCampgroundId: input.targetCampgroundId,
        },
        now,
      ),
    /different campgrounds/,
  );
});

test("Build 131 requires independent proof for verified reassessment and continuity", () => {
  assert.throws(
    () =>
      normalizeReopenedExceptionAgingReview(
        {
          ...input,
          outcomeKind: "followup_evidence_reassessed",
        },
        now,
      ),
    /Verified outcomes require/,
  );
  assert.throws(
    () =>
      normalizeReopenedExceptionAgingReview(
        {
          ...input,
          verifiedFollowupEventId: prior,
        },
        now,
      ),
    /open findings cannot cite/,
  );
  const oversight = {
    ...input,
    reviewKind: "continuity_recurrence_oversight",
    outcomeKind: "continuity_recheck_verified",
    priorReviewId: prior,
    verifiedFollowupEventId: prior,
    nextDueAt: "",
  };
  assert.equal(
    normalizeReopenedExceptionAgingReview(oversight, now).nextDueAt,
    null,
  );
  assert.throws(
    () =>
      normalizeReopenedExceptionAgingReview(
        { ...oversight, priorReviewId: "" },
        now,
      ),
    /needs an independent prior review/,
  );
  assert.throws(
    () =>
      normalizeReopenedExceptionAgingReview(
        {
          ...oversight,
          nextDueAt: "2026-11-15",
        },
        now,
      ),
    /cannot retain an open due date/,
  );
});

test("Build 131 distinguishes overdue recurrence from completed independent recheck", () => {
  assert.equal(
    classifyReopenedExceptionAgingStatus(
      {
        review_kind: "independent_followup_reassessment",
        next_due_at: "2026-09-01",
      },
      null,
      now,
    ),
    "reopened_exception_overdue_30_plus",
  );
  assert.equal(
    classifyReopenedExceptionAgingStatus(
      {
        review_kind: "continuity_recurrence_oversight",
        next_due_at: "2026-10-26",
      },
      null,
      now,
    ),
    "reopened_exception_overdue",
  );
  assert.equal(
    classifyReopenedExceptionAgingStatus(
      {
        review_kind: "continuity_recurrence_oversight",
        next_due_at: "2026-11-15",
      },
      null,
      now,
    ),
    "continuity_recurrence_watch_pending",
  );
  assert.equal(
    classifyReopenedExceptionAgingStatus(
      { outcome_kind: "continuity_recheck_verified" },
      null,
      now,
    ),
    "independent_continuity_recheck_verified",
  );
  assert.equal(
    classifyReopenedExceptionAgingStatus({}, { id: prior }, now),
    "subsequent_continuity_review_recorded",
  );
});

test("Build 131 SQL enforces independent source-linked evidence and immutable RLS", () => {
  const sql = readFileSync(
    new URL(
      "../database/migrations/0161_reopened_exception_aging_continuity_oversight.sql",
      import.meta.url,
    ),
    "utf8",
  ).toLowerCase();
  for (const invariant of [
    "reopen_event_id uuid not null references",
    "prior_review_id uuid unique references",
    "verified_followup_event_id uuid references",
    "reopened_aging_first_reassessment_idx",
    "pg_advisory_xact_lock",
    "reopen_record.event_kind<>'owner_exception_reopen'",
    "verified_record.root_reopen_id=new.reopen_event_id",
    "verified_record.recorded_at>reopen_record.recorded_at",
    "new.observed_reopen_days_aging",
    "new.observed_prior_days_overdue>=30",
    "new.observed_open_peer_recurrences>0",
    "continuity_recheck_verified",
    "reviewer must be independent",
    "force row level security",
    "winterization_append_only",
    "interval '90 days'",
  ]) {
    assert.ok(
      sql.includes(invariant),
      `Missing Build 131 DB guard: ${invariant}`,
    );
  }
  assert.ok(!/update public\.owner_export_/i.test(sql));
});

test("Build 131 operator workflow includes independent reassessment and continuity queue", () => {
  const page = readFileSync(
    new URL(
      "../app/workspaces/management/campgrounds/permanent-units/financing/owner-portfolio/planning/outcomes/review/evidence/retention/exceptions/oversight/reviews/aging/outcomes/reopen/plans/oversight/decisions/page.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  for (const invariant of [
    "recordReopenedExceptionAgingReviewAction",
    "independent_followup_reassessment",
    "continuity_recurrence_oversight",
    "verifiedFollowupEventId",
    "observed_reopen_days_aging",
    "aging_status",
  ])
    assert.ok(
      page.includes(invariant),
      `Missing Build 131 operator UI: ${invariant}`,
    );
});
