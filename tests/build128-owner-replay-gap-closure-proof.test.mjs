import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  normalizeIndependentRecheckOwnerDecision,
  classifyOwnerReplayGapAging,
} from "../lib/permanent-unit-owner-retention/recurrence-core.mjs";

const now = new Date("2026-10-26T12:00:00.000Z");
const input = {
  id: "d5555555-5555-4555-8555-555555555555",
  independentRecheckId: "e6666666-6666-4666-8666-666666666666",
  sourceCampgroundId: "a1111111-1111-4111-8111-111111111111",
  targetCampgroundId: "b2222222-2222-4222-8222-222222222222",
  decisionKind: "renew_escalation_exception",
  nextDueAt: "2026-11-13",
  evidenceReference: "Owner replay-gap receipt 128",
  decisionNote:
    "Renew the independent escalation after reconciling the overdue evidence gap.",
};

test("Build 128 validates owner replay-gap decision, pair and UTC due dates", () => {
  assert.equal(
    normalizeIndependentRecheckOwnerDecision(input, now).nextDueAt,
    "2026-11-13T23:59:00.000Z",
  );
  for (const decisionKind of ["release_hold", "issue_refund", ""]) {
    assert.throws(
      () =>
        normalizeIndependentRecheckOwnerDecision(
          { ...input, decisionKind },
          now,
        ),
      /Unknown owner replay-gap exception decision/,
    );
  }
  for (const nextDueAt of ["2026-10-25", "2026-11-31", "2027-07-01"]) {
    assert.throws(
      () =>
        normalizeIndependentRecheckOwnerDecision({ ...input, nextDueAt }, now),
      /within 90 days/,
    );
  }
  assert.throws(
    () =>
      normalizeIndependentRecheckOwnerDecision(
        { ...input, decisionKind: "acknowledge_closure_proof" },
        now,
      ),
    /no follow-up date/,
  );
  assert.equal(
    normalizeIndependentRecheckOwnerDecision(
      { ...input, decisionKind: "acknowledge_closure_proof", nextDueAt: "" },
      now,
    ).nextDueAt,
    null,
  );
  assert.throws(
    () =>
      normalizeIndependentRecheckOwnerDecision(
        { ...input, targetCampgroundId: input.sourceCampgroundId },
        now,
      ),
    /different campgrounds/,
  );
});

test("Build 128 classifies owner replay evidence gap aging and closure proof", () => {
  assert.equal(
    classifyOwnerReplayGapAging(
      { recheck_kind: "confirm_closure_continuity_recheck" },
      null,
      now,
    ),
    "owner_closure_proof_acknowledgment_pending",
  );
  assert.equal(
    classifyOwnerReplayGapAging(
      { recheck_kind: "renew_escalation_recheck", next_due_at: "2026-09-01" },
      null,
      now,
    ),
    "owner_replay_gap_overdue_30_plus",
  );
  assert.equal(
    classifyOwnerReplayGapAging(
      {
        recheck_kind: "request_owner_renewal_replay",
        next_due_at: "2026-10-25",
      },
      null,
      now,
    ),
    "owner_replay_gap_overdue",
  );
  assert.equal(
    classifyOwnerReplayGapAging(
      { recheck_kind: "renew_escalation_recheck", next_due_at: "2026-11-13" },
      null,
      now,
    ),
    "owner_escalation_recheck_decision_pending",
  );
  assert.equal(
    classifyOwnerReplayGapAging(
      {},
      { decision_kind: "submit_replay_gap_evidence" },
      now,
    ),
    "replay_gap_evidence_submitted",
  );
  assert.equal(
    classifyOwnerReplayGapAging(
      {},
      { decision_kind: "renew_escalation_exception" },
      now,
    ),
    "owner_recheck_escalation_renewed",
  );
  assert.equal(
    classifyOwnerReplayGapAging(
      {},
      { decision_kind: "acknowledge_closure_proof" },
      now,
    ),
    "closure_proof_continuity_acknowledged",
  );
});

test("Build 128 database freezes independent closure proof and overdue peer snapshots", () => {
  const sql = readFileSync(
    new URL(
      "../database/migrations/0158_owner_replay_gap_exception_decisions.sql",
      import.meta.url,
    ),
    "utf8",
  );
  for (const invariant of [
    "independent_recheck_id uuid not null unique",
    "force row level security",
    "winterization_append_only",
    "pg_advisory_xact_lock",
    "new.recorded_by_user_id=recheck_record.reviewed_by_user_id",
    "new.observed_replay_is_newer:=recheck_record.observed_replay_is_newer",
    "new.observed_closure_proof_chain_complete:=",
    "recheck_record.recheck_kind='confirm_closure_continuity_recheck'",
    "disposition_record.disposition_kind='verify_closure_continuity'",
    "owner_record.outcome_kind='acknowledge_independent_closeout'",
    "closeout_record.review_kind='independent_exception_closed'",
    "signoff_record.signoff_kind='acknowledge_independent_closure'",
    "observed_recheck_days_overdue",
    "observed_peer_open_rechecks",
    "observed_peer_overdue_rechecks",
    "observed_prior_escalation_decisions",
    "observed_recent_independent_escalations",
    "new.observed_recheck_days_overdue>=30",
    "new.observed_prior_escalation_decisions>=2",
    "acknowledge_closure_proof",
    "interval '90 days'",
  ])
    assert.ok(
      sql.includes(invariant),
      `Missing Build 128 invariant: ${invariant}`,
    );
  assert.ok(
    !/update public\.owner_export_independent_disposition_rechecks/i.test(sql),
  );
});

test("Build 128 UI links gap status, owner decision and immutable proof snapshots", () => {
  const page = readFileSync(
    new URL(
      "../app/workspaces/management/campgrounds/permanent-units/financing/owner-portfolio/planning/outcomes/review/evidence/retention/exceptions/oversight/reviews/aging/outcomes/reopen/plans/oversight/decisions/page.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  for (const key of [
    "recordIndependentRecheckOwnerDecisionAction",
    "owner_gap_status",
    "observed_closure_proof_chain_complete",
    "observed_peer_overdue_rechecks",
    "observed_prior_escalation_decisions",
  ])
    assert.ok(page.includes(key), `Missing Build 128 UI evidence: ${key}`);
});
