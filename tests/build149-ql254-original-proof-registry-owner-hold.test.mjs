import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  normalizeQl254HoldReview,
  classifyQl254HoldReviewStatus,
} from "../lib/permanent-unit-owner-retention/recurrence-core.mjs";
import { refreshQl254OriginalSourceEvidence } from "../lib/integration-v1/ql254-original-proof-refresh.mjs";

const now = new Date("2026-10-28T12:00:00.000Z");
const A = "5f7caaef37a2f8ec8ba2eb2913564e1a3b3c62c9";
const MAIN = "4397a1d74a7a058b64cc9a991fd3ccfd42c02d39";
const CI =
  "https://github.com/RosevearCreations/iCamp/actions/runs/40794126949";
const base = {
  id: "a1111111-1111-4111-8111-111111111111",
  ql253ReviewId: "b2222222-2222-4222-8222-222222222222",
  sourceCampgroundId: "c3333333-3333-4333-8333-333333333333",
  targetCampgroundId: "d4444444-4444-4444-8444-444444444444",
  sourceSystem: "icamp",
  repository: "RosevearCreations/iCamp",
  reviewKind: "original_immutable_source_proof_refresh",
  outcomeKind: "immutable_proof_still_404",
  mainRevisionSha: MAIN,
  sourceRevisionSha: A,
  sourceCiRunUrl: CI,
  proofHttpStatus: "404",
  nextDueAt: "2026-11-15",
  evidenceReference: "np-ql254-original-main-404",
  reviewNote:
    "Original immutable signed source proof remains missing; no B or signer pin.",
};
const registry = {
  ...base,
  priorReviewId: base.id,
  reviewKind: "private_registry_custody_witness_aging",
  outcomeKind: "original_registry_witness_missing",
  mainRevisionSha: "",
  sourceRevisionSha: "",
  sourceCiRunUrl: "",
  proofHttpStatus: "NOT_CHECKED",
};
const owner = {
  ...registry,
  reviewKind: "private_owner_test_decision_continuity",
  outcomeKind: "owner_test_not_given_hold",
};

test("Build 149 QL-254 original immutable 404 never invents B or trusted public pin", () => {
  const r = normalizeQl254HoldReview(base, now);
  assert.equal(r.proofCommitSha, null);
  assert.equal(r.proofHttpStatus, "404");
  for (const variant of [
    { proofHttpStatus: "200" },
    { proofCommitSha: "b".repeat(40) },
    { proofSha256: "c".repeat(64) },
    { publicSpkiSha256: "d".repeat(64) },
    { sourceAuditReference: "np-not-original-public-index" },
    { repository: "RosevearCreations/yw" },
    {
      sourceCiRunUrl: "https://github.com/RosevearCreations/yw/actions/runs/1",
    },
  ])
    assert.throws(() => normalizeQl254HoldReview({ ...base, ...variant }, now));
});

test("QL-254 genuine 200 candidate must be distinct A/B and still UNTRUSTED", () => {
  const candidate = {
    ...base,
    outcomeKind: "signed_proof_candidate_untrusted",
    proofHttpStatus: "200",
    proofCommitSha: "b".repeat(40),
    proofSha256: "c".repeat(64),
    publicSpkiSha256: "d".repeat(64),
    sourceAuditReference: "np-genuine-source-audit-index",
  };
  assert.equal(
    normalizeQl254HoldReview(candidate, now).proofCommitSha,
    "b".repeat(40),
  );
  assert.throws(() =>
    normalizeQl254HoldReview({ ...candidate, proofCommitSha: A }, now),
  );
  assert.throws(() =>
    normalizeQl254HoldReview({ ...candidate, sourceAuditReference: "" }, now),
  );
});

test("QL-254 private registry/witness evidence stays documentary and requires three distinct originals", () => {
  assert.equal(normalizeQl254HoldReview(registry, now).registryReceiptId, null);
  const claim = {
    ...registry,
    outcomeKind: "registry_snapshot_claim_unverified",
    registrySnapshotSha256: "a".repeat(64),
    registryReceiptId: "np-registry-original-receipt",
    custodianReceiptId: "np-custodian-original-receipt",
    witnessReceiptId: "np-independent-witness-receipt",
    registryPinSha256: "b".repeat(64),
    nonceChallengeSha256: "c".repeat(64),
    nonceIssuedAt: "2026-10-28T11:55:00.000Z",
    nonceExpiresAt: "2026-10-28T12:00:00.000Z",
  };
  assert.equal(
    normalizeQl254HoldReview(claim, now).registrySnapshotSha256,
    "a".repeat(64),
  );
  for (const variant of [
    { witnessReceiptId: claim.custodianReceiptId },
    { nonceExpiresAt: "2026-10-28T12:00:01.000Z" },
    { nonceIssuedAt: "2026-10-28T14:00:00.000Z" },
    { nonceChallengeSha256: "raw-private-nonce" },
    { registryReceiptId: "" },
  ])
    assert.throws(() =>
      normalizeQl254HoldReview({ ...claim, ...variant }, now),
    );
  assert.throws(() =>
    normalizeQl254HoldReview(
      { ...registry, witnessReceiptId: "np-false-index" },
      now,
    ),
  );
});

test("QL-254 owner TEST-only request stays HOLD and 24/7 relay cannot run", () => {
  assert.equal(
    normalizeQl254HoldReview(owner, now).relayReadiness,
    "NOT_CONFIGURED",
  );
  assert.equal(
    normalizeQl254HoldReview(
      { ...owner, relayReadiness: "PRIVATE_PLAN_ONLY" },
      now,
    ).relayReadiness,
    "PRIVATE_PLAN_ONLY",
  );
  const request = {
    ...owner,
    outcomeKind: "private_test_review_requested_hold",
    testTenantId: "np-camp-rosevear-nonproduction",
    testWindowStart: "2026-10-29T20:00:00.000Z",
    testWindowEnd: "2026-10-29T20:30:00.000Z",
    relayReadiness: "PRIVATE_PLAN_ONLY",
  };
  assert.equal(
    normalizeQl254HoldReview(request, now).testTenantId,
    request.testTenantId,
  );
  assert.throws(() =>
    normalizeQl254HoldReview(
      { ...request, testWindowEnd: "2026-10-29T20:30:01.000Z" },
      now,
    ),
  );
  assert.throws(() =>
    normalizeQl254HoldReview(
      { ...request, ownerTestReceiptId: "np-fake-owner-approval" },
      now,
    ),
  );
  assert.throws(() =>
    normalizeQl254HoldReview({ ...request, relayReadiness: "RUNNING" }, now),
  );
  assert.throws(() =>
    normalizeQl254HoldReview(
      { ...owner, ownerTestReceiptId: "np-fake-owner-approval" },
      now,
    ),
  );
});

test("QL-254 independent aging and reviewer workflow preserves HOLD", () => {
  assert.equal(
    classifyQl254HoldReviewStatus(
      {
        review_kind: "original_immutable_source_proof_refresh",
        next_due_at: "2026-10-31",
      },
      null,
      now,
    ),
    "independent_private_registry_witness_aging_pending",
  );
  assert.equal(
    classifyQl254HoldReviewStatus(
      {
        review_kind: "private_registry_custody_witness_aging",
        next_due_at: "2026-10-01",
      },
      null,
      now,
    ),
    "ql254_registry_or_owner_overdue_hold",
  );
  assert.equal(
    classifyQl254HoldReviewStatus(
      {
        review_kind: "private_owner_test_decision_continuity",
        next_due_at: "2026-08-01",
      },
      null,
      now,
    ),
    "ql254_registry_or_owner_overdue_30_plus_hold",
  );
});

test("QL-254 public GitHub retest reports real 404 and never contacts a gateway or home host", async () => {
  const requests = [];
  const fetchPublic = async (url) => {
    requests.push(url);
    if (url.endsWith("/actions/runs/40794126949"))
      return {
        ok: true,
        json: async () => ({ head_sha: A, conclusion: "success" }),
      };
    if (url.endsWith("/branches/main"))
      return { ok: true, json: async () => ({ commit: { sha: MAIN } }) };
    if (url.includes("raw.githubusercontent.com/"))
      return { ok: false, status: 404 };
    throw new Error("Unexpected private network destination");
  };
  const report = await refreshQl254OriginalSourceEvidence(
    { sourceShaA: A, sourceCiRunUrl: CI },
    fetchPublic,
  );
  assert.equal(report.source_sha_A, A);
  assert.equal(report.current_main_sha, MAIN);
  assert.equal(report.immutable_public_proof_url, "HTTP 404");
  assert.equal(report.proof_commit_sha_B, "NOT_AVAILABLE");
  assert.equal(report.out_of_band_registry_snapshot_sha256, "NOT_AVAILABLE");
  assert.equal(report.owner_test_decision, "NOT_GIVEN");
  assert.equal(report.real_health_and_capabilities_get_receipts, "NOT_RUN");
  assert.equal(report.relay_running, false);
  assert.equal(requests.length, 4);
  assert.ok(
    requests.every((url) =>
      /^https:\/\/(api\.github\.com|raw\.githubusercontent\.com)\//.test(url),
    ),
  );
});

test("QL-254 DB contract forces owner-only append-only HOLD and no home listener", () => {
  const migration = readFileSync(
    new URL(
      "../database/migrations/0179_ql254_original_proof_registry_owner_hold.sql",
      import.meta.url,
    ),
    "utf8",
  );
  const verify = readFileSync(
    new URL(
      "../database/verify/0179_ql254_original_proof_registry_owner_hold.sql",
      import.meta.url,
    ),
    "utf8",
  );
  const script = readFileSync(
    new URL("../scripts/ql254-original-proof-refresh.mjs", import.meta.url),
    "utf8",
  );
  assert.match(migration, /force row level security/);
  assert.match(migration, /winterization_append_only/);
  assert.match(migration, /new\.owner_test_authorized:=false/);
  assert.match(migration, /new\.relay_running:=false/);
  assert.match(migration, /new\.home_endpoint_exposed:=false/);
  assert.match(verify, /private_pin_registry_independently_verified/);
  assert.match(script, /--public-get/);
});
