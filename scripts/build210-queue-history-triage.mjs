import { REQUIRED_CHECK_BUDGETS } from "./build205-ci-runtime-diagnostics.mjs";

const percentile = (values, q) => {
  if (!values.length) return null;
  const ordered = [...values].sort((a, b) => a - b);
  return ordered[Math.ceil(ordered.length * q) - 1];
};

const sha = /^[a-f0-9]{40}$/;
const digest = /^sha256:[a-f0-9]{64}$/;

export function validateReviewedChromiumHistory(history) {
  if (
    history?.schema !== "icamp.build210.reviewed-chromium-history.v1" ||
    history.monitoringOnly !== true ||
    history.ownerAcceptedSla !== false ||
    history.trustedCommsTestAuthorized !== false ||
    !Array.isArray(history.observations) ||
    history.observations.length < 4 ||
    history.observations.length > 12
  ) {
    throw new Error("INVALID_REVIEWED_HISTORY_ENVELOPE");
  }
  const ids = new Set();
  for (const item of history.observations) {
    const key = `${item.runId}:${item.jobId}`;
    if (
      !Number.isSafeInteger(item.runId) ||
      !Number.isSafeInteger(item.jobId) ||
      !Number.isSafeInteger(item.artifactId) ||
      !sha.test(item.headSha ?? "") ||
      !digest.test(item.artifactDigest ?? "") ||
      !["MAIN", "PR"].includes(item.stage) ||
      item.runnerOSVersion !== "24.04" ||
      !["HIT", "MISS"].includes(item.browserCache) ||
      !Number.isSafeInteger(item.installSeconds) ||
      item.installSeconds < 0 ||
      item.installSeconds > 1200 ||
      item.jobOutcome !== "success" ||
      ids.has(key)
    ) {
      throw new Error("INVALID_OR_DUPLICATE_REVIEWED_HISTORY_SAMPLE");
    }
    ids.add(key);
  }
  return history.observations;
}

export function analyzeHistoricalCacheRetention(history, logRecords = []) {
  const archive = validateReviewedChromiumHistory(history);
  const observations = new Map(
    archive.map((item) => [
      `${item.runId}:${item.jobId}`,
      {
        runId: item.runId,
        jobId: item.jobId,
        headSha: item.headSha,
        runnerOSVersion: item.runnerOSVersion,
        browserCache: item.browserCache,
        installSeconds: item.installSeconds,
        stage: item.stage,
        source: "REVIEWED_GITHUB_ARTIFACT_SHA256",
        artifactId: item.artifactId,
        artifactDigest: item.artifactDigest,
      },
    ]),
  );
  const conflicts = [];
  const quarantinedKeys = new Set();
  let fresh = 0;
  let ignored = 0;
  for (const item of logRecords) {
    if (
      item.state !== "GITHUB_JOB_LOG_WITNESS_OBSERVED" ||
      item.installOutcome !== "success" ||
      item.jobOutcome !== "success" ||
      !sha.test(item.commit ?? "") ||
      item.runnerOSVersion !== "24.04" ||
      !["HIT", "MISS"].includes(item.browserCache) ||
      !Number.isSafeInteger(item.installSeconds) ||
      item.installSeconds < 0 ||
      item.installSeconds > 1200
    ) {
      ignored++;
      continue;
    }
    const key = `${item.runId}:${item.jobId}`;
    if (quarantinedKeys.has(key)) continue;
    const existing = observations.get(key);
    if (existing) {
      if (
        existing.runnerOSVersion !== item.runnerOSVersion ||
        existing.browserCache !== item.browserCache ||
        existing.installSeconds !== item.installSeconds
      ) {
        conflicts.push({ runId: item.runId, jobId: item.jobId });
        observations.delete(key);
        quarantinedKeys.add(key);
      }
      continue;
    }
    observations.set(key, {
      runId: item.runId,
      jobId: item.jobId,
      headSha: item.commit,
      runnerOSVersion: item.runnerOSVersion,
      browserCache: item.browserCache,
      installSeconds: item.installSeconds,
      stage: item.stage,
      source: "GITHUB_ACTIONS_JOB_LOG_WITNESS",
    });
    fresh++;
  }
  const retained = [...observations.values()];
  const byRunnerOS = {};
  for (const os of [...new Set(retained.map((item) => item.runnerOSVersion))]) {
    const values = retained.filter((item) => item.runnerOSVersion === os);
    const cold = values
      .filter((item) => item.browserCache === "MISS")
      .map((item) => item.installSeconds);
    const warm = values
      .filter((item) => item.browserCache === "HIT")
      .map((item) => item.installSeconds);
    byRunnerOS[os] = {
      coldSamples: cold.length,
      warmSamples: warm.length,
      coldP50Seconds: percentile(cold, 0.5),
      coldP90Seconds: percentile(cold, 0.9),
      warmP50Seconds: percentile(warm, 0.5),
      warmP90Seconds: percentile(warm, 0.9),
      observedP50SavingsSeconds:
        cold.length && warm.length
          ? percentile(cold, 0.5) - percentile(warm, 0.5)
          : null,
      state:
        cold.length >= 2 && warm.length >= 2
          ? "CROSS_RELEASE_OBSERVATIONS_COMPARABLE_NOT_OWNER_ACCEPTED"
          : "INSUFFICIENT_COLD_WARM_HISTORY",
    };
  }
  return {
    schema: "icamp.build210.historical-cache-retention.v1",
    state: conflicts.length
      ? "SOURCE_CONFLICT_REQUIRES_REVIEW"
      : Object.values(byRunnerOS).every((data) =>
            data.state.startsWith("CROSS_RELEASE_"),
          )
        ? "HISTORICAL_TREND_OBSERVED_NOT_OWNER_ACCEPTED"
        : "INCOMPLETE_COMPARABLE_HISTORY",
    archivedReviewedSamples: archive.length,
    freshVerifiedJobLogs: fresh,
    unverifiedJobLogsIgnored: ignored,
    deduplicatedSampleCount: retained.length,
    conflicts,
    byRunnerOS,
    retainedSources: retained.map(
      ({
        runId,
        jobId,
        stage,
        browserCache,
        installSeconds,
        source,
        artifactId,
      }) => ({
        runId,
        jobId,
        stage,
        browserCache,
        installSeconds,
        source,
        artifactId: artifactId ?? null,
      }),
    ),
    archiveIsIndependentlyImmutable: false,
    ownerAcceptedSla: false,
  };
}

export function analyzeQueueSaturation(runJobs, samples) {
  const matching = samples.filter(
    (item) =>
      Object.hasOwn(REQUIRED_CHECK_BUDGETS, item.check) &&
      Number.isFinite(item.queueSeconds),
  );
  const checkRows = {};
  for (const [name, budget] of Object.entries(REQUIRED_CHECK_BUDGETS)) {
    const values = matching.filter((item) => item.check === name);
    checkRows[name] = {
      samples: values.length,
      queueP90Seconds: percentile(
        values.map((item) => item.queueSeconds),
        0.9,
      ),
      queueBudgetSeconds: budget.queueSeconds,
      overBudgetJobCount: values.filter(
        (item) => item.queueSeconds > budget.queueSeconds,
      ).length,
    };
  }
  const queueExceptions = matching
    .filter(
      (item) =>
        item.queueSeconds > REQUIRED_CHECK_BUDGETS[item.check].queueSeconds,
    )
    .sort((a, b) => b.queueSeconds - a.queueSeconds)
    .slice(0, 8)
    .map(({ check, runId, jobId, queueSeconds }) => ({
      check,
      runId,
      jobId,
      queueSeconds,
      state: "OBSERVED_QUEUE_DELAY_CAUSE_UNDETERMINED",
    }));

  // Overlap is a possible contention clue, never proof of runner saturation.
  const intervals = runJobs
    .map(({ run, jobs }) => {
      const start = Date.parse(run?.created_at ?? "");
      const ends = (jobs ?? [])
        .map((job) => Date.parse(job.completed_at ?? ""))
        .filter(Number.isFinite);
      return {
        runId: run?.id,
        branch: run?.head_branch,
        start,
        end: Math.max(...ends),
      };
    })
    .filter((item) => Number.isFinite(item.start) && Number.isFinite(item.end));
  const overlap = [];
  for (let a = 0; a < intervals.length; a++) {
    for (let b = a + 1; b < intervals.length; b++) {
      const first = intervals[a];
      const second = intervals[b];
      if (
        first.runId !== second.runId &&
        first.branch === second.branch &&
        first.start < second.end &&
        second.start < first.end
      ) {
        overlap.push([first.runId, second.runId]);
      }
    }
  }
  return {
    schema: "icamp.build210.ci-queue-attribution.v1",
    state: queueExceptions.length
      ? "QUEUE_DELAY_TRIAGE_REQUIRED_NO_CAUSAL_ATTRIBUTION"
      : matching.length < 10
        ? "INSUFFICIENT_QUEUE_OBSERVATIONS"
        : "NO_QUEUE_BUDGET_EXCEPTIONS_IN_SAMPLED_WINDOW",
    totalRequiredJobObservations: matching.length,
    checks: checkRows,
    largestObservedQueueDelays: queueExceptions,
    sampledOverlappingRunPairs: overlap.slice(0, 10),
    measuredRunnerPoolCapacity: false,
    saturationProven: false,
    networkOrMirrorCauseInferred: false,
  };
}

export function triageReleaseLatency({ queue, throughput, samples }) {
  const exceptions = [];
  for (const sample of samples) {
    if (
      Object.hasOwn(REQUIRED_CHECK_BUDGETS, sample.check) &&
      sample.conclusion !== "success"
    ) {
      exceptions.push({
        kind: "REQUIRED_JOB_UNSUCCESSFUL",
        severity: "REVIEW_REQUIRED",
        runId: sample.runId,
        jobId: sample.jobId,
        check: sample.check,
        observedConclusion: sample.conclusion,
      });
    }
  }
  for (const item of queue.largestObservedQueueDelays) {
    exceptions.push({
      kind: "QUEUE_BUDGET_BREACH",
      severity: "PERFORMANCE_REVIEW",
      ...item,
    });
  }
  for (const group of throughput.groups) {
    if (group.state === "ALL_FIVE_CHECKS_OBSERVED" && group.gateSeconds > 900) {
      exceptions.push({
        kind: "COMPLETE_FIVE_GATE_SLA_BUDGET_BREACH",
        severity: "PERFORMANCE_REVIEW",
        stage: group.stage,
        commit: group.commit,
        gateSeconds: group.gateSeconds,
        runIds: group.runIds,
      });
    }
  }
  return {
    schema: "icamp.build210.release-latency-triage.v1",
    state: exceptions.length
      ? "OBSERVED_EXCEPTIONS_REQUIRE_REVIEW"
      : "NO_OBSERVED_EXCEPTIONS_IN_BOUNDED_WINDOW",
    exceptionCount: exceptions.length,
    exceptions: exceptions.slice(0, 20),
    incompleteFiveGateGroupsExcluded: throughput.groups.filter(
      (group) => group.state !== "ALL_FIVE_CHECKS_OBSERVED",
    ).length,
    incompleteGroupNotAssumedFailure: true,
    alertAutomaticallyRerunsWorkflows: false,
    ownerClosureAccepted: false,
  };
}

export function analyzeBuild210({ history, logRecords, runJobs, historical }) {
  const retained = analyzeHistoricalCacheRetention(history, logRecords);
  const queue = analyzeQueueSaturation(runJobs, historical.samples);
  const exceptions = triageReleaseLatency({
    queue,
    throughput: historical.throughput,
    samples: historical.samples,
  });
  return {
    schema: "icamp.build210.queue-history-latency.v1",
    retainedCacheHistory: retained,
    queueSaturation: queue,
    latencyExceptions: exceptions,
    sampleWindow: "LATEST_30_COMPLETED_WORKFLOW_RUNS_PLUS_REVIEWED_ARCHIVE",
    doesNotEstablishRunnerPoolCapacity: true,
    protectedChecksModified: false,
    monitoringOnly: true,
    releaseApprovalGranted: false,
    commsTestHandshakeAuthorized: false,
  };
}
