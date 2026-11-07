import { createHash } from "node:crypto";

const sha = /^[a-f0-9]{40}$/;

function fingerprint(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function buildRunnerEscalationReceipts({
  runnerContention,
  repository = "RosevearCreations/iCamp",
}) {
  if (
    !runnerContention ||
    !Array.isArray(runnerContention.delayedRequiredJobs) ||
    !/^[\w.-]+\/[\w.-]+$/.test(repository)
  )
    throw new Error("INVALID_RUNNER_ESCALATION_SOURCE");
  const seen = new Set();
  const receipts = [];
  for (const row of runnerContention.delayedRequiredJobs) {
    if (
      !Number.isSafeInteger(row.runId) ||
      !Number.isSafeInteger(row.jobId) ||
      !Number.isFinite(row.queueSeconds) ||
      row.queueSeconds <= 0 ||
      typeof row.check !== "string" ||
      !row.check.trim()
    ) {
      throw new Error("INVALID_DELAY_SOURCE");
    }
    const key = `${row.runId}:${row.jobId}`;
    if (seen.has(key)) throw new Error("DUPLICATE_DELAY_SOURCE");
    seen.add(key);
    const witness = row.assignmentWitness;
    if (
      witness &&
      (witness.runId !== row.runId || witness.jobId !== row.jobId)
    ) {
      throw new Error("RUNNER_WITNESS_IDENTITY_CONFLICT");
    }
    receipts.push({
      id: `ICAMP-CI-RUNNER-${fingerprint({ repository, key }).slice(0, 20)}`,
      runId: row.runId,
      jobId: row.jobId,
      check: row.check,
      queueProxySeconds: row.queueSeconds,
      githubRunUrl: `https://github.com/${repository}/actions/runs/${row.runId}`,
      runnerName: witness?.runnerName ?? null,
      runnerGroup: witness?.runnerGroup ?? null,
      assignmentSource: witness
        ? "GITHUB_ACTIONS_JOB_METADATA"
        : "RUNNER_ASSIGNMENT_SOURCE_UNAVAILABLE",
      state: "DRAFT_PROVIDER_ESCALATION_NOT_SUBMITTED",
      observedDelayIsNotCapacityProof: true,
      providerTicket: null,
      providerFinding: null,
      independentClosureReceipt: null,
      ownerApprovedEscalation: false,
    });
  }
  return {
    schema: "icamp.build212.runner-capacity-escalation.v1",
    state: receipts.length
      ? "OWNER_REVIEW_ESCALATION_DRAFTS_PENDING"
      : "NO_QUEUE_CAPACITY_ESCALATION_TRIGGER_IN_WINDOW",
    draftCount: receipts.length,
    receipts: receipts.slice(0, 20),
    sampledWindowOnly: true,
    runnerPoolSaturationProven: false,
    providerCasesFiled: 0,
    providerCauseEstablished: false,
    automaticallyRerunsWorkflows: false,
  };
}

export function reviewLongTermEvidenceCustody({
  artifactReview,
  recentEvidenceArtifact = null,
}) {
  if (
    !artifactReview ||
    !Array.isArray(artifactReview.sources) ||
    !Number.isSafeInteger(artifactReview.reviewedCount) ||
    artifactReview.sources.length !== artifactReview.reviewedCount
  ) {
    throw new Error("INVALID_ARTIFACT_CUSTODY_INPUT");
  }
  const rows = artifactReview.sources.map((item) => {
    if (
      !Number.isSafeInteger(item.artifactId) ||
      typeof item.status !== "string"
    ) {
      throw new Error("INVALID_ARTIFACT_CUSTODY_ITEM");
    }
    return {
      artifactId: item.artifactId,
      originalAvailability: item.status,
      originalExpiresAt: item.expiresAt ?? null,
      originalPinnedDigest: item.pinnedOriginalDigest ?? null,
      independentlyRetainedCopy: false,
      independentCopyDigestVerified: false,
      custodyAttestedByOwner: false,
      disposition:
        item.status === "ORIGINAL_ARTIFACT_EXPIRED"
          ? "ORIGINAL_UNAVAILABLE_REVIEW_SOURCE_GAP"
          : item.status === "ORIGINAL_ARTIFACT_AVAILABLE"
            ? "ORIGINAL_AVAILABLE_EXTERNAL_CUSTODY_NOT_VERIFIED"
            : "OWNER_SOURCE_REVIEW_REQUIRED",
    };
  });
  // The workflow's uploaded fresh artifact is a new observation, never an
  // extension of the original four archived source artifacts.
  const fresh =
    recentEvidenceArtifact &&
    Number.isSafeInteger(recentEvidenceArtifact.id) &&
    sha.test(recentEvidenceArtifact.headSha ?? "") &&
    typeof recentEvidenceArtifact.expiresAt === "string"
      ? {
          artifactId: recentEvidenceArtifact.id,
          headSha: recentEvidenceArtifact.headSha,
          expiresAt: recentEvidenceArtifact.expiresAt,
          provenance: "NEW_GITHUB_ACTIONS_ARTIFACT",
          independentlyRetainedCopy: false,
        }
      : null;
  return {
    schema: "icamp.build212.evidence-custody-review.v1",
    state: "LONG_TERM_EXTERNAL_CUSTODY_REQUIRES_OWNER_DECISION",
    originalCount: rows.length,
    originalSources: rows,
    latestFreshActionsArtifact: fresh,
    originalArtifactsRenewed: false,
    verifiedLongTermImmutableCopies: 0,
    validatedExternalCustodian: false,
    proposedRetentionPolicyApproved: false,
    publicFingerprintAloneIsCustodyProof: false,
    ownerRetentionDecision: null,
    noProductionMigrationOrDeletion: true,
  };
}

export function analyzeBuild212({ build211, recentEvidenceArtifact = null }) {
  if (
    build211?.schema !== "icamp.build211.runner-artifact-sla.v1" ||
    !build211.runnerContention ||
    !build211.artifactReview ||
    !build211.ownerSla
  ) {
    throw new Error("INVALID_BUILD211_SOURCE");
  }
  return {
    schema: "icamp.build212.escalation-sla-custody.v1",
    runnerEscalation: buildRunnerEscalationReceipts({
      runnerContention: build211.runnerContention,
    }),
    evidenceCustody: reviewLongTermEvidenceCustody({
      artifactReview: build211.artifactReview,
      recentEvidenceArtifact,
    }),
    ownerSlaDecision: {
      state: "AWAITING_INDEPENDENT_OWNER_SIGNED_RECEIPT",
      sourceBaselineState: build211.ownerSla.state,
      sourceSlaSampleCounts: Object.fromEntries(
        Object.entries(build211.ownerSla.stages).map(([stage, row]) => [
          stage,
          row.completeFiveGateCohorts,
        ]),
      ),
      receiptIdentity: null,
      ownerPinAuthenticated: false,
      authenticatedSignedDecision: false,
      acceptedByOwner: false,
      decisionSource: "EXTERNAL_EXPLICIT_OWNER_ACTION_ONLY",
    },
    noPrivateOwnerKeysInCI: true,
    noProtectedGateChanges: true,
    productionApprovalGranted: false,
    trustedCommsTestAuthorized: false,
  };
}
