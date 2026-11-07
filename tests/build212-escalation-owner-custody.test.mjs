import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  analyzeBuild212,
  buildRunnerEscalationReceipts,
  reviewLongTermEvidenceCustody,
} from "../scripts/build212-escalation-custody.mjs";
import {
  canonicalJson,
  evidenceFingerprint,
  prepareOwnerRequest,
  publicKeyFingerprint,
  signOwnerRequest,
  slaAcceptable,
  validateOwnerRequest,
  verifyOwnerReceipt,
} from "../scripts/build212-owner-sla-receipt.mjs";
import { analyzeBuild210 } from "../scripts/build210-queue-history-triage.mjs";
import {
  analyzeHistory,
  formatSummary,
} from "../scripts/build205-ci-runtime-diagnostics.mjs";
import { analyzeBuild211 } from "../scripts/build211-runner-artifact-sla.mjs";
import { readBuild206Inputs } from "../scripts/verify-build206-cache-contract.mjs";
import { verifyBuild212CIContract } from "../scripts/verify-build212-ci-contract.mjs";

const archived = JSON.parse(
  readFileSync(
    resolve(
      import.meta.dirname,
      "../fixtures/build210-reviewed-chromium-history.json",
    ),
    "utf8",
  ),
);
const clock = Date.parse("2026-11-07T02:00:00.000Z");
const baseStages = {
  PR: {
    state: "REVIEWABLE_MONITORING_SAMPLES",
    completeFiveGateCohorts: 3,
    p90Seconds: 180,
    monitoringBudgetSeconds: 900,
  },
  MAIN: {
    state: "REVIEWABLE_MONITORING_SAMPLES",
    completeFiveGateCohorts: 3,
    p90Seconds: 200,
    monitoringBudgetSeconds: 900,
  },
};
const readyEvidence = () => ({
  context: { commit: "a".repeat(40) },
  build210: { latencyExceptions: { exceptionCount: 0 } },
  build211: {
    schema: "icamp.build211.runner-artifact-sla.v1",
    ownerSla: {
      schema: "icamp.build211.owner-sla-acceptance.v1",
      state: "READY_FOR_OWNER_REVIEW_NOT_APPROVED",
      stages: structuredClone(baseStages),
    },
  },
});

test("Build 212 creates source-linked queue escalation drafts without asserting runner pool saturation or filing cases", () => {
  const result = buildRunnerEscalationReceipts({
    runnerContention: {
      delayedRequiredJobs: [
        {
          runId: 123,
          jobId: 456,
          check: "CI / Verify",
          queueSeconds: 650,
          assignmentWitness: {
            runId: 123,
            jobId: 456,
            runnerName: "GitHub Actions 8",
            runnerGroup: "Hosted",
          },
        },
      ],
    },
  });
  assert.equal(result.draftCount, 1);
  assert.equal(
    result.receipts[0].githubRunUrl,
    "https://github.com/RosevearCreations/iCamp/actions/runs/123",
  );
  assert.equal(result.receipts[0].providerTicket, null);
  assert.equal(result.providerCasesFiled, 0);
  assert.equal(result.runnerPoolSaturationProven, false);
  assert.throws(
    () =>
      buildRunnerEscalationReceipts({
        runnerContention: {
          delayedRequiredJobs: [
            {
              runId: 1,
              jobId: 2,
              check: "CI / Verify",
              queueSeconds: 650,
              assignmentWitness: { runId: 88, jobId: 2 },
            },
          ],
        },
      }),
    /CONFLICT/,
  );
  const none = buildRunnerEscalationReceipts({
    runnerContention: { delayedRequiredJobs: [] },
  });
  assert.equal(none.draftCount, 0);
  assert.equal(none.state, "NO_QUEUE_CAPACITY_ESCALATION_TRIGGER_IN_WINDOW");
});

test("Build 212 distinguishes fresh GitHub artifacts from independently attested long-term originals", () => {
  const result = reviewLongTermEvidenceCustody({
    artifactReview: {
      reviewedCount: 2,
      sources: [
        {
          artifactId: 10,
          status: "ORIGINAL_ARTIFACT_AVAILABLE",
          pinnedOriginalDigest: `sha256:${"b".repeat(64)}`,
        },
        { artifactId: 11, status: "EXPIRING_RENEWAL_REVIEW_REQUIRED" },
      ],
    },
    recentEvidenceArtifact: {
      id: 22,
      headSha: "a".repeat(40),
      expiresAt: "2026-11-20T00:00:00Z",
    },
  });
  assert.equal(result.verifiedLongTermImmutableCopies, 0);
  assert.equal(result.originalSources[0].independentlyRetainedCopy, false);
  assert.equal(
    result.latestFreshActionsArtifact.provenance,
    "NEW_GITHUB_ACTIONS_ARTIFACT",
  );
  assert.equal(result.proposedRetentionPolicyApproved, false);
  assert.throws(() =>
    reviewLongTermEvidenceCustody({
      artifactReview: { reviewedCount: 1, sources: [] },
    }),
  );
});

test("Build 212 produces stable canonical owner evidence digests and denies premature SLA acceptance", () => {
  const evidence = readyEvidence();
  assert.equal(canonicalJson({ b: 2, a: 1 }), canonicalJson({ a: 1, b: 2 }));
  assert.equal(
    evidenceFingerprint(evidence),
    evidenceFingerprint(structuredClone(evidence)),
  );
  const insufficient = readyEvidence();
  insufficient.build211.ownerSla.stages.MAIN.completeFiveGateCohorts = 1;
  assert.equal(slaAcceptable(insufficient), false);
  assert.throws(
    () =>
      prepareOwnerRequest(insufficient, {
        decision: "ACCEPT_MONITORING_SLA",
        keyId: "ree-owner",
        now: clock,
      }),
    /INSUFFICIENT/,
  );
  const defer = prepareOwnerRequest(insufficient, {
    decision: "DEFER_MONITORING_SLA",
    keyId: "ree-owner",
    now: clock,
  });
  assert.equal(validateOwnerRequest(defer, insufficient, clock), defer);
  assert.equal(defer.authorizesCommsTest, false);
  assert.equal(defer.replacesReleaseSecurityChecks, false);
});

test("Build 212 independently pinned Ed25519 owner signatures are bound to exact evidence and reject tampering/replay", () => {
  const evidence = readyEvidence();
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const privatePem = privateKey.export({ type: "pkcs8", format: "pem" });
  const publicPem = publicKey.export({ type: "spki", format: "pem" });
  const pin = publicKeyFingerprint(publicPem);
  const request = prepareOwnerRequest(evidence, {
    decision: "ACCEPT_MONITORING_SLA",
    keyId: "ree-owner",
    now: clock,
    ownerReviewNotes: "Reviewed exact CI sample evidence.",
  });
  const receipt = signOwnerRequest(request, evidence, privatePem, {
    now: clock + 1000,
  });
  const pins = {
    schema: "icamp.build212.sla-owner-pins.v1",
    signers: [
      {
        keyId: "ree-owner",
        role: "ICAMP_SLA_OWNER",
        enabled: true,
        publicKeyPem: publicPem,
        fingerprint: pin,
      },
    ],
  };
  const nonces = new Set();
  const verified = verifyOwnerReceipt(receipt, evidence, pins, {
    now: clock + 2000,
    consumedNonces: nonces,
  });
  assert.equal(verified.acceptedByOwner, true);
  assert.equal(verified.productionApprovalGranted, false);
  assert.equal(verified.commsTestHandshakeAuthorized, false);
  assert.throws(
    () =>
      verifyOwnerReceipt(receipt, evidence, pins, {
        now: clock + 2000,
        consumedNonces: nonces,
      }),
    /REPLAYED/,
  );
  assert.throws(
    () =>
      verifyOwnerReceipt(
        {
          ...receipt,
          request: { ...receipt.request, ownerReviewNotes: "Changed" },
        },
        evidence,
        pins,
        { now: clock + 2000 },
      ),
    /INVALID_OWNER_SIGNATURE/,
  );
  assert.throws(
    () =>
      verifyOwnerReceipt(
        receipt,
        { ...evidence, context: { commit: "c".repeat(40) } },
        pins,
        { now: clock + 2000 },
      ),
    /MISMATCH/,
  );
  assert.throws(
    () =>
      verifyOwnerReceipt(
        receipt,
        evidence,
        { ...pins, signers: [{ ...pins.signers[0], enabled: false }] },
        { now: clock + 2000 },
      ),
    /NOT_TRUSTED/,
  );
  assert.throws(
    () =>
      verifyOwnerReceipt(receipt, evidence, pins, {
        now: clock + 8 * 86_400_000,
      }),
    /MISMATCH/,
  );
});

test("Build 212 signable defer decisions cannot be mistaken for accepted monitoring SLA", () => {
  const evidence = readyEvidence();
  evidence.build211.ownerSla.state = "UNDER_REVIEW_OWNER_DECISION_REQUIRED";
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const pem = privateKey.export({ type: "pkcs8", format: "pem" });
  const publicPem = publicKey.export({ type: "spki", format: "pem" });
  const request = prepareOwnerRequest(evidence, {
    decision: "DEFER_MONITORING_SLA",
    keyId: "jack-owner",
    now: clock,
  });
  const signed = signOwnerRequest(request, evidence, pem, {
    now: clock + 1000,
  });
  const verified = verifyOwnerReceipt(
    signed,
    evidence,
    {
      schema: "icamp.build212.sla-owner-pins.v1",
      signers: [
        {
          keyId: "jack-owner",
          role: "ICAMP_SLA_OWNER",
          enabled: true,
          publicKeyPem: publicPem,
          fingerprint: publicKeyFingerprint(publicPem),
        },
      ],
    },
    { now: clock + 1000 },
  );
  assert.equal(verified.ownerSignatureCryptographicallyVerified, true);
  assert.equal(verified.acceptedByOwner, false);
});

test("Build 212 preserved all five gates and extends the existing evidence report fail-closed", () => {
  const result = verifyBuild212CIContract(readBuild206Inputs(), archived);
  assert.equal(result.protectedRequiredChecks, 5);
  const evidence = analyzeHistory([]);
  evidence.build210 = analyzeBuild210({
    history: archived,
    logRecords: [],
    runJobs: [],
    historical: evidence,
  });
  evidence.build211 = analyzeBuild211({
    history: archived,
    artifactMetadata: [],
    historical: evidence,
    runJobs: [],
    now: clock,
  });
  evidence.build212 = analyzeBuild212({ build211: evidence.build211 });
  assert.equal(
    evidence.build212.ownerSlaDecision.authenticatedSignedDecision,
    false,
  );
  assert.equal(evidence.build212.noPrivateOwnerKeysInCI, true);
  assert.match(formatSummary(evidence), /Build 212/);
  assert.match(
    formatSummary(evidence),
    /AWAITING_INDEPENDENT_OWNER_SIGNED_RECEIPT/,
  );
  const bad = structuredClone(readBuild206Inputs());
  bad.workflows["ci.yml"] = bad.workflows["ci.yml"].replace(
    "run: npm run build212:ci-contract",
    "run: true",
  );
  assert.throws(() => verifyBuild212CIContract(bad, archived));
});
