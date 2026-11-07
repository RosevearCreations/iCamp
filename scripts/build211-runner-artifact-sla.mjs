import {
  REQUIRED_CHECK_BUDGETS,
  safeSeconds,
  percentile,
} from "./build205-ci-runtime-diagnostics.mjs";
import { validateReviewedChromiumHistory } from "./build210-queue-history-triage.mjs";

const SHA256 = /^sha256:[a-f0-9]{64}$/;
const SHA = /^[a-f0-9]{40}$/;
const EXPIRING_WITHIN_DAYS = 7;
const SLA_BUDGET_SECONDS = 900;

function validDate(value) {
  const timestamp = Date.parse(value ?? "");
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function analyzeRunnerContention(runJobs, history) {
  const delayed = history.samples.filter(
    (sample) =>
      Object.hasOwn(REQUIRED_CHECK_BUDGETS, sample.check) &&
      sample.queueSeconds > REQUIRED_CHECK_BUDGETS[sample.check].queueSeconds,
  );
  const witnesses = [];
  for (const { run, jobs } of runJobs) {
    for (const job of jobs ?? []) {
      if (!Object.hasOwn(REQUIRED_CHECK_BUDGETS, `${run?.name} / ${job.name}`))
        continue;
      const runnerName =
        typeof job.runner_name === "string" && job.runner_name.trim()
          ? job.runner_name
          : null;
      const runnerGroup =
        typeof job.runner_group_name === "string" &&
        job.runner_group_name.trim()
          ? job.runner_group_name
          : null;
      const queueProxySeconds = safeSeconds(run.created_at, job.started_at);
      if (
        !Number.isSafeInteger(run.id) ||
        !Number.isSafeInteger(job.id) ||
        queueProxySeconds === null
      )
        continue;
      witnesses.push({
        runId: run.id,
        jobId: job.id,
        check: `${run.name} / ${job.name}`,
        runnerName,
        runnerGroup,
        runnerLabels: Array.isArray(job.labels)
          ? job.labels.filter((label) => typeof label === "string").slice(0, 8)
          : [],
        workflowCreatedAt: run.created_at,
        jobStartedAt: job.started_at,
        queueProxySeconds,
        conclusion: job.conclusion ?? "UNKNOWN",
      });
    }
  }
  const distinctRunnerNames = new Set(
    witnesses.map((entry) => entry.runnerName).filter(Boolean),
  );
  return {
    schema: "icamp.build211.runner-contention-verification.v1",
    state: delayed.length
      ? "OBSERVED_DELAY_REQUIRES_RUNNER_CAPACITY_SOURCE_REVIEW"
      : witnesses.length < 5
        ? "INSUFFICIENT_RUNNER_IDENTITY_EVIDENCE"
        : "RUNNER_ASSIGNMENT_OBSERVED_CAPACITY_UNVERIFIED",
    observedRequiredJobs: witnesses.length,
    observedRunnerNames: distinctRunnerNames.size,
    missingRunnerIdentityCount: witnesses.filter((row) => !row.runnerName)
      .length,
    delayedRequiredJobs: delayed.map(
      ({ runId, jobId, check, queueSeconds }) => ({
        runId,
        jobId,
        check,
        queueSeconds,
        assignmentWitness:
          witnesses.find((row) => row.runId === runId && row.jobId === jobId) ??
          null,
      }),
    ),
    assignments: witnesses.slice(0, 30),
    queueMeasurement:
      "WORKFLOW_CREATED_TO_JOB_START_PROXY_INCLUDES_SCHEDULING_OVERHEAD",
    githubHostedRunnerPoolCapacityExposed: false,
    actualRunnerSaturationProven: false,
    alternativeCausesExcluded: false,
    rerunsTriggered: false,
  };
}

export function normalizeArtifactResponse(raw, artifactId) {
  if (
    !raw ||
    raw.id !== artifactId ||
    typeof raw.name !== "string" ||
    validDate(raw.created_at) === null ||
    validDate(raw.expires_at) === null ||
    !Number.isSafeInteger(raw.size_in_bytes) ||
    raw.size_in_bytes < 0 ||
    typeof raw.expired !== "boolean"
  ) {
    throw new Error("INVALID_ACTIONS_ARTIFACT_METADATA");
  }
  return {
    artifactId,
    name: raw.name,
    createdAt: raw.created_at,
    expiresAt: raw.expires_at,
    expired: raw.expired,
    sizeBytes: raw.size_in_bytes,
    digest: SHA256.test(raw.digest ?? "") ? raw.digest : null,
  };
}

export async function fetchReviewedArtifactMetadata(
  history,
  {
    fetchImpl = fetch,
    token = process.env.GITHUB_TOKEN,
    repository = process.env.GITHUB_REPOSITORY,
    apiUrl = process.env.GITHUB_API_URL ?? "https://api.github.com",
  } = {},
) {
  const entries = validateReviewedChromiumHistory(history);
  if (!token || !/^[\w.-]+\/[\w.-]+$/.test(repository ?? "")) {
    return entries.map(({ artifactId }) => ({
      artifactId,
      sourceFailure: "ACTIONS_ARTIFACT_READ_ACCESS_UNAVAILABLE",
    }));
  }
  const result = [];
  for (let i = 0; i < entries.length; i += 2) {
    const batch = await Promise.all(
      entries.slice(i, i + 2).map(async ({ artifactId }) => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        try {
          const response = await fetchImpl(
            `${apiUrl}/repos/${repository}/actions/artifacts/${artifactId}`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
              },
              signal: controller.signal,
            },
          );
          if (!response.ok)
            return {
              artifactId,
              sourceFailure: `ACTIONS_ARTIFACT_HTTP_${response.status}`,
            };
          return normalizeArtifactResponse(await response.json(), artifactId);
        } catch {
          return {
            artifactId,
            sourceFailure: "ACTIONS_ARTIFACT_METADATA_UNAVAILABLE",
          };
        } finally {
          clearTimeout(timeout);
        }
      }),
    );
    result.push(...batch);
  }
  return result;
}

export function reviewArtifactRenewal(history, metadata, now = Date.now()) {
  const entries = validateReviewedChromiumHistory(history);
  if (!Number.isFinite(now)) throw new Error("INVALID_REVIEW_CLOCK");
  const byId = new Map();
  const duplicates = new Set();
  for (const row of metadata ?? []) {
    if (!Number.isSafeInteger(row.artifactId)) continue;
    if (byId.has(row.artifactId)) duplicates.add(row.artifactId);
    byId.set(row.artifactId, row);
  }
  const sources = entries.map((archived) => {
    const row = byId.get(archived.artifactId);
    const base = {
      artifactId: archived.artifactId,
      runId: archived.runId,
      jobId: archived.jobId,
      pinnedOriginalDigest: archived.artifactDigest,
      archiveIsIndependentlyImmutable: false,
    };
    if (!row || row.sourceFailure || duplicates.has(archived.artifactId)) {
      return {
        ...base,
        status: "SOURCE_UNAVAILABLE_RENEWAL_REVIEW",
        sourceFailure: duplicates.has(archived.artifactId)
          ? "DUPLICATE_ARTIFACT_METADATA"
          : (row?.sourceFailure ?? "ARTIFACT_METADATA_MISSING"),
      };
    }
    if (row.digest && row.digest !== archived.artifactDigest) {
      return {
        ...base,
        status: "DIGEST_CONFLICT_QUARANTINED",
        metadataDigest: row.digest,
      };
    }
    const expiry = validDate(row.expiresAt);
    if (
      expiry === null ||
      validDate(row.createdAt) === null ||
      expiry < validDate(row.createdAt)
    ) {
      return { ...base, status: "INVALID_RETENTION_METADATA" };
    }
    const daysRemaining = Math.ceil((expiry - now) / 86_400_000);
    return {
      ...base,
      status:
        row.expired || expiry <= now
          ? "ORIGINAL_ARTIFACT_EXPIRED"
          : daysRemaining <= EXPIRING_WITHIN_DAYS
            ? "EXPIRING_RENEWAL_REVIEW_REQUIRED"
            : "ORIGINAL_ARTIFACT_AVAILABLE",
      expiresAt: row.expiresAt,
      daysRemaining,
      metadataDigest: row.digest ?? null,
      githubMetadataDigestMatchesPin: row.digest ? true : null,
    };
  });
  const needsReview = sources.filter(
    (row) => row.status !== "ORIGINAL_ARTIFACT_AVAILABLE",
  );
  return {
    schema: "icamp.build211.artifact-expiry-renewal.v1",
    state: needsReview.length
      ? "ARTIFACT_RENEWAL_OWNER_REVIEW_REQUIRED"
      : "ORIGINAL_ARTIFACTS_CURRENT_RENEWAL_NOT_NEEDED",
    reviewedCount: sources.length,
    unavailableOrConflicted: sources.filter(
      (row) =>
        row.status === "SOURCE_UNAVAILABLE_RENEWAL_REVIEW" ||
        row.status === "DIGEST_CONFLICT_QUARANTINED" ||
        row.status === "INVALID_RETENTION_METADATA",
    ).length,
    expiringCount: sources.filter(
      (row) => row.status === "EXPIRING_RENEWAL_REVIEW_REQUIRED",
    ).length,
    expiredCount: sources.filter(
      (row) => row.status === "ORIGINAL_ARTIFACT_EXPIRED",
    ).length,
    sources,
    retentionAlertDays: EXPIRING_WITHIN_DAYS,
    freshEvidenceUploadConfigured: true,
    freshEvidenceUploadVerifiedAtDiagnosticTime: false,
    originalArtifactsRenewed: false,
    retentionExtended: false,
    digestPinsAreImmutableExternalArchive: false,
    ownerRetentionApprovalGranted: false,
  };
}

export function buildOwnerSlaPacket({
  history,
  runnerContention,
  artifactReview,
  latencyExceptions,
}) {
  const stages = Object.fromEntries(
    ["PR", "MAIN"].map((stage) => {
      const cohort = history.throughput.groups.filter(
        (row) =>
          row.stage === stage &&
          row.state === "ALL_FIVE_CHECKS_OBSERVED" &&
          Number.isFinite(row.gateSeconds),
      );
      const values = cohort.map((row) => row.gateSeconds);
      const p90 = percentile(values, 0.9);
      return [
        stage,
        {
          completeFiveGateCohorts: values.length,
          p50Seconds: percentile(values, 0.5),
          p90Seconds: p90,
          monitoringBudgetSeconds: SLA_BUDGET_SECONDS,
          aboveBudgetCohorts: values.filter(
            (seconds) => seconds > SLA_BUDGET_SECONDS,
          ).length,
          state:
            values.length < 3
              ? "INSUFFICIENT_COHORTS_FOR_OWNER_ACCEPTANCE"
              : p90 > SLA_BUDGET_SECONDS
                ? "OBSERVED_SLA_BUDGET_BREACH"
                : "REVIEWABLE_MONITORING_SAMPLES",
          evidence: cohort.map(({ commit, gateSeconds, runIds }) => ({
            commit,
            gateSeconds,
            runIds,
          })),
        },
      ];
    }),
  );
  const sourceProblem = artifactReview.unavailableOrConflicted > 0;
  const needsAttention =
    Object.values(stages).some(
      (stage) => stage.state !== "REVIEWABLE_MONITORING_SAMPLES",
    ) ||
    runnerContention.delayedRequiredJobs.length > 0 ||
    artifactReview.state !== "ORIGINAL_ARTIFACTS_CURRENT_RENEWAL_NOT_NEEDED" ||
    latencyExceptions.exceptionCount > 0;
  return {
    schema: "icamp.build211.owner-sla-acceptance.v1",
    state: sourceProblem
      ? "UNDER_REVIEW_SOURCE_RECONCILIATION_REQUIRED"
      : needsAttention
        ? "UNDER_REVIEW_OWNER_DECISION_REQUIRED"
        : "READY_FOR_OWNER_REVIEW_NOT_APPROVED",
    stages,
    sourceCompletenessCaveat:
      "LATEST_12_COMPLETED_WORKFLOWS_DOES_NOT_GUARANTEE_THREE_COMPLETE_COHORTS_PER_STAGE",
    decision: {
      owner: null,
      acceptedAt: null,
      signedDecisionReceipt: null,
      status: "NOT_SIGNED",
    },
    monitoringBudgetIsNotProtectedGate: true,
    productionReleaseAuthorized: false,
    commsTestHandshakeAuthorized: false,
    automaticallyAcceptSla: false,
  };
}

export function analyzeBuild211({
  runJobs,
  historical,
  history,
  artifactMetadata,
  now,
}) {
  if (
    !historical?.samples ||
    !historical?.throughput ||
    !SHA.test(history.observations[0].headSha)
  )
    throw new Error("INVALID_BUILD211_INPUTS");
  const runnerContention = analyzeRunnerContention(runJobs, historical);
  const artifactReview = reviewArtifactRenewal(history, artifactMetadata, now);
  const ownerSla = buildOwnerSlaPacket({
    history: historical,
    runnerContention,
    artifactReview,
    latencyExceptions: historical.build210.latencyExceptions,
  });
  return {
    schema: "icamp.build211.runner-artifact-sla.v1",
    runnerContention,
    artifactReview,
    ownerSla,
    protectedChecksModified: false,
    monitoringOnly: true,
    ownerApprovalGranted: false,
    trustedCommsTestAuthorized: false,
  };
}
