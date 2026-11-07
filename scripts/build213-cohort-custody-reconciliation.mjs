import {
  createHash,
  createPublicKey,
  verify as verifySignature,
} from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeReleaseThroughput } from "./build205-ci-runtime-diagnostics.mjs";
import { validateReviewedChromiumHistory } from "./build210-queue-history-triage.mjs";
import {
  canonicalJson,
  publicKeyFingerprint,
  verifyOwnerReceipt,
} from "./build212-owner-sla-receipt.mjs";

const SHA = /^[a-f0-9]{40}$/;
const SHA256 = /^sha256:[a-f0-9]{64}$/;
const COPY_LIMIT_BYTES = 50 * 1024 * 1024;
const MIN_COHORTS_PER_STAGE = 3;
const MAX_CUSTODY_RECEIPT_AGE_MS = 365 * 86_400_000;

export function accrueFiveGateCohorts(runJobs, { sourceRunLimit = 30 } = {}) {
  if (
    !Array.isArray(runJobs) ||
    !Number.isSafeInteger(sourceRunLimit) ||
    sourceRunLimit < 12 ||
    sourceRunLimit > 36 ||
    runJobs.length > sourceRunLimit
  ) {
    throw new Error("INVALID_BOUNDED_COHORT_SOURCE");
  }
  const throughput = analyzeReleaseThroughput(runJobs);
  const cohorts = {};
  for (const stage of ["PR", "MAIN"]) {
    const candidates = throughput.groups.filter(
      (group) => group.stage === stage,
    );
    const seen = new Set();
    let duplicateOrMalformed = 0;
    const verified = [];
    const incomplete = [];
    for (const candidate of candidates) {
      if (!SHA.test(candidate.commit ?? "") || seen.has(candidate.commit)) {
        duplicateOrMalformed++;
        continue;
      }
      seen.add(candidate.commit);
      if (
        candidate.state !== "ALL_FIVE_CHECKS_OBSERVED" ||
        !Number.isFinite(candidate.gateSeconds) ||
        candidate.gateSeconds < 0 ||
        !Array.isArray(candidate.runIds) ||
        new Set(candidate.runIds).size < 3
      ) {
        incomplete.push({
          commit: candidate.commit,
          reason: candidate.state,
          missing: candidate.missing ?? [],
        });
        continue;
      }
      verified.push({
        commit: candidate.commit,
        gateSeconds: candidate.gateSeconds,
        runIds: candidate.runIds,
      });
    }
    cohorts[stage] = {
      fullyProtectedCohorts: verified.length,
      minimumRequired: MIN_COHORTS_PER_STAGE,
      needAdditionalCohorts: Math.max(
        0,
        MIN_COHORTS_PER_STAGE - verified.length,
      ),
      incompleteExcluded: incomplete.length,
      malformedOrDuplicateExcluded: duplicateOrMalformed,
      state: duplicateOrMalformed
        ? "COHORT_SOURCE_CONFLICT_REVIEW_REQUIRED"
        : verified.length >= MIN_COHORTS_PER_STAGE
          ? "THREE_COMPLETE_FIVE_GATE_COHORTS_VERIFIED_NOT_OWNER_ACCEPTED"
          : "INSUFFICIENT_COMPLETE_FIVE_GATE_COHORTS",
      receipts: verified.slice(0, 15),
      incomplete: incomplete.slice(0, 10),
    };
  }
  const ready = Object.values(cohorts).every((row) =>
    row.state.startsWith("THREE_COMPLETE_"),
  );
  return {
    schema: "icamp.build213.five-gate-cohort-accrual.v1",
    state: ready
      ? "CROSS_STAGE_COHORT_EVIDENCE_COMPLETE_NOT_OWNER_ACCEPTED"
      : "COHORT_ACCRUAL_UNDER_REVIEW",
    maximumCompletedWorkflowRunsInspected: sourceRunLimit,
    actualCompletedWorkflowRunsInspected: runJobs.length,
    stages: cohorts,
    source: "GITHUB_ACTIONS_COMPLETED_RUN_AND_JOB_RECORDS",
    allFiveRequiredChecksRetained: true,
    automaticSlaAcceptance: false,
    productionApprovalGranted: false,
  };
}

function dateMs(value) {
  const ms = Date.parse(value ?? "");
  return Number.isFinite(ms) && new Date(ms).toISOString() === value
    ? ms
    : null;
}

function signedCustodyPayload(claims) {
  return canonicalJson({
    schema: "icamp.build213.archive-custody-attestation.v1",
    claims,
  });
}

export function verifyIndependentArchiveCustody({
  archive,
  claims,
  signatureBase64,
  custodianPins,
  history,
  now = Date.now(),
}) {
  if (
    !Buffer.isBuffer(archive) ||
    archive.length < 1 ||
    archive.length > COPY_LIMIT_BYTES ||
    typeof signatureBase64 !== "string" ||
    !/^[A-Za-z0-9+/]{86}==$/.test(signatureBase64) ||
    claims?.schema !== "icamp.build213.archive-custody-claims.v1" ||
    claims.repository !== "RosevearCreations/iCamp" ||
    !SHA.test(claims.sourceHeadSha ?? "") ||
    !SHA256.test(claims.sourceDigest ?? "") ||
    !SHA256.test(claims.copiedArchiveDigest ?? "") ||
    !Number.isSafeInteger(claims.sourceArtifactId) ||
    !Number.isSafeInteger(claims.sourceRunId) ||
    !Number.isSafeInteger(claims.sourceJobId) ||
    typeof claims.storageReference !== "string" ||
    !/^(offline|vault):\/\/[A-Za-z0-9._/-]{6,200}$/.test(
      claims.storageReference,
    ) ||
    typeof claims.custodianKeyId !== "string" ||
    custodianPins?.schema !== "icamp.build213.archive-custodian-pins.v1" ||
    !Array.isArray(custodianPins.signers)
  ) {
    throw new Error("INVALID_EXTERNAL_ARCHIVE_CUSTODY_PACKET");
  }
  const signedAt = dateMs(claims.signedAt);
  const expires = dateMs(claims.expiresAt);
  if (
    !Number.isFinite(now) ||
    signedAt === null ||
    expires === null ||
    now < signedAt - 60_000 ||
    now >= expires ||
    expires <= signedAt ||
    expires - signedAt > MAX_CUSTODY_RECEIPT_AGE_MS
  ) {
    throw new Error("ARCHIVE_CUSTODY_RECEIPT_EXPIRED_OR_INVALID_TIME");
  }
  const reviewed = validateReviewedChromiumHistory(history);
  const source = reviewed.find(
    (row) => row.artifactId === claims.sourceArtifactId,
  );
  if (
    !source ||
    source.headSha !== claims.sourceHeadSha ||
    source.runId !== claims.sourceRunId ||
    source.jobId !== claims.sourceJobId ||
    source.artifactDigest !== claims.sourceDigest
  ) {
    throw new Error("ARCHIVE_SOURCE_IDENTITY_NOT_REVIEWED");
  }
  const actualDigest = `sha256:${createHash("sha256").update(archive).digest("hex")}`;
  if (
    actualDigest !== claims.copiedArchiveDigest ||
    actualDigest !== source.artifactDigest
  ) {
    throw new Error("ARCHIVE_BYTES_DO_NOT_MATCH_ORIGINAL_DIGEST");
  }
  const matchingPins = custodianPins.signers.filter(
    (item) => item.keyId === claims.custodianKeyId,
  );
  if (matchingPins.length !== 1)
    throw new Error("CUSTODIAN_PUBLIC_PIN_MISSING_OR_DUPLICATE");
  const pin = matchingPins[0];
  if (
    pin.enabled !== true ||
    pin.role !== "ICAMP_CI_ARCHIVE_CUSTODIAN" ||
    !SHA256.test(pin.fingerprint ?? "") ||
    publicKeyFingerprint(pin.publicKeyPem) !== pin.fingerprint
  ) {
    throw new Error("CUSTODIAN_PIN_UNTRUSTED");
  }
  if (
    !verifySignature(
      null,
      Buffer.from(signedCustodyPayload(claims)),
      createPublicKey(pin.publicKeyPem),
      Buffer.from(signatureBase64, "base64"),
    )
  ) {
    throw new Error("CUSTODIAN_ATTESTATION_SIGNATURE_INVALID");
  }
  return {
    schema: "icamp.build213.verified-original-archive-custody.v1",
    state:
      "ARCHIVE_BYTES_MATCH_ORIGINAL_AND_PINNED_CUSTODIAN_ATTESTATION_VALID",
    originalArtifactId: source.artifactId,
    originalRunId: source.runId,
    originalJobId: source.jobId,
    copiedArchiveDigest: actualDigest,
    custodianPublicKeyPinned: true,
    signatureCryptographicallyVerified: true,
    immutableStorageVerified: false,
    longTermRetentionPolicyVerified: false,
    ownerRetentionDecisionGranted: false,
    releaseApprovalGranted: false,
  };
}

export function reconcileOwnerSlaReceipt({
  evidence,
  receipt,
  ownerPins,
  now = Date.now(),
  consumedNonces = new Set(),
}) {
  if (!evidence?.build213?.cohortAccrual)
    throw new Error("BUILD213_COHORT_SOURCE_REQUIRED");
  const verified = verifyOwnerReceipt(receipt, evidence, ownerPins, {
    now,
    consumedNonces,
  });
  const complete =
    evidence.build213.cohortAccrual.state ===
    "CROSS_STAGE_COHORT_EVIDENCE_COMPLETE_NOT_OWNER_ACCEPTED";
  if (verified.acceptedByOwner && !complete)
    throw new Error("SIGNED_SLA_ACCEPTANCE_LACKS_FIVE_GATE_COHORTS");
  return {
    schema: "icamp.build213.reconciled-sla-receipt.v1",
    state: verified.acceptedByOwner
      ? "EXACT_EVIDENCE_OWNER_SLA_ACCEPTANCE_VERIFIED"
      : "SIGNED_OWNER_DEFER_OR_REJECTION_VERIFIED",
    signedReceipt: verified,
    cohortAccrual: evidence.build213.cohortAccrual.state,
    independentOriginalArchiveRequiredForLongTermCustody: true,
    productionReleaseAuthorized: false,
    trustedCommsTestAuthorized: false,
  };
}

export function analyzeBuild213({
  runJobs,
  build211,
  build212,
  sourceRunLimit = 30,
}) {
  if (
    build211?.schema !== "icamp.build211.runner-artifact-sla.v1" ||
    build212?.schema !== "icamp.build212.escalation-sla-custody.v1" ||
    !build211.ownerSla ||
    !build212.evidenceCustody
  )
    throw new Error("INVALID_PRIOR_EVIDENCE_CONTRACT");
  const cohortAccrual = accrueFiveGateCohorts(runJobs, { sourceRunLimit });
  return {
    schema: "icamp.build213.cohort-custody-sla-reconciliation.v1",
    cohortAccrual,
    externalArchiveCustody: {
      state:
        "NO_EXTERNAL_ARCHIVE_BYTES_OR_INDEPENDENT_CUSTODIAN_ATTESTATION_IN_CI",
      verifiedOriginalCopies: 0,
      originalSourcesNeedingIndependentReview:
        build212.evidenceCustody.originalCount,
      copiedArtifactBytesPresentInCI: false,
      independentRetentionApproved: false,
    },
    signedSlaDecision: {
      state: "NO_EXTERNALLY_SIGNED_OWNER_RECEIPT_ENROLLED_IN_CI",
      previouslyObservedState: build212.ownerSlaDecision?.state ?? "UNKNOWN",
      acceptedByOwner: false,
      receiptCryptographicallyVerified: false,
      privateKeyUsedInCI: false,
    },
    protectedGateChanges: false,
    productionApprovalGranted: false,
    commsTestHandshakeAuthorized: false,
  };
}

async function main(args) {
  const [command, ...paths] = args;
  if (command === "verify-archive" && paths.length === 4) {
    const [originalZipPath, claimsPath, attestationPath, pinsPath] = paths;
    const size = await stat(originalZipPath);
    if (!size.isFile() || size.size > COPY_LIMIT_BYTES)
      throw new Error("ORIGINAL_ARCHIVE_SIZE_LIMIT");
    const [archive, claims, attestation, custodianPins] = await Promise.all([
      readFile(originalZipPath),
      readFile(claimsPath, "utf8").then(JSON.parse),
      readFile(attestationPath, "utf8").then(JSON.parse),
      readFile(pinsPath, "utf8").then(JSON.parse),
    ]);
    const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
    const history = JSON.parse(
      await readFile(
        resolve(root, "fixtures/build210-reviewed-chromium-history.json"),
        "utf8",
      ),
    );
    console.log(
      JSON.stringify(
        verifyIndependentArchiveCustody({
          archive,
          claims,
          signatureBase64: attestation.signatureBase64,
          custodianPins,
          history,
        }),
      ),
    );
    return;
  }
  if (command === "verify-owner" && paths.length === 3) {
    const [evidencePath, receiptPath, pinsPath] = paths;
    const [evidence, receipt, ownerPins] = await Promise.all([
      readFile(evidencePath, "utf8").then(JSON.parse),
      readFile(receiptPath, "utf8").then(JSON.parse),
      readFile(pinsPath, "utf8").then(JSON.parse),
    ]);
    console.log(
      JSON.stringify(
        reconcileOwnerSlaReceipt({ evidence, receipt, ownerPins }),
      ),
    );
    return;
  }
  throw new Error(
    "USAGE: verify-archive <original-external.zip> <claims.json> <attestation.json> <custodian-pins.json>; verify-owner <build205-ci-runtime.json> <owner-sla-receipt.json> <owner-pins.json>",
  );
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(
      error instanceof Error ? error.message : "BUILD213_RECONCILIATION_ERROR",
    );
    process.exitCode = 1;
  });
}
