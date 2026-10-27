import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  normalizeClosureRecurrenceEvent,
  classifyClosureRecurrenceStatus,
} from "../lib/permanent-unit-owner-retention/recurrence-core.mjs";

const now = new Date("2026-10-27T12:00:00.000Z");
const input = {
  id: "d5555555-5555-4555-8555-555555555555",
  proofReviewId: "e6666666-6666-4666-8666-666666666666",
  sourceCampgroundId: "a1111111-1111-4111-8111-111111111111",
  targetCampgroundId: "b2222222-2222-4222-8222-222222222222",
  eventKind: "independent_recurrence_check",
  outcomeKind: "recurrence_gap",
  nextDueAt: "2026-11-13",
  evidenceReference: "Independent recurrence evidence ledger 130",
  eventNote: "The follow-up review found newly recurring owner evidence gaps.",
};
const prior = "f7777777-7777-4777-8777-777777777777";

test("Build 130 accepts only legal three-stage recurrence events and bounded due dates", () => {
  assert.equal(
    normalizeClosureRecurrenceEvent(input, now).nextDueAt,
    "2026-11-13T23:59:00.000Z",
  );
  for (const outcomeKind of [
    "release_hold",
    "reopen_evidence",
    "verify_followup_evidence",
  ]) {
    assert.throws(
      () => normalizeClosureRecurrenceEvent({ ...input, outcomeKind }, now),
      /Invalid closure recurrence stage or outcome/,
    );
  }
  for (const nextDueAt of ["2026-10-26", "2026-11-31", "2027-08-15"]) {
    assert.throws(
      () => normalizeClosureRecurrenceEvent({ ...input, nextDueAt }, now),
      /within 90 days/,
    );
  }
  assert.throws(
    () =>
      normalizeClosureRecurrenceEvent({ ...input, priorEventId: prior }, now),
    /cannot cite a prior event/,
  );
  assert.throws(
    () =>
      normalizeClosureRecurrenceEvent(
        { ...input, targetCampgroundId: input.sourceCampgroundId },
        now,
      ),
    /different campgrounds/,
  );
  assert.throws(
    () =>
      normalizeClosureRecurrenceEvent(
        {
          ...input,
          eventKind: "owner_exception_reopen",
          outcomeKind: "reopen_evidence",
        },
        now,
      ),
    /need their prior event/,
  );
});

test("Build 130 requires distinct linked owner evidence for verified follow-up", () => {
  const pending = {
    ...input,
    eventKind: "independent_followup_verify",
    outcomeKind: "request_more_followup_evidence",
    priorEventId: prior,
  };
  assert.equal(
    normalizeClosureRecurrenceEvent(pending, now).ownerEvidenceDecisionId,
    null,
  );
  assert.throws(
    () =>
      normalizeClosureRecurrenceEvent(
        {
          ...pending,
          outcomeKind: "verify_followup_evidence",
          nextDueAt: "",
        },
        now,
      ),
    /needs a linked owner evidence disposition/,
  );
  assert.throws(
    () =>
      normalizeClosureRecurrenceEvent(
        {
          ...pending,
          ownerEvidenceDecisionId: prior,
        },
        now,
      ),
    /Open stages cannot cite a completed/,
  );
  assert.throws(
    () =>
      normalizeClosureRecurrenceEvent(
        {
          ...pending,
          outcomeKind: "verify_followup_evidence",
          ownerEvidenceDecisionId: prior,
        },
        now,
      ),
    /cannot schedule an open due date/,
  );
  const accepted = normalizeClosureRecurrenceEvent(
    {
      ...pending,
      outcomeKind: "verify_followup_evidence",
      ownerEvidenceDecisionId: prior,
      nextDueAt: "",
    },
    now,
  );
  assert.equal(accepted.nextDueAt, null);
});

test("Build 130 aging distinguishes completed verification and overdue reopened cases", () => {
  assert.equal(
    classifyClosureRecurrenceStatus(
      { outcome_kind: "continuity_stable" },
      null,
      now,
    ),
    "continuity_monitoring_stable",
  );
  assert.equal(
    classifyClosureRecurrenceStatus(
      {
        event_kind: "independent_recurrence_check",
        outcome_kind: "recurrence_gap",
        next_due_at: "2026-09-01",
      },
      null,
      now,
    ),
    "recurrence_followup_overdue_30_plus",
  );
  assert.equal(
    classifyClosureRecurrenceStatus(
      {
        event_kind: "owner_exception_reopen",
        outcome_kind: "reopen_evidence",
        next_due_at: "2026-10-26",
      },
      null,
      now,
    ),
    "recurrence_followup_overdue",
  );
  assert.equal(
    classifyClosureRecurrenceStatus(
      {
        event_kind: "owner_exception_reopen",
        outcome_kind: "reopen_evidence",
        next_due_at: "2026-11-13",
      },
      null,
      now,
    ),
    "independent_audit_followup_pending",
  );
  assert.equal(
    classifyClosureRecurrenceStatus(
      {},
      {
        outcome_kind: "verify_followup_evidence",
      },
      now,
    ),
    "verified_source_linked_followup",
  );
});

test("Build 130 database enforces source replay, independent handoffs, RLS and immutable chain", () => {
  const sql = readFileSync(
    new URL(
      "../database/migrations/0160_independent_closure_recurrence_reopen_followup.sql",
      import.meta.url,
    ),
    "utf8",
  );
  for (const invariant of [
    "prior_event_id uuid unique references",
    "root_reopen_id uuid references",
    "proof_review_id uuid not null references",
    "owner_evidence_decision_id uuid references",
    "force row level security",
    "winterization_append_only",
    "pg_advisory_xact_lock",
    "proof_record.review_kind<>'confirm_proof_continuity'",
    "new.observed_original_proof_verified",
    "recurrence reviewer must be independent",
    "new.recorded_by_user_id in(prior_record.recorded_by_user_id",
    "replay_record.recorded_at<=prior_record.recorded_at",
    "new.observed_prior_days_overdue>=30",
    "owner_exception_reopen",
    "independent_followup_verify",
    "with recursive followup_chain",
    "interval '90 days'",
  ])
    assert.ok(
      sql.toLowerCase().includes(invariant.toLowerCase()),
      `Missing DB contract: ${invariant}`,
    );
  assert.ok(!/update public\.owner_export_(?:independent|closure)/i.test(sql));
});

test("Build 130 UI provides actions for check, reopening, and independent follow-up", () => {
  const page = readFileSync(
    new URL(
      "../app/workspaces/management/campgrounds/permanent-units/financing/owner-portfolio/planning/outcomes/review/evidence/retention/exceptions/oversight/reviews/aging/outcomes/reopen/plans/oversight/decisions/page.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  for (const invariant of [
    "recordClosureRecurrenceEventAction",
    "independent_recurrence_check",
    "owner_exception_reopen",
    "independent_followup_verify",
    "ownerEvidenceDecisionId",
    "recurrence_status",
    "observed_original_proof_verified",
  ])
    assert.ok(
      page.includes(invariant),
      `Missing Build 130 UI contract: ${invariant}`,
    );
});
