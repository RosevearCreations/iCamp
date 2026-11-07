import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  accrueFiveGateCohorts,
  analyzeBuild213,
  reconcileOwnerSlaReceipt,
  verifyIndependentArchiveCustody,
} from "../scripts/build213-cohort-custody-reconciliation.mjs";
import {
  canonicalJson,
  prepareOwnerRequest,
  publicKeyFingerprint,
  signOwnerRequest,
} from "../scripts/build212-owner-sla-receipt.mjs";
import { analyzeBuild210 } from "../scripts/build210-queue-history-triage.mjs";
import { analyzeBuild211 } from "../scripts/build211-runner-artifact-sla.mjs";
import { analyzeBuild212 } from "../scripts/build212-escalation-custody.mjs";
import {
  analyzeHistory,
  formatSummary,
} from "../scripts/build205-ci-runtime-diagnostics.mjs";
import { readBuild206Inputs } from "../scripts/verify-build206-cache-contract.mjs";
import { verifyBuild213CIContract } from "../scripts/verify-build213-ci-contract.mjs";

const sourceHistory = JSON.parse(
  readFileSync(
    resolve(
      import.meta.dirname,
      "../fixtures/build210-reviewed-chromium-history.json",
    ),
    "utf8",
  ),
);
const now = Date.parse("2026-11-07T03:00:00.000Z");
const iso = (ms) => new Date(ms).toISOString();

function successfulRuns({ pr = 3, main = 3 } = {}) {
  const result = [];
  let nextRunId = 1100;
  let nextJobId = 3300;
  for (const [stage, count] of [
    ["PR", pr],
    ["MAIN", main],
  ]) {
    for (let i = 0; i < count; i++) {
      const commit = (stage === "PR" ? "a" : "b") + String(i).padStart(39, "0");
      for (const [workflow, names] of [
        ["CI", ["Verify", "Browser end-to-end", "Database migrations"]],
        ["Secret Scan", ["Gitleaks"]],
        ["CodeQL", ["Analyze JavaScript and TypeScript"]],
      ]) {
        const run = {
          id: nextRunId++,
          name: workflow,
          head_sha: commit,
          event: stage === "PR" ? "pull_request" : "push",
          head_branch: stage === "PR" ? "dev" : "main",
          status: "completed",
          conclusion: "success",
          created_at: iso(now + i * 50_000),
        };
        const jobs = names.map((name) => ({
          id: nextJobId++,
          name,
          conclusion: "success",
          started_at: iso(now + i * 50_000 + 5000),
          completed_at: iso(now + i * 50_000 + 15_000),
        }));
        result.push({ run, jobs });
      }
    }
  }
  return result;
}

test("Build 213 accrues only genuine complete five-check PR/main SHA cohorts from bounded Actions jobs", () => {
  const report = accrueFiveGateCohorts(successfulRuns());
  assert.equal(
    report.state,
    "CROSS_STAGE_COHORT_EVIDENCE_COMPLETE_NOT_OWNER_ACCEPTED",
  );
  assert.equal(report.stages.PR.fullyProtectedCohorts, 3);
  assert.equal(report.stages.MAIN.fullyProtectedCohorts, 3);
  assert.equal(report.stages.PR.needAdditionalCohorts, 0);
  assert.equal(report.automaticSlaAcceptance, false);
  const sparse = accrueFiveGateCohorts(successfulRuns({ pr: 3, main: 2 }));
  assert.equal(sparse.state, "COHORT_ACCRUAL_UNDER_REVIEW");
  assert.equal(sparse.stages.MAIN.needAdditionalCohorts, 1);
  const tampered = successfulRuns();
  tampered[2].jobs[0].conclusion = "failure";
  const incomplete = accrueFiveGateCohorts(tampered);
  assert.equal(incomplete.stages.PR.fullyProtectedCohorts, 2);
  assert.equal(incomplete.stages.PR.incompleteExcluded, 1);
  assert.throws(() =>
    accrueFiveGateCohorts(successfulRuns(), { sourceRunLimit: 12 }),
  );
});

test("Build 213 verifies exact original archive bytes and independently pinned Ed25519 custodian evidence", () => {
  const archive = Buffer.from(
    "test-only original GitHub Actions artifact ZIP bytes",
  );
  const hash = `sha256:${createHash("sha256").update(archive).digest("hex")}`;
  const history = structuredClone(sourceHistory);
  history.observations[0].artifactDigest = hash;
  const source = history.observations[0];
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const pem = publicKey.export({ type: "spki", format: "pem" });
  const claims = {
    schema: "icamp.build213.archive-custody-claims.v1",
    repository: "RosevearCreations/iCamp",
    sourceArtifactId: source.artifactId,
    sourceRunId: source.runId,
    sourceJobId: source.jobId,
    sourceHeadSha: source.headSha,
    sourceDigest: hash,
    copiedArchiveDigest: hash,
    storageReference: "offline://vaults/verified-run-evidence",
    custodianKeyId: "independent-custodian",
    signedAt: iso(now),
    expiresAt: iso(now + 3 * 86_400_000),
  };
  const signatureBase64 = sign(
    null,
    Buffer.from(
      canonicalJson({
        schema: "icamp.build213.archive-custody-attestation.v1",
        claims,
      }),
    ),
    privateKey,
  ).toString("base64");
  const custodianPins = {
    schema: "icamp.build213.archive-custodian-pins.v1",
    signers: [
      {
        keyId: "independent-custodian",
        role: "ICAMP_CI_ARCHIVE_CUSTODIAN",
        enabled: true,
        publicKeyPem: pem,
        fingerprint: publicKeyFingerprint(pem),
      },
    ],
  };
  const packet = {
    archive,
    claims,
    signatureBase64,
    custodianPins,
    history,
    now: now + 1000,
  };
  const verified = verifyIndependentArchiveCustody(packet);
  assert.equal(verified.signatureCryptographicallyVerified, true);
  assert.equal(verified.copiedArchiveDigest, hash);
  assert.equal(verified.immutableStorageVerified, false);
  assert.equal(verified.longTermRetentionPolicyVerified, false);
  assert.throws(
    () =>
      verifyIndependentArchiveCustody({
        ...packet,
        archive: Buffer.from("altered ZIP bytes"),
      }),
    /DO_NOT_MATCH/,
  );
  assert.throws(
    () =>
      verifyIndependentArchiveCustody({
        ...packet,
        claims: { ...claims, storageReference: "offline://vaults/altered" },
      }),
    /SIGNATURE_INVALID/,
  );
  assert.throws(
    () =>
      verifyIndependentArchiveCustody({
        ...packet,
        custodianPins: {
          ...custodianPins,
          signers: [{ ...custodianPins.signers[0], enabled: false }],
        },
      }),
    /UNTRUSTED/,
  );
  assert.throws(
    () =>
      verifyIndependentArchiveCustody({ ...packet, now: now + 5 * 86_400_000 }),
    /EXPIRED/,
  );
});

test("Build 213 reconciles actual pinned owner receipt only against matching sufficient cohort evidence", () => {
  const evidence = {
    context: { commit: "c".repeat(40) },
    build210: { latencyExceptions: { exceptionCount: 0 } },
    build211: {
      schema: "icamp.build211.runner-artifact-sla.v1",
      ownerSla: {
        schema: "icamp.build211.owner-sla-acceptance.v1",
        state: "READY_FOR_OWNER_REVIEW_NOT_APPROVED",
        stages: Object.fromEntries(
          ["PR", "MAIN"].map((stage) => [
            stage,
            {
              state: "REVIEWABLE_MONITORING_SAMPLES",
              completeFiveGateCohorts: 3,
              p90Seconds: 180,
              monitoringBudgetSeconds: 900,
            },
          ]),
        ),
      },
    },
    build213: {
      cohortAccrual: {
        state: "CROSS_STAGE_COHORT_EVIDENCE_COMPLETE_NOT_OWNER_ACCEPTED",
      },
    },
  };
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const pem = publicKey.export({ type: "spki", format: "pem" });
  const request = prepareOwnerRequest(evidence, {
    keyId: "owner-reviewed",
    decision: "ACCEPT_MONITORING_SLA",
    now,
  });
  const receipt = signOwnerRequest(
    request,
    evidence,
    privateKey.export({ type: "pkcs8", format: "pem" }),
    {
      now: now + 2000,
    },
  );
  const ownerPins = {
    schema: "icamp.build212.sla-owner-pins.v1",
    signers: [
      {
        keyId: "owner-reviewed",
        role: "ICAMP_SLA_OWNER",
        enabled: true,
        publicKeyPem: pem,
        fingerprint: publicKeyFingerprint(pem),
      },
    ],
  };
  const result = reconcileOwnerSlaReceipt({
    evidence,
    receipt,
    ownerPins,
    now: now + 2000,
  });
  assert.equal(result.state, "EXACT_EVIDENCE_OWNER_SLA_ACCEPTANCE_VERIFIED");
  assert.equal(result.productionReleaseAuthorized, false);
  assert.equal(result.trustedCommsTestAuthorized, false);
  assert.throws(
    () =>
      reconcileOwnerSlaReceipt({
        evidence: {
          ...evidence,
          build213: { cohortAccrual: { state: "COHORT_ACCRUAL_UNDER_REVIEW" } },
        },
        receipt,
        ownerPins,
        now: now + 2000,
      }),
    /LACKS_FIVE_GATE/,
  );
});

test("Build 213 retains fail-closed unsigned CI state, five protected checks and meaningful source summary", () => {
  const previous = verifyBuild213CIContract(
    readBuild206Inputs(),
    sourceHistory,
  );
  assert.equal(previous.fiveProtectedChecks, 5);
  const runJobs = successfulRuns();
  const history = analyzeHistory(runJobs);
  history.build210 = analyzeBuild210({
    history: sourceHistory,
    logRecords: [],
    runJobs,
    historical: history,
  });
  history.build211 = analyzeBuild211({
    history: sourceHistory,
    artifactMetadata: [],
    historical: history,
    runJobs,
    now,
  });
  history.build212 = analyzeBuild212({ build211: history.build211 });
  history.build213 = analyzeBuild213({
    runJobs,
    build211: history.build211,
    build212: history.build212,
  });
  assert.equal(
    history.build213.cohortAccrual.state,
    "CROSS_STAGE_COHORT_EVIDENCE_COMPLETE_NOT_OWNER_ACCEPTED",
  );
  assert.equal(history.build213.signedSlaDecision.acceptedByOwner, false);
  assert.equal(
    history.build213.externalArchiveCustody.verifiedOriginalCopies,
    0,
  );
  assert.match(formatSummary(history), /Build 213/);
  assert.match(formatSummary(history), /NO_EXTERNALLY_SIGNED_OWNER_RECEIPT/);
  const changed = structuredClone(readBuild206Inputs());
  changed.workflows["ci.yml"] = changed.workflows["ci.yml"].replace(
    "run: npm run build213:ci-contract",
    "run: true",
  );
  assert.throws(() => verifyBuild213CIContract(changed, sourceHistory));
});
