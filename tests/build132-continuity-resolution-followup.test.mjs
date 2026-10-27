import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  normalizeContinuityResolutionFollowup,
  classifyContinuityResolutionStatus,
} from "../lib/permanent-unit-owner-retention/recurrence-core.mjs";

const now = new Date("2026-10-27T12:00:00.000Z");
const input = {
  id: "a1111111-1111-4111-8111-111111111111",
  agingReviewId: "b2222222-2222-4222-8222-222222222222",
  sourceCampgroundId: "c3333333-3333-4333-8333-333333333333",
  targetCampgroundId: "d4444444-4444-4444-8444-444444444444",
  followupKind: "independent_continuity_recheck",
  outcomeKind: "continuity_watch_renewed",
  nextDueAt: "2026-11-15",
  evidenceReference: "Build 132 independent recurrence evidence",
  followupNote:
    "Independent reviewer confirms a continuing source evidence watch.",
};
const prior = "e5555555-5555-4555-8555-555555555555";

test("Build 132 requires staged independent rechecks and bounded due dates", () => {
  assert.equal(
    normalizeContinuityResolutionFollowup(input, now).nextDueAt,
    "2026-11-15T23:59:00.000Z",
  );
  assert.throws(
    () =>
      normalizeContinuityResolutionFollowup(
        {
          ...input,
          followupKind: "overdue_exception_resolution",
          outcomeKind: "resolution_evidence_pending",
        },
        now,
      ),
    /previous independent recheck/,
  );
  assert.throws(
    () =>
      normalizeContinuityResolutionFollowup(
        { ...input, outcomeKind: "release_hold" },
        now,
      ),
    /Invalid continuity/,
  );
  for (const nextDueAt of ["2026-10-26", "2026-11-31", "2027-03-01"]) {
    assert.throws(
      () => normalizeContinuityResolutionFollowup({ ...input, nextDueAt }, now),
      /within 90 days/,
    );
  }
  assert.throws(
    () =>
      normalizeContinuityResolutionFollowup(
        { ...input, targetCampgroundId: input.sourceCampgroundId },
        now,
      ),
    /different campgrounds/,
  );
});

test("Build 132 verifies receipt linkage for each completed stage and no due date for closure", () => {
  const completed = {
    ...input,
    priorFollowupId: prior,
    followupKind: "verified_closure_followup",
    outcomeKind: "closure_followup_verified",
    verifiedFollowupEventId: prior,
    nextDueAt: "",
  };
  assert.equal(
    normalizeContinuityResolutionFollowup(completed, now).nextDueAt,
    null,
  );
  assert.throws(
    () =>
      normalizeContinuityResolutionFollowup(
        { ...completed, verifiedFollowupEventId: "" },
        now,
      ),
    /source-linked receipt/,
  );
  assert.throws(
    () =>
      normalizeContinuityResolutionFollowup(
        { ...completed, nextDueAt: "2026-11-15" },
        now,
      ),
    /open due date/,
  );
  assert.throws(
    () =>
      normalizeContinuityResolutionFollowup(
        { ...input, verifiedFollowupEventId: prior },
        now,
      ),
    /open results cannot cite/,
  );
});

test("Build 132 shows overdue status and completed independent closure", () => {
  assert.equal(
    classifyContinuityResolutionStatus(
      {
        followup_kind: "overdue_exception_resolution",
        next_due_at: "2026-09-01",
      },
      null,
      now,
    ),
    "resolution_overdue_30_plus",
  );
  assert.equal(
    classifyContinuityResolutionStatus(
      {
        followup_kind: "independent_continuity_recheck",
        next_due_at: "2026-10-26",
      },
      null,
      now,
    ),
    "resolution_overdue",
  );
  assert.equal(
    classifyContinuityResolutionStatus(
      { followup_kind: "verified_closure_followup", next_due_at: "2026-11-15" },
      null,
      now,
    ),
    "verified_closure_followup_pending",
  );
  assert.equal(
    classifyContinuityResolutionStatus(
      { outcome_kind: "closure_followup_verified" },
      null,
      now,
    ),
    "independent_closure_followup_verified",
  );
  assert.equal(
    classifyContinuityResolutionStatus({}, { id: prior }, now),
    "subsequent_independent_followup_recorded",
  );
});

test("Build 132 database enforces ordered source-linked, independent, immutable closure proofs", () => {
  const sql = readFileSync(
    new URL(
      "../database/migrations/0162_independent_continuity_resolution_followup.sql",
      import.meta.url,
    ),
    "utf8",
  ).toLowerCase();
  for (const guard of [
    "aging_review_id uuid not null references",
    "prior_followup_id uuid unique references",
    "verified_followup_event_id uuid references",
    "continuity_resolution_initial_recheck_idx",
    "pg_advisory_xact_lock",
    "root_reopen_id=aging.reopen_event_id",
    "owner_record.recorded_at<=reopened.recorded_at",
    "must follow the latest build 131",
    "recheck, overdue resolution and verified closure follow-up must be in order",
    "follow-up reviewer must differ",
    "new.observed_prior_days_overdue>=30",
    "verified closure cannot proceed with unresolved recurrence",
    "force row level security",
    "winterization_append_only",
    "interval '90 days'",
  ])
    assert.ok(sql.includes(guard), `Missing Build 132 guard: ${guard}`);
  assert.ok(!/update public\.owner_export_/i.test(sql));
});

test("Build 132 operator queue provides staged review and immutable history", () => {
  const page = readFileSync(
    new URL(
      "../app/workspaces/management/campgrounds/permanent-units/financing/owner-portfolio/planning/outcomes/review/evidence/retention/exceptions/oversight/reviews/aging/outcomes/reopen/plans/oversight/decisions/page.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  for (const item of [
    "recordContinuityResolutionFollowupAction",
    "independent_continuity_recheck",
    "overdue_exception_resolution",
    "verified_closure_followup",
    "verifiedFollowupEventId",
    "resolution_status",
  ]) {
    assert.ok(
      page.includes(item),
      `Missing Build 132 owner operator flow: ${item}`,
    );
  }
});
