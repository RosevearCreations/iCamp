import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  normalizeReconciliationExceptionReview,
  normalizeIndependentClosureRecheck,
} from "../lib/permanent-unit-owner-retention/recurrence-core.mjs";
const id = "d4444444-4444-4444-8444-444444444444";
const review = "c3333333-3333-4333-8333-333333333333";
const pair = {
  sourceCampgroundId: "a1111111-1111-4111-8111-111111111111",
  targetCampgroundId: "b2222222-2222-4222-8222-222222222222",
};
test("Build 118 recurrence snapshots accept only a directed pair and source evidence", () => {
  const input = {
    id,
    ownerActionId: review,
    ...pair,
    evidenceReference: "Audit evidence reference 61",
    reviewNote: "Reviewed owner reconciliation for repeat exception exposure.",
  };
  assert.deepEqual(normalizeReconciliationExceptionReview(input), input);
  assert.throws(
    () =>
      normalizeReconciliationExceptionReview({
        ...input,
        targetCampgroundId: pair.sourceCampgroundId,
      }),
    /different/,
  );
  assert.throws(
    () =>
      normalizeReconciliationExceptionReview({
        ...input,
        evidenceReference: "person@example.com",
      }),
    /identifiers/,
  );
});
test("Build 118 independent closure recheck rejects unrecognized decisions", () => {
  const input = {
    id,
    exceptionReviewId: review,
    ...pair,
    recheckKind: "continue_exception",
    evidenceReference: "Closure reference 67",
    recheckNote:
      "Independent reviewer confirms another exception review is necessary.",
  };
  assert.deepEqual(normalizeIndependentClosureRecheck(input), input);
  assert.throws(
    () =>
      normalizeIndependentClosureRecheck({
        ...input,
        recheckKind: "auto_release",
      }),
    /Unknown/,
  );
});
test("Build 118 database guards append-only owner and independent history", () => {
  const sql = readFileSync(
    new URL(
      "../database/migrations/0148_owner_reconciliation_exception_closure_recheck.sql",
      import.meta.url,
    ),
    "utf8",
  );
  for (const s of [
    "force row level security",
    "winterization_append_only",
    "pg_advisory_xact_lock",
    "observed_open_gaps",
    "observed_overdue_gaps",
    "observed_recurrence_count",
    "rechecked_by_user_id=r.reviewed_by_user_id",
    "rechecked_by_user_id=anchor.acted_by_user_id",
    "independent_audit_closed",
    "observed_continued_holds",
  ])
    assert.ok(sql.includes(s), s);
});
