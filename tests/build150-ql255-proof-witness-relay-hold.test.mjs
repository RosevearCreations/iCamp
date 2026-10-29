import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  ql255Sources,
  recheckQl255SixAppPublicOrigins,
} from "../lib/integration-v1/ql255-six-app-public-recheck.mjs";
import {
  normalizeQl255HoldReview,
  classifyQl255ReviewStatus,
  simulateQl255RelayRollback,
} from "../lib/permanent-unit-owner-retention/ql255-core.mjs";

const now = new Date("2026-10-29T12:00:00.000Z");
const base = {
  id: "a1111111-1111-4111-8111-111111111111",
  ql254ReviewId: "b2222222-2222-4222-8222-222222222222",
  sourceCampgroundId: "c3333333-3333-4333-8333-333333333333",
  targetCampgroundId: "d4444444-4444-4444-8444-444444444444",
  sourceSystem: "icamp",
  repository: "RosevearCreations/iCamp",
  reviewKind: "six_app_original_proof_disposition",
  outcomeKind: "immutable_original_proof_404_hold",
  observedMainSha: "19db62c90a12bf48da74e4e063fb16c3b6f6c1ce",
  sourceShaA: "5f7caaef37a2f8ec8ba2eb2913564e1a3b3c62c9",
  sourceCiRunUrl:
    "https://github.com/RosevearCreations/iCamp/actions/runs/40794126949",
  proofHttpStatus: "404",
  nextDueAt: "2026-11-02",
  evidenceReference: "np-original-public-ql255-404",
  reviewNote:
    "Original signed proof remained absent on immutable main; owner TEST not given.",
};
const witness = {
  ...base,
  priorReviewId: base.id,
  reviewKind: "private_witness_custody_exception_escalation",
  outcomeKind: "original_witness_missing_hold",
  observedMainSha: "",
  sourceShaA: "",
  sourceCiRunUrl: "",
  proofHttpStatus: "NOT_CHECKED",
};
const relay = {
  ...witness,
  reviewKind: "reversible_private_relay_test_readiness",
  outcomeKind: "private_relay_not_configured_hold",
};

test("QL-255 public-only six-source 404 refresh checks precisely allowlisted immutable GitHub endpoints", async () => {
  const requested = [];
  const lookup = new Map(ql255Sources.map(([, repo, sha]) => [repo, sha]));
  const fake = async (url, options) => {
    requested.push(url);
    assert.equal(options.method, "GET");
    if (url.endsWith("/branches/main")) {
      const repo = url.split("/").at(-3);
      return {
        ok: true,
        json: async () => ({ commit: { sha: lookup.get(repo) } }),
      };
    }
    if (url.includes("raw.githubusercontent.com"))
      return { ok: false, status: 404 };
    throw new Error("Unexpected origin");
  };
  const report = await recheckQl255SixAppPublicOrigins(fake);
  assert.equal(report.observed_404_count, 6);
  assert.equal(report.observed_unavailable_count, 0);
  assert.equal(report.actual_gateway_test, "NOT_RUN");
  assert.equal(report.connection_state, "DISCONNECTED");
  assert.equal(report.gate_state, "HOLD");
  assert.equal(requested.length, 12);
  for (const url of requested) {
    assert.match(
      url,
      /^https:\/\/(?:api\.github\.com\/repos|raw\.githubusercontent\.com)\/RosevearCreations\//,
    );
    assert.ok(
      !/health|capabilities|tailscale|gateway|127\.0\.0\.1|192\.168\./.test(
        url,
      ),
    );
  }
  for (const result of report.applications) {
    assert.equal(result.source_drift, "UNCHANGED");
    assert.equal(result.proof_http_status, "404");
    assert.equal(result.exact_raw_proof_sha256, "NOT_AVAILABLE");
    assert.equal(result.private_signer_custody_verified, false);
  }
});

test("A public 200 JSON remains UNTRUSTED; exact raw bytes digest is measured, not invented", async () => {
  const payload = Buffer.from(
    '{"source_sha_A":"genuine-original-not-verified"}\n',
  );
  const response = await recheckQl255SixAppPublicOrigins(async (url) => {
    if (url.endsWith("/branches/main"))
      return {
        ok: true,
        json: async () => ({ commit: { sha: "a".repeat(40) } }),
      };
    return { ok: true, status: 200, arrayBuffer: async () => payload };
  });
  assert.equal(response.applications[0].proof_http_status, "200");
  assert.equal(
    response.applications[0].exact_raw_proof_sha256,
    createHash("sha256").update(payload).digest("hex"),
  );
  assert.equal(
    response.applications[0].source_proof_disposition,
    "PUBLIC_JSON_CANDIDATE_UNTRUSTED_HOLD",
  );
  assert.equal(
    response.applications[0].source_drift,
    "MAIN_ADVANCED_RECHECK_REQUIRED",
  );
  assert.equal(response.every_application_proven_connected, false);
});

test("Public network failure reports UNAVAILABLE, never manufactures a 404", async () => {
  const response = await recheckQl255SixAppPublicOrigins(async () => {
    throw new Error("DNS offline");
  });
  assert.equal(response.observed_404_count, 0);
  assert.equal(response.observed_unavailable_count, 6);
  assert.ok(
    response.applications.every((s) => s.proof_http_status === "NOT_AVAILABLE"),
  );
});

test("QL-255 original source proof 404 requires real SHA, exact CI and no B/digest", () => {
  assert.equal(normalizeQl255HoldReview(base, now).proofCommitShaB, null);
  for (const variant of [
    { observedMainSha: "a".repeat(39) },
    { proofHttpStatus: "200" },
    { proofCommitShaB: "b".repeat(40) },
    { proofSha256: "c".repeat(64) },
    { repository: "RosevearCreations/yw" },
    {
      sourceCiRunUrl: "https://github.com/RosevearCreations/yw/actions/runs/99",
    },
    { targetCampgroundId: base.sourceCampgroundId },
  ])
    assert.throws(() => normalizeQl255HoldReview({ ...base, ...variant }, now));
});

test("QL-255 public 200 candidate must carry genuine distinct A/B and source audit index", () => {
  const variant = {
    ...base,
    outcomeKind: "public_json_candidate_untrusted_hold",
    proofHttpStatus: "200",
    proofCommitShaB: "b".repeat(40),
    proofSha256: "d".repeat(64),
    publicAuditReference: "np-original-public-source-index",
  };
  assert.equal(
    normalizeQl255HoldReview(variant, now).proofCommitShaB,
    "b".repeat(40),
  );
  assert.throws(() =>
    normalizeQl255HoldReview(
      { ...variant, proofCommitShaB: variant.sourceShaA },
      now,
    ),
  );
  assert.throws(() =>
    normalizeQl255HoldReview({ ...variant, publicAuditReference: "" }, now),
  );
});

test("QL-255 independent witness requires three distinct original indexes, different key pins and five-minute nonce", () => {
  assert.equal(normalizeQl255HoldReview(witness, now).witnessReceiptId, null);
  const claim = {
    ...witness,
    outcomeKind: "witness_receipts_claimed_unverified_hold",
    registrySnapshotSha256: "a".repeat(64),
    signerPinSha256: "b".repeat(64),
    witnessPinSha256: "c".repeat(64),
    registryReceiptId: "np-real-registry-index",
    custodianReceiptId: "np-real-custodian-index",
    witnessReceiptId: "np-real-independent-witness-index",
    nonceChallengeSha256: "d".repeat(64),
    nonceIssuedAt: "2026-10-29T11:55:00.000Z",
    nonceExpiresAt: "2026-10-29T12:00:00.000Z",
  };
  assert.equal(
    normalizeQl255HoldReview(claim, now).witnessPinSha256,
    "c".repeat(64),
  );
  for (const variant of [
    { signerPinSha256: claim.witnessPinSha256 },
    { witnessReceiptId: claim.custodianReceiptId },
    { nonceExpiresAt: "2026-10-29T12:00:01.000Z" },
    { nonceIssuedAt: "2026-10-29T13:00:00.000Z" },
    { nonceChallengeSha256: "raw challenge leaked" },
  ])
    assert.throws(() =>
      normalizeQl255HoldReview({ ...claim, ...variant }, now),
    );
  assert.throws(() =>
    normalizeQl255HoldReview(
      { ...witness, witnessPinSha256: "a".repeat(64) },
      now,
    ),
  );
});

test("QL-255 private owner TEST window stays a request and home relay planning cannot start a service", () => {
  assert.equal(
    normalizeQl255HoldReview(relay, now).relayPlanKind,
    "NOT_CONFIGURED",
  );
  const planned = {
    ...relay,
    outcomeKind: "synthetic_rollback_plan_only_hold",
    relayPlanKind: "SYNTHETIC_ROLLBACK_REHEARSED",
    relayPlanReference: "np-synthetic-rollback-plan",
    healthIntervalSeconds: "30",
  };
  assert.equal(
    normalizeQl255HoldReview(planned, now).healthIntervalSeconds,
    30,
  );
  const requested = {
    ...planned,
    outcomeKind: "private_owner_review_requested_hold",
    testTenantId: "np-camp-rosevear-nonproduction",
    testWindowStart: "2026-10-30T12:00:00.000Z",
    testWindowEnd: "2026-10-30T12:30:00.000Z",
  };
  assert.equal(
    normalizeQl255HoldReview(requested, now).testTenantId,
    requested.testTenantId,
  );
  for (const variant of [
    { testWindowEnd: "2026-10-30T12:30:01.000Z" },
    { testTenantId: "" },
    { relayPlanKind: "RUNNING" },
    { healthIntervalSeconds: "301" },
  ])
    assert.throws(() =>
      normalizeQl255HoldReview({ ...requested, ...variant }, now),
    );
  assert.throws(() =>
    normalizeQl255HoldReview({ ...relay, testTenantId: "np-fake-test" }, now),
  );
});

test("Pure in-memory kill switch must stop and roll back; no real relay or GET ever runs", () => {
  const rehearsal = simulateQl255RelayRollback([
    "PLAN",
    "SIMULATE_START",
    "KILL_SWITCH",
    "ROLLBACK",
  ]);
  assert.equal(rehearsal.simulation_phase, "NOT_CONFIGURED");
  assert.equal(rehearsal.real_relay_running, false);
  assert.equal(rehearsal.owner_test_authorized, false);
  assert.equal(rehearsal.actual_gateway_gets, "NOT_RUN");
  assert.throws(() => simulateQl255RelayRollback(["SIMULATE_START"]));
  assert.throws(() =>
    simulateQl255RelayRollback(["PLAN", "SIMULATE_START", "ROLLBACK"]),
  );
});

test("QL-255 reviewer aging and migration contract preserve owner-only immutable HOLD", () => {
  assert.equal(
    classifyQl255ReviewStatus(
      {
        review_kind: "six_app_original_proof_disposition",
        next_due_at: "2026-10-20",
      },
      null,
      now,
    ),
    "ql255_overdue_hold",
  );
  assert.equal(
    classifyQl255ReviewStatus(
      {
        review_kind: "reversible_private_relay_test_readiness",
        next_due_at: "2026-09-01",
      },
      null,
      now,
    ),
    "ql255_overdue_30_plus_hold",
  );
  const sql = readFileSync(
    new URL(
      "../database/migrations/0180_ql255_six_app_proof_witness_relay_hold.sql",
      import.meta.url,
    ),
    "utf8",
  );
  const verify = readFileSync(
    new URL(
      "../database/verify/0180_ql255_six_app_proof_witness_relay_hold.sql",
      import.meta.url,
    ),
    "utf8",
  );
  for (const marker of [
    "force row level security",
    "security invoker",
    "winterization_append_only",
    "relay_installed=false",
    "owner_test_authorized=false",
    "connection_state='DISCONNECTED'",
    "gate_state='HOLD'",
    "interval '5 minutes'",
    "interval '30 minutes'",
  ])
    assert.ok(sql.includes(marker), marker);
  assert.ok(verify.includes("relay_installed or relay_running"));
  const binding = readFileSync(new URL("../database/migrations/0181_ql255_private_witness_source_binding.sql", import.meta.url), "utf8");
  assert.ok(binding.includes("proof_commit_sha_b is null"));
  assert.ok(binding.includes("nonce_issued_at<checked_at-interval '5 minutes'"));
  const page = readFileSync(
    new URL(
      "../app/workspaces/management/campgrounds/permanent-units/financing/owner-portfolio/planning/outcomes/review/evidence/retention/exceptions/oversight/reviews/aging/outcomes/reopen/plans/oversight/decisions/page.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.ok(
    page.includes("recordQl255SixAppProofWitnessRelayHoldReviewAction"),
  );
});
