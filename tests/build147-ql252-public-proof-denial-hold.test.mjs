import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { generateKeyPairSync, sign } from "node:crypto";
import {
  ql247DenialKinds,
  normalizeQl252SourceAuditHoldReview,
  classifyQl252SourceAuditHoldStatus,
} from "../lib/permanent-unit-owner-retention/recurrence-core.mjs";
import {
  QL246_FIELDS,
  QL246_NEGATIVE_TESTS,
  canonicalQl246Payload,
} from "../lib/integration-v1/ql246-source-proof.mjs";
import { inspectQl252PublicPublication } from "../lib/integration-v1/ql252-public-proof-audit.mjs";

const now = new Date("2026-10-28T12:00:00Z");
const A = "5f7caaef37a2f8ec8ba2eb2913564e1a3b3c62c9";
const B = "b".repeat(40);
const ciUrl =
  "https://github.com/RosevearCreations/iCamp/actions/runs/40794126949";
const base = {
  id: "a1111111-1111-4111-8111-111111111111",
  ql248SourceReviewId: "b2222222-2222-4222-8222-222222222222",
  sourceCampgroundId: "a1111111-1111-4111-8111-111111111111",
  targetCampgroundId: "b2222222-2222-4222-8222-222222222222",
  sourceSystem: "icamp",
  repository: "RosevearCreations/iCamp",
  reviewKind: "public_source_proof_continuity_audit",
  outcomeKind: "public_ql246_proof_404_reported",
  sourceRevisionSha: A,
  sourceCiRunUrl: ciUrl,
  nextDueAt: "2026-11-10",
  evidenceReference: "np-public-source-404-observation",
  reviewNote:
    "Public QL-246 signed proof remains absent at immutable iCamp main.",
};

test("Build 147 honest 404 permits only A/CI and rejects an invented B or signer pin", () => {
  const r = normalizeQl252SourceAuditHoldReview(base, now);
  assert.equal(r.sourceRevisionSha, A);
  assert.equal(r.proofCommitSha, null);
  for (const variant of [
    { proofCommitSha: B },
    { proofSha256: "c".repeat(64) },
    { publicSpkiSha256: "d".repeat(64) },
    { sourceCiRunUrl: "" },
    { sourceSystem: "yw" },
    {
      reviewKind: "seven_denial_exception_aging_renewal",
      outcomeKind: "seven_original_denials_missing",
    },
  ])
    assert.throws(() =>
      normalizeQl252SourceAuditHoldReview({ ...base, ...variant }, now),
    );
});

test("Distinct A/B candidate and public key fingerprint are documentary, not trusted origin", () => {
  const candidate = {
    ...base,
    outcomeKind: "public_proof_candidate_unverified",
    proofCommitSha: B,
    proofSha256: "c".repeat(64),
    publicSpkiSha256: "d".repeat(64),
    sourceAuditReference: "np-public-proof-source-audit",
  };
  assert.equal(
    normalizeQl252SourceAuditHoldReview(candidate, now).proofCommitSha,
    B,
  );
  assert.throws(
    () =>
      normalizeQl252SourceAuditHoldReview(
        { ...candidate, proofCommitSha: A },
        now,
      ),
    /distinct/,
  );
  assert.throws(
    () =>
      normalizeQl252SourceAuditHoldReview(
        { ...candidate, sourceAuditReference: "" },
        now,
      ),
    /real public candidate/,
  );
  assert.throws(
    () =>
      normalizeQl252SourceAuditHoldReview(
        {
          ...candidate,
          sourceCiRunUrl:
            "https://github.com/RosevearCreations/yw/actions/runs/40794126949",
        },
        now,
      ),
    /source A and exact-repository/i,
  );
});

test("Seven original denial exceptions age without treating indexes as witnessed", () => {
  const denials = ql247DenialKinds.map(
    (kind, i) => `${kind}|np-original-audit-${i}`,
  );
  const renewal = {
    ...base,
    priorReviewId: base.id,
    reviewKind: "seven_denial_exception_aging_renewal",
    outcomeKind: "seven_original_denials_missing",
    sourceRevisionSha: "",
    sourceCiRunUrl: "",
  };
  assert.deepEqual(
    normalizeQl252SourceAuditHoldReview(renewal, now).denialReceiptIds,
    [],
  );
  assert.throws(
    () =>
      normalizeQl252SourceAuditHoldReview(
        { ...renewal, denialReceiptIds: denials },
        now,
      ),
    /Missing original denials/,
  );
  const candidate = {
    ...renewal,
    outcomeKind: "original_denial_indexes_unverified",
    denialReceiptIds: denials,
    denialWitnessReference: "np-separate-original-witness-index",
  };
  assert.equal(
    normalizeQl252SourceAuditHoldReview(candidate, now).denialReceiptIds.length,
    7,
  );
  assert.throws(
    () =>
      normalizeQl252SourceAuditHoldReview(
        { ...candidate, denialReceiptIds: denials.slice(1) },
        now,
      ),
    /All seven/,
  );
  assert.throws(
    () =>
      normalizeQl252SourceAuditHoldReview(
        {
          ...candidate,
          denialReceiptIds: [
            ...denials.slice(0, 6),
            "dispatch_denied|np-original-audit-0",
          ],
        },
        now,
      ),
    /unique/,
  );
});

test("Private owner TEST claim never grants a gateway and owner NOT GIVEN cannot have receipt", () => {
  const hold = {
    ...base,
    priorReviewId: base.id,
    reviewKind: "independent_owner_test_authorization_hold_review",
    outcomeKind: "owner_test_not_given_hold",
    sourceRevisionSha: "",
    sourceCiRunUrl: "",
  };
  assert.equal(
    normalizeQl252SourceAuditHoldReview(hold, now).ownerTestReceiptId,
    null,
  );
  assert.throws(
    () =>
      normalizeQl252SourceAuditHoldReview(
        { ...hold, ownerTestReceiptId: "np-unverified-owner-claim" },
        now,
      ),
    /NOT GIVEN/,
  );
  assert.throws(
    () =>
      normalizeQl252SourceAuditHoldReview(
        { ...hold, outcomeKind: "owner_approval_claim_unverified_hold" },
        now,
      ),
    /requires its genuine/,
  );
  assert.equal(
    normalizeQl252SourceAuditHoldReview(
      {
        ...hold,
        outcomeKind: "owner_approval_claim_unverified_hold",
        ownerTestReceiptId: "np-unverified-owner-claim",
      },
      now,
    ).ownerTestReceiptId,
    "np-unverified-owner-claim",
  );
  assert.throws(
    () =>
      normalizeQl252SourceAuditHoldReview(
        { ...hold, nextDueAt: "2027-05-01" },
        now,
      ),
    /within 90 days/,
  );
});

test("QL-252 renewal statuses preserve alternating independent review order", () => {
  assert.equal(
    classifyQl252SourceAuditHoldStatus(
      {
        review_kind: "public_source_proof_continuity_audit",
        next_due_at: "2026-11-10",
      },
      null,
      now,
    ),
    "seven_denial_exception_aging_renewal_pending",
  );
  assert.equal(
    classifyQl252SourceAuditHoldStatus(
      {
        review_kind: "seven_denial_exception_aging_renewal",
        next_due_at: "2026-11-10",
      },
      null,
      now,
    ),
    "independent_owner_test_hold_review_pending",
  );
  assert.equal(
    classifyQl252SourceAuditHoldStatus(
      {
        review_kind: "independent_owner_test_authorization_hold_review",
        next_due_at: "2026-11-10",
      },
      null,
      now,
    ),
    "public_proof_origin_recheck_pending",
  );
  assert.equal(
    classifyQl252SourceAuditHoldStatus(
      { next_due_at: "2026-09-01" },
      null,
      now,
    ),
    "ql252_source_gap_overdue_30_plus",
  );
});

function mockPublicResponses({
  proofBytes,
  proofStatus = 404,
  ciSha = A,
  ancestry = "ahead",
} = {}) {
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push(url);
    assert.equal(options.method, "GET");
    assert.equal(options.redirect, "error");
    assert.ok(
      url.startsWith("https://api.github.com/repos/RosevearCreations/iCamp/") ||
        url.startsWith(
          "https://raw.githubusercontent.com/RosevearCreations/iCamp/",
        ),
    );
    if (url.includes("/actions/runs/"))
      return {
        ok: true,
        status: 200,
        json: async () => ({ head_sha: ciSha, conclusion: "success" }),
      };
    if (url.includes("/compare/"))
      return {
        ok: true,
        status: 200,
        json: async () => ({
          status: ancestry,
          merge_base_commit: { sha: A },
          ahead_by: 1,
        }),
      };
    if (proofStatus === 404) return { status: 404 };
    return { ok: true, status: 200, arrayBuffer: async () => proofBytes };
  };
  return { calls, fetcher };
}

test("Public-only GitHub audit reports genuine immutable 404; no invented B", async () => {
  const mock = mockPublicResponses();
  const result = await inspectQl252PublicPublication(
    { sourceShaA: A, sourceCiRunUrl: ciUrl },
    mock.fetcher,
  );
  assert.equal(result.status, "PUBLIC_PROOF_404");
  assert.equal(result.observed_public_http_status, 404);
  assert.equal(result.proof_commit_sha_B, "NOT_AVAILABLE");
  assert.equal(result.source_ci_independently_matched, true);
  assert.equal(result.actual_gateway_test, "NOT_RUN");
  assert.equal(result.connection_state, "DISCONNECTED");
  assert.equal(mock.calls.length, 2);
});

test("Source CI head mismatch and invalid public proof fail closed without gateway traffic", async () => {
  const mismatch = mockPublicResponses({ ciSha: "a".repeat(40) });
  const wrongCi = await inspectQl252PublicPublication(
    { sourceShaA: A, sourceCiRunUrl: ciUrl, proofCommitShaB: B },
    mismatch.fetcher,
  );
  assert.equal(wrongCi.status, "SOURCE_CI_UNVERIFIED");
  assert.equal(wrongCi.cryptographic_signature_valid, false);
  assert.equal(mismatch.calls.length, 1);

  const invalid = mockPublicResponses({
    proofStatus: 200,
    proofBytes: Buffer.from('{"untrusted":true}'),
  });
  const bad = await inspectQl252PublicPublication(
    { sourceShaA: A, sourceCiRunUrl: ciUrl, proofCommitShaB: B },
    invalid.fetcher,
  );
  assert.equal(bad.status, "PUBLIC_PROOF_INVALID_OR_UNVERIFIED");
  assert.equal(bad.actual_gateway_test, "NOT_RUN");
  assert.equal(bad.owner_test_decision, "NOT_GIVEN");
  assert.equal(invalid.calls.length, 2);
});

test("Synthetic Ed25519 cryptographic check never claims independent custody or owner approval", async () => {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const values = Object.fromEntries(QL246_FIELDS.map((field) => [field, null]));
  Object.assign(values, {
    schema_version: "rosevear.integration.v1",
    source_system: "icamp",
    repository: "RosevearCreations/iCamp",
    source_revision: A,
    challenge_id: "np-synthetic-only-private-challenge",
    challenge_sha256: "a".repeat(64),
    business_id: "icamp",
    tenant_id: "np-synthetic-nonproduction-test",
    environment: "nonproduction",
    ci_run_url: ciUrl,
    allowed_methods: ["GET"],
    allowed_paths: [
      "/api/integration/v1/health",
      "/api/integration/v1/capabilities",
    ],
    negative_tests: Object.fromEntries(
      QL246_NEGATIVE_TESTS.map((kind) => [kind, false]),
    ),
    owner_authorization: "NOT_GIVEN",
    connection_state: "DISCONNECTED",
    external_gateway_get_verified: false,
    durable_audit_verified: false,
    owner_identity_verified: false,
    issued_at: Date.now(),
    expires_at: Date.now() + 60000,
  });
  const bytes = Buffer.from(
    JSON.stringify({
      publicKeyPem: publicKey.export({ format: "pem", type: "spki" }),
      payload: values,
      signature: sign(null, canonicalQl246Payload(values), privateKey).toString(
        "base64url",
      ),
    }),
  );
  const mock = mockPublicResponses({ proofBytes: bytes, proofStatus: 200 });
  const result = await inspectQl252PublicPublication(
    { sourceShaA: A, sourceCiRunUrl: ciUrl, proofCommitShaB: B },
    mock.fetcher,
  );
  assert.equal(result.status, "PUBLIC_CRYPTO_VALID_CUSTODY_UNVERIFIED_HOLD");
  assert.equal(result.cryptographic_signature_valid, true);
  assert.equal(result.signer_trusted_out_of_band, false);
  assert.equal(result.seven_denials_independently_witnessed, false);
  assert.equal(result.owner_test_decision, "NOT_GIVEN");
  assert.equal(result.actual_gateway_test, "NOT_RUN");
  assert.equal(mock.calls.length, 3);
});

test("Build 147 DB, UI and public proof paths never silently authorize external GETs", () => {
  const read = (relative) =>
    readFileSync(new URL(relative, import.meta.url), "utf8");
  const sql = read(
    "../database/migrations/0177_ql252_public_proof_denial_hold_audit.sql",
  );
  for (const invariant of [
    "force row level security",
    "ql252_147_proof_denial_hold_immutable",
    "base.reviewed_by_user_id=new.reviewed_by_user_id",
    "predecessor.reviewed_by_user_id=new.reviewed_by_user_id",
    "new.owner_test_authorized:=false",
    "new.owner_pilot_authorized:=false",
    "new.dispatch_enabled:=false",
    "new.actual_gateway_test:='NOT_RUN'",
    "new.connection_state:='DISCONNECTED'",
    "new.gate_state:='HOLD'",
  ])
    assert.ok(sql.includes(invariant), `missing SQL invariant: ${invariant}`);
  const page = read(
    "../app/workspaces/management/campgrounds/permanent-units/financing/owner-portfolio/planning/outcomes/review/evidence/retention/exceptions/oversight/reviews/aging/outcomes/reopen/plans/oversight/decisions/page.tsx",
  );
  assert.ok(page.includes("ql252SourceAuditQueue"));
  assert.ok(page.includes("recordQl252SourceAuditHoldReviewAction"));
  const script = read("../scripts/ql252-public-proof-audit.mjs");
  assert.ok(script.includes("--public-get"));
  assert.ok(script.includes("NOT_RUN"));
});
