import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  normalizeQl253HoldReview,
  classifyQl253HoldReviewStatus,
} from "../lib/permanent-unit-owner-retention/recurrence-core.mjs";
import { retestQl253ImmutablePublication } from "../lib/integration-v1/ql253-immutable-public-retest.mjs";

const now = new Date("2026-10-28T12:00:00.000Z");
const A = "5f7caaef37a2f8ec8ba2eb2913564e1a3b3c62c9";
const MAIN = "92316c576f8031ffb4889565f0421a5bd6aa138b";
const CI =
  "https://github.com/RosevearCreations/iCamp/actions/runs/40794126949";
const base = {
  id: "a1111111-1111-4111-8111-111111111111",
  ql252ReviewId: "b2222222-2222-4222-8222-222222222222",
  sourceCampgroundId: "c3333333-3333-4333-8333-333333333333",
  targetCampgroundId: "d4444444-4444-4444-8444-444444444444",
  sourceSystem: "icamp",
  repository: "RosevearCreations/iCamp",
  reviewKind: "immutable_proof_publication_retest",
  outcomeKind: "immutable_public_proof_404",
  sourceRevisionSha: A,
  sourceCiRunUrl: CI,
  proofHttpStatus: "404",
  nextDueAt: "2026-11-15",
  evidenceReference: "np-original-immutable-main-404",
  reviewNote: "QL-253 immutable proof remains 404, no signed proof B exists.",
};
const custody = {
  ...base,
  priorReviewId: base.id,
  reviewKind: "independent_custody_pin_challenge_renewal",
  outcomeKind: "authenticated_custody_witness_missing",
  sourceRevisionSha: "",
  sourceCiRunUrl: "",
  proofHttpStatus: "NOT_CHECKED",
};
const owner = {
  ...custody,
  reviewKind: "owner_test_only_authorization_hold_reconciliation",
  outcomeKind: "owner_test_not_given_hold",
};

test("QL-253 immutable 404 cannot masquerade as published proof B or original signer pin", () => {
  const r = normalizeQl253HoldReview(base, now);
  assert.equal(r.proofHttpStatus, "404");
  assert.equal(r.proofCommitSha, null);
  for (const variant of [
    { proofHttpStatus: "200" },
    { proofCommitSha: "b".repeat(40) },
    { proofSha256: "a".repeat(64) },
    { publicSpkiSha256: "c".repeat(64) },
    { sourceAuditReference: "np-unwitnessed-proof" },
    { repository: "RosevearCreations/yw" },
    {
      sourceCiRunUrl: "https://github.com/RosevearCreations/yw/actions/runs/1",
    },
  ])
    assert.throws(() => normalizeQl253HoldReview({ ...base, ...variant }, now));
});

test("QL-253 public 200 still requires distinct A/B and exact raw bytes, never auto-trust", () => {
  const candidate = {
    ...base,
    outcomeKind: "published_candidate_origin_unverified",
    proofHttpStatus: "200",
    proofCommitSha: "b".repeat(40),
    proofSha256: "c".repeat(64),
    publicSpkiSha256: "d".repeat(64),
    sourceAuditReference: "np-original-public-source-audit",
  };
  assert.equal(
    normalizeQl253HoldReview(candidate, now).proofCommitSha,
    "b".repeat(40),
  );
  assert.throws(() =>
    normalizeQl253HoldReview({ ...candidate, proofCommitSha: A }, now),
  );
  assert.throws(() =>
    normalizeQl253HoldReview({ ...candidate, sourceAuditReference: "" }, now),
  );
});

test("QL-253 five-minute custody witness claims require independent distinct receipts, no secret nonce", () => {
  assert.equal(normalizeQl253HoldReview(custody, now).custodianReceiptId, null);
  const claimed = {
    ...custody,
    outcomeKind: "five_minute_nonce_claim_unverified",
    custodianReceiptId: "np-private-custodian-evidence",
    distinctWitnessReceiptId: "np-distinct-witness-evidence",
    challengeSha256: "a".repeat(64),
    custodyPinSha256: "b".repeat(64),
    challengeIssuedAt: "2026-10-28T11:55:00.000Z",
    challengeExpiresAt: "2026-10-28T12:00:00.000Z",
  };
  assert.equal(
    normalizeQl253HoldReview(claimed, now).challengeSha256,
    "a".repeat(64),
  );
  for (const variant of [
    { distinctWitnessReceiptId: claimed.custodianReceiptId },
    { challengeExpiresAt: "2026-10-28T12:00:01.000Z" },
    { challengeIssuedAt: "2026-10-28T13:00:00.000Z" },
    { challengeSha256: "raw-secret-nonce" },
    { challengeIssuedAt: "2026-10-28T11:55:00Z" },
  ])
    assert.throws(() =>
      normalizeQl253HoldReview({ ...claimed, ...variant }, now),
    );
  assert.throws(() =>
    normalizeQl253HoldReview(
      { ...custody, custodianReceiptId: "np-claimed-receipt" },
      now,
    ),
  );
});

test("QL-253 owner TEST-only review remains HOLD even with scoped future request or an unverified receipt", () => {
  assert.equal(normalizeQl253HoldReview(owner, now).ownerTestReceiptId, null);
  const requested = {
    ...owner,
    outcomeKind: "private_owner_test_review_requested_hold",
    testTenantId: "np-camp-rosevear-test-tenant",
    testWindowStart: "2026-10-29T20:00:00.000Z",
    testWindowEnd: "2026-10-29T20:30:00.000Z",
  };
  assert.equal(
    normalizeQl253HoldReview(requested, now).testTenantId,
    requested.testTenantId,
  );
  const claim = {
    ...requested,
    outcomeKind: "owner_approval_receipt_claim_unverified_hold",
    ownerTestReceiptId: "np-unverified-private-owner-claim",
  };
  assert.equal(
    normalizeQl253HoldReview(claim, now).ownerTestReceiptId,
    claim.ownerTestReceiptId,
  );
  for (const variant of [
    { testWindowEnd: "2026-10-29T20:30:01.000Z" },
    { testWindowStart: "2026-10-28T10:00:00.000Z" },
    { testTenantId: "prod-camp-secret" },
    { ownerTestReceiptId: "np-unverified-private-owner-claim" },
  ])
    assert.throws(() =>
      normalizeQl253HoldReview({ ...requested, ...variant }, now),
    );
  assert.throws(() =>
    normalizeQl253HoldReview(
      { ...owner, ownerTestReceiptId: "np-unverified-private-owner-claim" },
      now,
    ),
  );
});

test("QL-253 independent follow-up status ages and cycles, without connected state", () => {
  assert.equal(
    classifyQl253HoldReviewStatus(
      {
        review_kind: "immutable_proof_publication_retest",
        next_due_at: "2026-10-31",
      },
      null,
      now,
    ),
    "custody_pin_challenge_review_pending",
  );
  assert.equal(
    classifyQl253HoldReviewStatus(
      {
        review_kind: "independent_custody_pin_challenge_renewal",
        next_due_at: "2026-10-01",
      },
      null,
      now,
    ),
    "ql253_overdue_hold",
  );
  assert.equal(
    classifyQl253HoldReviewStatus(
      {
        review_kind: "owner_test_only_authorization_hold_reconciliation",
        next_due_at: "2026-08-01",
      },
      null,
      now,
    ),
    "ql253_overdue_30_plus_hold",
  );
  assert.equal(
    classifyQl253HoldReviewStatus(
      { review_kind: "immutable_proof_publication_retest" },
      { id: "independent" },
      now,
    ),
    "independent_ql253_followup_recorded",
  );
});

test("QL-253 public-origin command independently retries exact main and never calls a gateway", async () => {
  const touched = [];
  const get = async (url) => {
    touched.push(url);
    if (url.endsWith("/actions/runs/40794126949"))
      return {
        ok: true,
        json: async () => ({ head_sha: A, conclusion: "success" }),
      };
    if (url.endsWith("/branches/main"))
      return { ok: true, json: async () => ({ commit: { sha: MAIN } }) };
    if (url.includes("raw.githubusercontent.com/"))
      return { ok: false, status: 404 };
    throw new Error(`Unexpected network fetch: ${url}`);
  };
  const report = await retestQl253ImmutablePublication(
    {
      sourceShaA: A,
      sourceCiRunUrl: CI,
    },
    get,
  );
  assert.equal(report.status, "PUBLIC_PROOF_404");
  assert.equal(report.current_main_sha, MAIN);
  assert.equal(report.immutable_main_public_proof_http_status, 404);
  assert.equal(report.ql253_status, "IMMUTABLE_MAIN_PUBLIC_PROOF_404_HOLD");
  assert.equal(report.actual_gateway_test, "NOT_RUN");
  assert.equal(report.connection_state, "DISCONNECTED");
  assert.equal(
    report.separately_authenticated_owner_test_decision,
    "NOT_GIVEN",
  );
  assert.equal(touched.length, 4);
  assert.ok(
    touched.every(
      (url) =>
        url.startsWith("https://api.github.com/") ||
        url.startsWith("https://raw.githubusercontent.com/"),
    ),
  );
});

test("QL-253 release contains immutable RLS audit and no authority-granting toggle", () => {
  const migrate = readFileSync(
    new URL(
      "../database/migrations/0178_ql253_immutable_proof_custody_owner_hold.sql",
      import.meta.url,
    ),
    "utf8",
  );
  const verify = readFileSync(
    new URL(
      "../database/verify/0178_ql253_immutable_proof_custody_owner_hold.sql",
      import.meta.url,
    ),
    "utf8",
  );
  const script = readFileSync(
    new URL("../scripts/ql253-immutable-public-retest.mjs", import.meta.url),
    "utf8",
  );
  assert.match(migrate, /force row level security/);
  assert.match(migrate, /winterization_append_only/);
  assert.match(migrate, /actual_gateway_test:='NOT_RUN'/);
  assert.match(migrate, /owner_test_authorized:=false/);
  assert.match(verify, /signed_proof_independently_trusted/);
  assert.match(script, /--public-get/);
  assert.doesNotMatch(script, /\/api\/integration\/v1\/health/);
});
