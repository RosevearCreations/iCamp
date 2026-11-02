import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizeAcceptanceExceptionReview } from "../lib/permanent-unit-owner-retention/reopen-core.mjs";
const a = "11111111-1111-4111-8111-111111111111",
  b = "22222222-2222-4222-8222-222222222222";
const sample = {
  id: a,
  acceptanceId: b,
  sourceCampgroundId: a,
  targetCampgroundId: b,
  reviewKind: "reopen_recommended",
  evidenceReference: "internal-review-ref",
  reviewNote: "Independent audit discrepancy reviewed.",
};
test("bounded independent exception review input", () => {
  assert.equal(
    normalizeAcceptanceExceptionReview(sample).reviewKind,
    "reopen_recommended",
  );
  assert.throws(
    () =>
      normalizeAcceptanceExceptionReview({
        ...sample,
        reviewKind: "reopen_now",
      }),
    /Unknown/,
  );
  assert.throws(
    () =>
      normalizeAcceptanceExceptionReview({ ...sample, targetCampgroundId: a }),
    /different/,
  );
  assert.throws(
    () =>
      normalizeAcceptanceExceptionReview({
        ...sample,
        reviewNote: "email abc@example.org",
      }),
    /identifiers/,
  );
});
test("database checks independence, freshness, drift, immutable RLS and safe boundary", () => {
  const sql = readFileSync(
    new URL(
      "../database/migrations/0143_owner_acceptance_exception_reopen.sql",
      import.meta.url,
    ),
    "utf8",
  );
  for (const token of [
    "force row level security",
    "owner_acceptance_exception_review_immutable",
    "accepted_by_user_id",
    "recorded_by_user_id",
    "reassessed_by_user_id",
    "current_decision",
    "current_reassessment",
    "current_outcome",
    "cases_since_acceptance",
    "observed_unclosed_cases",
    "109109",
    "reopen_recommended",
  ])
    assert.ok(sql.includes(token), `missing ${token}`);
  assert.ok(!sql.includes("update public.owner_export_outcome_acceptances"));
});
