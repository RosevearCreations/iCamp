// Read-only monitoring. GitHub job logs are source observations, not signed
// release approvals, and missing logs must never be represented as green.
export const LOG_SAMPLE_LIMIT = 4;
export const MIRROR_STALL_SECONDS = 120;
export const PROMOTION_MONITORING_BUDGET_SECONDS = Object.freeze({
  PR: 900,
  MAIN: 900,
});

const percentile = (values, q) => {
  if (!values.length) return null;
  const ordered = [...values].sort((a, b) => a - b);
  return ordered[Math.ceil(ordered.length * q) - 1];
};

export function browserLogCandidates(runJobs) {
  return runJobs
    .filter(({ run }) => run?.name === "CI" && run.status === "completed")
    .flatMap(({ run, jobs }) =>
      (jobs ?? [])
        .filter((job) => job.name === "Browser end-to-end" && job.id)
        .map((job) => ({
          runId: run.id,
          jobId: job.id,
          commit: run.head_sha,
          stage:
            run.event === "push" && run.head_branch === "main"
              ? "MAIN"
              : run.event === "pull_request"
                ? "PR"
                : "OTHER",
          jobOutcome: job.conclusion,
          observedAt: Date.parse(run.created_at ?? ""),
        })),
    )
    .filter((item) => Number.isFinite(item.observedAt))
    .sort((a, b) => b.observedAt - a.observedAt)
    .slice(0, LOG_SAMPLE_LIMIT);
}

// Read the machine-readable diagnostic line only; never preserve raw job logs,
// which may contain access-controlled or sensitive output from other steps.
export function parseBrowserJobLog(logText, candidate) {
  const marker = '{"schema":"icamp.build208.chromium-runner-diagnostics.v1"';
  let witness = null;
  for (const line of logText.split("\n")) {
    const index = line.indexOf(marker);
    if (index < 0) continue;
    try {
      const parsed = JSON.parse(line.slice(index).trim());
      const checkoutCommitMatchesHead = parsed.commit === candidate.commit;
      // GitHub sets GITHUB_SHA to refs/pull/N/merge on pull_request events.
      // The Actions run API instead reports the PR head SHA. Both are
      // 40-character commits, but only the job's exact run ID binds the
      // diagnostic to a GitHub source; this is not a signed trust decision.
      const pullRequestMergeCheckout =
        candidate.stage === "PR" && /^[a-f0-9]{40}$/.test(parsed.commit);
      if (
        String(parsed.runId) === String(candidate.runId) &&
        (checkoutCommitMatchesHead || pullRequestMergeCheckout) &&
        parsed.source === "SAME_JOB_UTC_WALL_CLOCK" &&
        parsed.runnerOSVersion === "24.04" &&
        ["HIT", "MISS"].includes(parsed.browserCache) &&
        Number.isFinite(parsed.installSeconds) &&
        parsed.installSeconds >= 0 &&
        parsed.installSeconds <= 1200 &&
        parsed.installOutcome === candidate.jobOutcome
      ) {
        witness = parsed;
      }
    } catch {
      // An incomplete or malformed witness is not monitoring evidence.
    }
  }
  const fetchMatch = logText.match(
    /Fetched\s+[\d.]+\s+MB\s+in\s+(?:(\d+)min\s*)?(\d+)s\b/,
  );
  const aptFetchSeconds = fetchMatch
    ? Number(fetchMatch[1] ?? 0) * 60 + Number(fetchMatch[2])
    : null;
  const mirrorHost = "azure.archive.ubuntu.com";
  const mirror = [...logText.matchAll(/https?:\/\/[^\s<>"']+/g)].some(
    ([rawUrl]) => {
      try {
        return new URL(rawUrl).hostname === mirrorHost;
      } catch {
        return false;
      }
    },
  )
    ? mirrorHost
    : null;
  return {
    ...candidate,
    state: witness ? "GITHUB_JOB_LOG_WITNESS_OBSERVED" : "NO_VALID_JOB_WITNESS",
    runnerOSVersion: witness?.runnerOSVersion ?? null,
    browserCache: witness?.browserCache ?? null,
    installSeconds: witness?.installSeconds ?? null,
    installOutcome: witness?.installOutcome ?? null,
    checkoutCommit: witness?.commit ?? null,
    checkoutCommitBinding: witness
      ? witness.commit === candidate.commit
        ? "RUN_HEAD_SHA_MATCHED"
        : "PR_WORKFLOW_SYNTHETIC_MERGE_SHA"
      : "UNVERIFIED",
    mirror,
    aptFetchSeconds,
  };
}

export async function fetchBrowserLogEvidence(
  runJobs,
  {
    fetchImpl = fetch,
    token = process.env.GITHUB_TOKEN,
    repository = process.env.GITHUB_REPOSITORY,
    apiUrl = process.env.GITHUB_API_URL ?? "https://api.github.com",
  } = {},
) {
  const candidates = browserLogCandidates(runJobs);
  if (!token || !/^[\w.-]+\/[\w.-]+$/.test(repository ?? "")) {
    return candidates.map((candidate) => ({
      ...candidate,
      state: "ACTIONS_JOB_LOG_SOURCE_UNAVAILABLE",
    }));
  }
  const output = [];
  for (let i = 0; i < candidates.length; i += 2) {
    const batch = await Promise.all(
      candidates.slice(i, i + 2).map(async (candidate) => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        try {
          const response = await fetchImpl(
            `${apiUrl}/repos/${repository}/actions/jobs/${candidate.jobId}/logs`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
              },
              signal: controller.signal,
            },
          );
          if (
            !response.ok ||
            Number(response.headers?.get?.("content-length") ?? 0) > 2_000_000
          ) {
            throw new Error("LOG_READ_UNAVAILABLE");
          }
          const logText = await response.text();
          if (logText.length > 2_000_000) throw new Error("LOG_TOO_LARGE");
          return parseBrowserJobLog(logText, candidate);
        } catch {
          return { ...candidate, state: "ACTIONS_JOB_LOG_SOURCE_UNAVAILABLE" };
        } finally {
          clearTimeout(timeout);
        }
      }),
    );
    output.push(...batch);
  }
  return output;
}

export function analyzeCrossReleaseCache(logRecords) {
  const verified = logRecords.filter(
    (record) =>
      record.state === "GITHUB_JOB_LOG_WITNESS_OBSERVED" &&
      record.installOutcome === "success" &&
      record.jobOutcome === "success" &&
      ["HIT", "MISS"].includes(record.browserCache) &&
      Number.isFinite(record.installSeconds),
  );
  const byOS = {};
  for (const os of [...new Set(verified.map((item) => item.runnerOSVersion))]) {
    const onOS = verified.filter((item) => item.runnerOSVersion === os);
    const cold = onOS
      .filter((item) => item.browserCache === "MISS")
      .map((item) => item.installSeconds);
    const warm = onOS
      .filter((item) => item.browserCache === "HIT")
      .map((item) => item.installSeconds);
    byOS[os] = {
      coldSamples: cold.length,
      warmSamples: warm.length,
      coldP50Seconds: percentile(cold, 0.5),
      warmP50Seconds: percentile(warm, 0.5),
      coldP90Seconds: percentile(cold, 0.9),
      warmP90Seconds: percentile(warm, 0.9),
      provisionalMedianSavingsSeconds:
        cold.length && warm.length
          ? percentile(cold, 0.5) - percentile(warm, 0.5)
          : null,
      state:
        cold.length >= 2 && warm.length >= 2
          ? "COMPARABLE_OS_SAMPLES_OBSERVED_NOT_SLA_APPROVAL"
          : "INSUFFICIENT_COMPARABLE_COLD_WARM_SAMPLES",
    };
  }
  return {
    state: !verified.length
      ? "NO_VERIFIED_JOB_WITNESSES"
      : Object.values(byOS).every((item) =>
            item.state.startsWith("COMPARABLE_"),
          )
        ? "COMPARABLE_TREND_OBSERVED_NOT_OWNER_ACCEPTED"
        : "PROVISIONAL_SMALL_SAMPLE_TREND",
    reviewedJobLogs: logRecords.length,
    verifiedJobWitnesses: verified.length,
    missingLogWitnesses: logRecords.length - verified.length,
    byRunnerOS: byOS,
    mixedOSComparisonsProhibited: true,
  };
}

export function analyzeMirrorStalls(logRecords, reviewedBaseline) {
  const historical = reviewedBaseline?.stages?.coldMainOutlier;
  const pinned =
    historical?.ubuntuMirror === "azure.archive.ubuntu.com" &&
    Number.isFinite(historical.aptFetchSeconds) &&
    historical.aptFetchSeconds > MIRROR_STALL_SECONDS
      ? [
          {
            runId: historical.runId,
            jobId: historical.jobId,
            mirror: historical.ubuntuMirror,
            aptFetchSeconds: historical.aptFetchSeconds,
            source: "BUILD208_REVIEWED_ORIGINAL_JOB_LOG_BASELINE",
          },
        ]
      : [];
  const recent = logRecords
    .filter(
      (record) =>
        record.mirror && record.aptFetchSeconds > MIRROR_STALL_SECONDS,
    )
    .map(({ runId, jobId, mirror, aptFetchSeconds }) => ({
      runId,
      jobId,
      mirror,
      aptFetchSeconds,
      source: "GITHUB_ACTIONS_JOB_LOG",
    }));
  return {
    state: recent.length
      ? "CURRENT_UBUNTU_MIRROR_STALL_REVIEW_REQUIRED"
      : pinned.length
        ? "HISTORICAL_UBUNTU_MIRROR_STALL_PINNED_FOR_REVIEW"
        : "NO_CONFIRMED_MIRROR_LOG_EVIDENCE",
    thresholdSeconds: MIRROR_STALL_SECONDS,
    recentLogSourcesUnavailable: logRecords.filter(
      (item) => item.state === "ACTIONS_JOB_LOG_SOURCE_UNAVAILABLE",
    ).length,
    confirmedAlerts: [...pinned, ...recent],
    notInferredFromInstallDurationAlone: true,
  };
}

export function reviewPromotionSLA(throughput) {
  const stages = {};
  for (const [stage, budget] of Object.entries(
    PROMOTION_MONITORING_BUDGET_SECONDS,
  )) {
    const samples = throughput.groups
      .filter(
        (item) =>
          item.stage === stage &&
          item.state === "ALL_FIVE_CHECKS_OBSERVED" &&
          Number.isFinite(item.gateSeconds),
      )
      .map((item) => item.gateSeconds);
    const p90 = percentile(samples, 0.9);
    stages[stage] = {
      fullyProtectedSampleCount: samples.length,
      gateP90Seconds: p90,
      monitoringBudgetSeconds: budget,
      state:
        p90 === null
          ? "NO_COMPLETE_PROTECTED_RELEASES"
          : p90 > budget
            ? "PROMOTION_SLA_REVIEW_REQUIRED"
            : samples.length < 3
              ? "PROVISIONAL_SAMPLE_WINDOW"
              : "BUDGET_OBSERVED_NOT_OWNER_ACCEPTED",
    };
  }
  return {
    state: Object.values(stages).some(
      (item) => item.state === "PROMOTION_SLA_REVIEW_REQUIRED",
    )
      ? "REVIEW_REQUIRED"
      : "MONITORING_ONLY_NOT_OWNER_ACCEPTED",
    stages,
    includesVercelDeployment: false,
    protectedChecksRequired: 5,
    releaseAuthorized: false,
  };
}

export function analyzeBuild209({ logRecords, throughput, reviewedBaseline }) {
  return {
    schema: "icamp.build209.cross-release-ci-monitoring.v1",
    source: "GITHUB_ACTIONS_READ_ONLY_AND_PINNED_REVIEWED_BASELINE",
    crossReleaseCache: analyzeCrossReleaseCache(logRecords),
    ubuntuMirrorAlerts: analyzeMirrorStalls(logRecords, reviewedBaseline),
    protectedPromotionSLA: reviewPromotionSLA(throughput),
    monitoringOnly: true,
    allFiveProtectedChecksRetained: true,
    ownerSlaAcceptance: false,
    productionReleaseApproval: false,
    trustedCommsTestHandshakeAuthorized: false,
  };
}
