import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  normalizeQl248SourceReceiptExceptionReassessment,
  classifyQl248SourceReceiptReassessmentStatus,
  ql247DenialKinds,
} from "../lib/permanent-unit-owner-retention/recurrence-core.mjs";

const now = new Date("2026-10-28T12:00:00Z");
const original = {
  id: "a1111111-1111-4111-8111-111111111111",
  ql248RenewalId: "b2222222-2222-4222-8222-222222222222",
  sourceCampgroundId: "a1111111-1111-4111-8111-111111111111",
  targetCampgroundId: "b2222222-2222-4222-8222-222222222222",
  sourceSystem: "icamp",
  repository: "RosevearCreations/iCamp",
  reviewKind: "original_source_receipt_escalation_followup",
  outcomeKind: "original_receipts_missing",
  nextDueAt: "2026-11-10",
  evidenceReference: "np-ql248-original-source-gap",
  reviewNote:
    "No seven original source receipts have been independently provided.",
};
const originals = ql247DenialKinds.map(
  (kind, index) => `${kind}|np-original-source-${index}`,
);

test("Build 146 records honest missing original receipts, not fabricated indexes", () => {
  assert.deepEqual(
    normalizeQl248SourceReceiptExceptionReassessment(original, now)
      .denialReceiptIds,
    [],
  );
  assert.throws(
    () =>
      normalizeQl248SourceReceiptExceptionReassessment(
        { ...original, denialReceiptIds: originals },
        now,
      ),
    /Missing original receipts/,
  );
  assert.throws(
    () =>
      normalizeQl248SourceReceiptExceptionReassessment(
        {
          ...original,
          reviewKind: "independent_hold_exception_reassessment",
          outcomeKind: "hold_reaffirmed_authorization_not_given",
        },
        now,
      ),
    /Begin with/,
  );
});

test("Six-app original denial receipt indexes are distinct and never treated as witnessed", () => {
  const unverified = {
    ...original,
    outcomeKind: "original_references_unverified",
    denialReceiptIds: originals,
    sourceAuditReference: "np-independent-original-source-audit",
  };
  assert.equal(
    normalizeQl248SourceReceiptExceptionReassessment(unverified, now)
      .denialReceiptIds.length,
    7,
  );
  for (const patch of [
    { denialReceiptIds: originals.slice(1) },
    { sourceAuditReference: "" },
    {
      denialReceiptIds: [
        ...originals.slice(0, 6),
        "dispatch_denied|np-original-source-0",
      ],
    },
    { repository: "RosevearCreations/rosiedazzlers" },
    { sourceSystem: "not-an-app" },
  ])
    assert.throws(() =>
      normalizeQl248SourceReceiptExceptionReassessment(
        { ...unverified, ...patch },
        now,
      ),
    );
  assert.throws(
    () =>
      normalizeQl248SourceReceiptExceptionReassessment(
        { ...original, outcomeKind: "source_receipt_mismatch_escalated" },
        now,
      ),
    /requires an actual original ID/,
  );
});

test("Independent HOLD reassessment cannot infer owner approval or leak source indexes", () => {
  const hold = {
    ...original,
    priorReviewId: original.id,
    reviewKind: "independent_hold_exception_reassessment",
    outcomeKind: "hold_reaffirmed_authorization_not_given",
  };
  assert.equal(
    normalizeQl248SourceReceiptExceptionReassessment(hold, now)
      .ownerAuthorizationReference,
    null,
  );
  assert.throws(
    () =>
      normalizeQl248SourceReceiptExceptionReassessment(
        { ...hold, ownerAuthorizationReference: "np-owner-unverified" },
        now,
      ),
    /NOT GIVEN/,
  );
  assert.throws(
    () =>
      normalizeQl248SourceReceiptExceptionReassessment(
        { ...hold, outcomeKind: "owner_reference_unverified_hold" },
        now,
      ),
    /requires a real nonsecret index/,
  );
  assert.throws(
    () =>
      normalizeQl248SourceReceiptExceptionReassessment(
        { ...hold, denialReceiptIds: originals },
        now,
      ),
    /belong to escalation/,
  );
  assert.equal(
    normalizeQl248SourceReceiptExceptionReassessment(
      {
        ...hold,
        outcomeKind: "owner_reference_unverified_hold",
        ownerAuthorizationReference: "np-owner-unverified",
      },
      now,
    ).ownerAuthorizationReference,
    "np-owner-unverified",
  );
  assert.throws(
    () =>
      normalizeQl248SourceReceiptExceptionReassessment(
        { ...hold, nextDueAt: "2027-04-30" },
        now,
      ),
    /within 90 days/,
  );
});

test("Build 146 aging and independent stage continuity statuses", () => {
  assert.equal(
    classifyQl248SourceReceiptReassessmentStatus(
      { next_due_at: "2026-09-01" },
      null,
      now,
    ),
    "build146_source_gap_or_hold_overdue_30_plus",
  );
  assert.equal(
    classifyQl248SourceReceiptReassessmentStatus(
      {
        next_due_at: "2026-11-10",
        review_kind: "original_source_receipt_escalation_followup",
      },
      null,
      now,
    ),
    "independent_hold_exception_reassessment_pending",
  );
  assert.equal(
    classifyQl248SourceReceiptReassessmentStatus(
      {
        next_due_at: "2026-11-10",
        review_kind: "independent_hold_exception_reassessment",
      },
      null,
      now,
    ),
    "original_source_receipt_followup_renewal_pending",
  );
  assert.equal(
    classifyQl248SourceReceiptReassessmentStatus(
      original,
      { id: original.id },
      now,
    ),
    "subsequent_independent_build146_review_recorded",
  );
});

test("Build 146 SQL, UI, and server actions retain private, immutable HOLD-only boundaries", () => {
  const read = (relative) =>
    readFileSync(new URL(relative, import.meta.url), "utf8");
  const sql = read(
    "../database/migrations/0176_ql248_source_receipt_escalation_hold_reassessment.sql",
  );
  for (const invariant of [
    "force row level security",
    "ql248_146_source_receipt_hold_immutable",
    "reviewed_by_user_id=new.reviewed_by_user_id",
    "base.reviewed_by_user_id=new.reviewed_by_user_id",
    "new.phase_b_test_authorized:=false",
    "new.owner_pilot_authorized:=false",
    "new.dispatch_enabled:=false",
    "new.connection_state:='DISCONNECTED'",
    "new.gate_state:='HOLD'",
    "source_system",
    "original_receipts_missing",
    "observed_overdue_145_leaves",
  ])
    assert.ok(sql.includes(invariant), `missing SQL invariant ${invariant}`);
  const actions = read(
    "../app/workspaces/management/campgrounds/permanent-units/financing/owner-portfolio/planning/outcomes/review/evidence/retention/exceptions/oversight/reviews/aging/outcomes/reopen/plans/oversight/decisions/actions.ts",
  );
  const page = read(
    "../app/workspaces/management/campgrounds/permanent-units/financing/owner-portfolio/planning/outcomes/review/evidence/retention/exceptions/oversight/reviews/aging/outcomes/reopen/plans/oversight/decisions/page.tsx",
  );
  assert.ok(
    actions.includes("recordQl248SourceReceiptExceptionReassessmentAction"),
  );
  assert.ok(page.includes("ql248SourceReceiptQueue"));
  assert.ok(page.includes("DISCONNECTED / HOLD"));
});
