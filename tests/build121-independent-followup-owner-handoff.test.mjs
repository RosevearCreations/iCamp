import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  normalizeOwnerFollowupHandoffDecision,
  classifyIndependentOutcomeAging,
} from "../lib/permanent-unit-owner-retention/recurrence-core.mjs";

const now = new Date("2026-10-26T12:00:00.000Z");
const pair = {
  sourceCampgroundId: "a1111111-1111-4111-8111-111111111111",
  targetCampgroundId: "b2222222-2222-4222-8222-222222222222",
};
const input = {
  id: "e5555555-5555-4555-8555-555555555555",
  independentReviewId: "f4444444-4444-4444-8444-444444444444",
  ...pair,
  actionKind: "escalation_handoff_accepted",
  nextDueAt: "2026-11-01",
  evidenceReference: "Owner escalation evidence 121",
  actionNote:
    "I accept the handoff and will independently reconcile the evidence.",
};

test("Build 121 owner handoff accepts bounded UTC dates and rejects unsafe actions", () => {
  assert.equal(
    normalizeOwnerFollowupHandoffDecision(input, now).nextDueAt,
    "2026-11-01T23:59:00.000Z",
  );
  assert.throws(
    () =>
      normalizeOwnerFollowupHandoffDecision(
        { ...input, actionKind: "release_hold" },
        now,
      ),
    /Unknown owner/,
  );
  assert.throws(
    () =>
      normalizeOwnerFollowupHandoffDecision(
        { ...input, nextDueAt: "2026-10-20" },
        now,
      ),
    /within 90 days/,
  );
  assert.throws(
    () =>
      normalizeOwnerFollowupHandoffDecision(
        { ...input, nextDueAt: "2027-05-01" },
        now,
      ),
    /within 90 days/,
  );
  assert.throws(
    () =>
      normalizeOwnerFollowupHandoffDecision(
        { ...input, nextDueAt: "2026-11-31" },
        now,
      ),
    /within 90 days/,
  );
  assert.throws(
    () =>
      normalizeOwnerFollowupHandoffDecision(
        { ...input, actionKind: "evidence_reconciled" },
        now,
      ),
    /cannot schedule/,
  );
  assert.equal(
    normalizeOwnerFollowupHandoffDecision(
      {
        ...input,
        actionKind: "audit_confirmation_acknowledged",
        nextDueAt: "",
      },
      now,
    ).nextDueAt,
    null,
  );
  assert.throws(
    () =>
      normalizeOwnerFollowupHandoffDecision(
        { ...input, targetCampgroundId: pair.sourceCampgroundId },
        now,
      ),
    /different campgrounds/,
  );
});

test("Build 121 labels open, overdue and reconciled independent outcomes", () => {
  assert.equal(
    classifyIndependentOutcomeAging(
      { review_kind: "manual_escalation", next_due_at: "2026-11-01" },
      null,
      now,
    ),
    "escalation_handoff_pending",
  );
  assert.equal(
    classifyIndependentOutcomeAging(
      { review_kind: "request_new_evidence", next_due_at: "2026-10-20" },
      null,
      now,
    ),
    "owner_handoff_overdue",
  );
  assert.equal(
    classifyIndependentOutcomeAging(
      { review_kind: "continue_exception", next_due_at: "2026-09-01" },
      null,
      now,
    ),
    "owner_handoff_overdue_30_plus",
  );
  assert.equal(
    classifyIndependentOutcomeAging(
      { review_kind: "confirm_audit_acknowledged" },
      null,
      now,
    ),
    "awaiting_owner_audit_acknowledgment",
  );
  assert.equal(
    classifyIndependentOutcomeAging(
      {},
      { action_kind: "escalation_handoff_accepted" },
      now,
    ),
    "escalation_handoff_recorded",
  );
  assert.equal(
    classifyIndependentOutcomeAging(
      {},
      { action_kind: "evidence_reconciled" },
      now,
    ),
    "owner_evidence_reconciled",
  );
  assert.equal(
    classifyIndependentOutcomeAging(
      {},
      { action_kind: "audit_confirmation_acknowledged" },
      now,
    ),
    "owner_audit_acknowledged",
  );
});

test("Build 121 SQL records immutable snapshots with independent actor and escalation guards", () => {
  const sql = readFileSync(
    new URL(
      "../database/migrations/0151_independent_followup_owner_handoff_reconciliation.sql",
      import.meta.url,
    ),
    "utf8",
  );
  for (const guard of [
    "independent_review_id uuid not null unique",
    "force row level security",
    "winterization_append_only",
    "pg_advisory_xact_lock",
    "acted_by_user_id=review_record.reviewed_by_user_id",
    "observed_review_days_overdue",
    "observed_peer_overdue_reviews",
    "observed_prior_escalation_handoffs",
    "observed_review_days_overdue>=30",
    "escalation_handoff_accepted",
    "evidence_reconciled",
    "audit_confirmation_acknowledged",
    "interval '90 days'",
  ])
    assert.ok(sql.includes(guard), `Missing invariant: ${guard}`);
  assert.ok(!/update public\.owner_export_closure_followup_reviews/i.test(sql));
});

test("Build 121 private owner UI exposes review aging and handoff evidence", () => {
  const page = readFileSync(
    new URL(
      "../app/workspaces/management/campgrounds/permanent-units/financing/owner-portfolio/planning/outcomes/review/evidence/retention/exceptions/oversight/reviews/aging/outcomes/reopen/plans/oversight/decisions/page.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(page, /recordOwnerIndependentHandoffAction/);
  assert.match(page, /owner_reconciliation_status/);
  assert.match(page, /observed_peer_overdue_reviews/);
  assert.match(page, /observed_prior_escalation_handoffs/);
});
