import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  normalizeIndependentProofContinuityReview,
  classifyOwnerProofContinuityAging,
} from "../lib/permanent-unit-owner-retention/recurrence-core.mjs";

const now = new Date("2026-10-26T12:00:00.000Z");
const input = {
  id: "d5555555-5555-4555-8555-555555555555",
  ownerDecisionId: "e6666666-6666-4666-8666-666666666666",
  replayOwnerDecisionId: "f7777777-7777-4777-8777-777777777777",
  sourceCampgroundId: "a1111111-1111-4111-8111-111111111111",
  targetCampgroundId: "b2222222-2222-4222-8222-222222222222",
  reviewKind: "renew_independent_escalation",
  nextDueAt: "2026-11-13",
  evidenceReference: "Independent proof replay reference 129",
  reviewNote:
    "Renew escalation after comparing the owner disposition with the latest evidence.",
};

test("Build 129 validates independent owner replay and bounded UTC follow-up", () => {
  assert.equal(
    normalizeIndependentProofContinuityReview(input, now).nextDueAt,
    "2026-11-13T23:59:00.000Z",
  );
  for (const reviewKind of ["release_hold", "pay_owner", ""]) {
    assert.throws(
      () =>
        normalizeIndependentProofContinuityReview(
          { ...input, reviewKind },
          now,
        ),
      /Unknown independent closure proof review/,
    );
  }
  for (const nextDueAt of ["2026-10-25", "2026-11-31", "2027-07-01"]) {
    assert.throws(
      () =>
        normalizeIndependentProofContinuityReview({ ...input, nextDueAt }, now),
      /within 90 days/,
    );
  }
  assert.throws(
    () =>
      normalizeIndependentProofContinuityReview(
        { ...input, reviewKind: "confirm_proof_continuity" },
        now,
      ),
    /cannot set a follow-up/,
  );
  assert.equal(
    normalizeIndependentProofContinuityReview(
      { ...input, reviewKind: "confirm_proof_continuity", nextDueAt: "" },
      now,
    ).nextDueAt,
    null,
  );
  assert.throws(
    () =>
      normalizeIndependentProofContinuityReview(
        { ...input, replayOwnerDecisionId: "missing" },
        now,
      ),
    /valid identifier/,
  );
  assert.throws(
    () =>
      normalizeIndependentProofContinuityReview(
        { ...input, targetCampgroundId: input.sourceCampgroundId },
        now,
      ),
    /different campgrounds/,
  );
});

test("Build 129 classifies proof follow-up aging independently of owner acknowledgment", () => {
  assert.equal(
    classifyOwnerProofContinuityAging(
      { decision_kind: "acknowledge_closure_proof" },
      null,
      now,
    ),
    "independent_continuity_confirmation_pending",
  );
  assert.equal(
    classifyOwnerProofContinuityAging(
      {
        decision_kind: "renew_escalation_exception",
        next_due_at: "2026-09-01",
      },
      null,
      now,
    ),
    "owner_proof_exception_overdue_30_plus",
  );
  assert.equal(
    classifyOwnerProofContinuityAging(
      {
        decision_kind: "submit_replay_gap_evidence",
        next_due_at: "2026-10-25",
      },
      null,
      now,
    ),
    "owner_proof_exception_overdue",
  );
  assert.equal(
    classifyOwnerProofContinuityAging(
      {
        decision_kind: "renew_escalation_exception",
        next_due_at: "2026-11-13",
      },
      null,
      now,
    ),
    "independent_escalation_renewal_pending",
  );
  assert.equal(
    classifyOwnerProofContinuityAging(
      {},
      { review_kind: "confirm_proof_continuity" },
      now,
    ),
    "independent_continuity_confirmed",
  );
});

test("Build 129 database maintains separate-reviewer, append-only, closed-proof gates", () => {
  const sql = readFileSync(
    new URL(
      "../database/migrations/0159_owner_closure_proof_independent_continuity.sql",
      import.meta.url,
    ),
    "utf8",
  );
  for (const invariant of [
    "owner_decision_id uuid not null unique",
    "replay_owner_decision_id uuid not null references",
    "force row level security",
    "winterization_append_only",
    "pg_advisory_xact_lock",
    "new.reviewed_by_user_id=owner_record.recorded_by_user_id",
    "new.reviewed_by_user_id=recheck_record.reviewed_by_user_id",
    "new.reviewed_by_user_id=replay_record.recorded_by_user_id",
    "new.observed_replay_is_newer",
    "new.observed_prior_chain_complete",
    "new.observed_peer_open_owner_decisions>0",
    "new.observed_recent_escalation_renewals>0",
    "new.observed_open_independent_rechecks>0",
    "new.observed_owner_days_overdue>=30",
    "confirm_proof_continuity",
    "interval '90 days'",
  ])
    assert.ok(
      sql.includes(invariant),
      `Missing Build 129 invariant: ${invariant}`,
    );
  assert.ok(
    !/update public\.owner_export_independent_recheck_owner_decisions/i.test(
      sql,
    ),
  );
});

test("Build 129 owner console exposes real independent-review action and evidence queue", () => {
  const page = readFileSync(
    new URL(
      "../app/workspaces/management/campgrounds/permanent-units/financing/owner-portfolio/planning/outcomes/review/evidence/retention/exceptions/oversight/reviews/aging/outcomes/reopen/plans/oversight/decisions/page.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  for (const invariant of [
    "recordIndependentProofContinuityReviewAction",
    "proof_continuity_status",
    "replayOwnerDecisionId",
    "observed_peer_overdue_owner_decisions",
    "observed_prior_chain_complete",
  ])
    assert.ok(page.includes(invariant), `Missing Build 129 UI: ${invariant}`);
});
