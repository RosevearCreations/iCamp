import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  normalizeIndependentReview,
  normalizeReviewAcceptance,
  latestReviewsByResolution,
  canAcceptReview,
} from "../lib/permanent-unit-owner-review/core.mjs";

const now = new Date("2026-10-25T12:00:00.000Z");
const source = "104b0000-0000-4000-8000-000000000001";
const target = "104b0000-0000-4000-8000-000000000002";
const resolutionId = "104b0000-0000-4000-8000-000000000003";
const reviewId = "104b0000-0000-4000-8000-000000000004";
const base = {
  id: reviewId,
  resolutionId,
  planId: "104b0000-0000-4000-8000-000000000005",
  sourceCampgroundId: source,
  targetCampgroundId: target,
  evidenceReference: "camp-review-104",
};

test("an independent supported resolution has no pending action date", () => {
  const result = normalizeIndependentReview(
    {
      ...base,
      reviewKind: "resolution_supported",
      nextReviewAt: "",
      reviewerNote: "A separate owner verified the coordination evidence.",
    },
    now,
  );
  assert.equal(result.nextReviewAt, null);
  assert.throws(() =>
    normalizeIndependentReview(
      {
        ...base,
        reviewKind: "resolution_supported",
        nextReviewAt: "2026-10-30",
        reviewerNote: "A separate owner verified the coordination evidence.",
      },
      now,
    ),
  );
});
test("non-supporting reassessments require a bounded next date and privacy-safe notes", () => {
  const valid = {
    ...base,
    reviewKind: "additional_evidence_needed",
    nextReviewAt: "2026-11-01",
    reviewerNote: "Confirm operating evidence before another owner meeting.",
  };
  assert.equal(
    normalizeIndependentReview(valid, now).nextReviewAt,
    "2026-11-01T23:59:00.000Z",
  );
  for (const values of [
    { nextReviewAt: "" },
    { nextReviewAt: "2026-10-24" },
    { nextReviewAt: "2027-04-01" },
    { reviewKind: "automatically_approve_financing" },
    { targetCampgroundId: source },
    { reviewerNote: "Call applicant@example.com with their credit report" },
    { evidenceReference: "Bank 123456789 is pending" },
  ])
    assert.throws(() =>
      normalizeIndependentReview({ ...valid, ...values }, now),
    );
});
test("acceptance requires a valid latest reassessment source and independent supported status", () => {
  const input = {
    ...base,
    reassessmentId: reviewId,
    acceptanceNote: "Independent owner review has been checked and accepted.",
  };
  assert.equal(normalizeReviewAcceptance(input).reassessmentId, reviewId);
  assert.throws(() =>
    normalizeReviewAcceptance({ ...input, reassessmentId: "" }),
  );
  const history = [
    {
      id: reviewId,
      resolutionId,
      reviewKind: "resolution_supported",
      reviewedAt: "2026-10-22T12:00:00Z",
    },
    {
      id: "104b0000-0000-4000-8000-000000000006",
      resolutionId,
      reviewKind: "resolution_requires_revisit",
      reviewedAt: "2026-10-25T12:00:00Z",
    },
  ];
  const latest = latestReviewsByResolution(history).get(resolutionId);
  assert.equal(canAcceptReview(latest, false), false);
  assert.equal(canAcceptReview(history[0], false), true);
  assert.equal(canAcceptReview(history[0], true), false);
});
test("SQL enforces immutable dual-campground RLS and owner role separation", () => {
  const migration = readFileSync(
    new URL(
      "../database/migrations/0135_owner_handoff_resolution_review.sql",
      import.meta.url,
    ),
    "utf8",
  ).toLowerCase();
  const verification = readFileSync(
    new URL(
      "../database/verify/0135_owner_handoff_resolution_review.sql",
      import.meta.url,
    ),
    "utf8",
  ).toLowerCase();
  const backend = readFileSync(
    new URL("../lib/permanent-unit-owner-review/postgres.mjs", import.meta.url),
    "utf8",
  ).toLowerCase();
  for (const needle of [
    "force row level security",
    "is_campground_finance_owner(source_campground_id)",
    "is_campground_finance_owner(target_campground_id)",
    "winterization_append_only",
    "resolved_by_user_id=new.reviewed_by_user_id",
    "new.accepted_by_user_id=latest.reviewed_by_user_id",
    "pg_advisory_xact_lock",
    "resolution_id uuid not null unique",
    "revoke all",
  ])
    assert.ok(migration.includes(needle), needle);
  for (const needle of [
    "relforcerowsecurity",
    "has_table_privilege",
    "pg_get_functiondef",
    "reviewer and acceptor separation",
  ])
    assert.ok(verification.includes(needle), needle);
  for (const needle of [
    "getcampgroundauthorization",
    "owner_admin",
    "permanent_unit.transfer",
    "set local role icamp_app",
    "source_campground_id=any",
    "target_campground_id=any",
  ])
    assert.ok(backend.includes(needle), needle);
  for (const forbidden of [
    "credit_score",
    "buyer_display_name",
    "update public.",
    "delete from public.",
    "insert into public.permanent_unit_financing",
  ])
    assert.equal(backend.includes(forbidden), false, forbidden);
});
