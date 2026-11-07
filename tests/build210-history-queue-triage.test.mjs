import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  analyzeBuild210,
  analyzeHistoricalCacheRetention,
  analyzeQueueSaturation,
  triageReleaseLatency,
  validateReviewedChromiumHistory,
} from "../scripts/build210-queue-history-triage.mjs";
import {
  analyzeHistory,
  formatSummary,
} from "../scripts/build205-ci-runtime-diagnostics.mjs";
import { readBuild206Inputs } from "../scripts/verify-build206-cache-contract.mjs";
import { verifyBuild210CIContract } from "../scripts/verify-build210-ci-contract.mjs";

const history = JSON.parse(
  readFileSync(
    resolve(
      import.meta.dirname,
      "../fixtures/build210-reviewed-chromium-history.json",
    ),
    "utf8",
  ),
);

test("Build 210 retains four reviewed artifact fingerprints across releases, not just the latest workflow window", () => {
  assert.equal(validateReviewedChromiumHistory(history).length, 4);
  const result = analyzeHistoricalCacheRetention(history, []);
  assert.equal(result.state, "HISTORICAL_TREND_OBSERVED_NOT_OWNER_ACCEPTED");
  assert.equal(result.byRunnerOS["24.04"].coldSamples, 2);
  assert.equal(result.byRunnerOS["24.04"].warmSamples, 2);
  assert.equal(result.byRunnerOS["24.04"].coldP50Seconds, 24);
  assert.equal(result.byRunnerOS["24.04"].coldP90Seconds, 27);
  assert.equal(result.byRunnerOS["24.04"].warmP50Seconds, 13);
  assert.equal(result.byRunnerOS["24.04"].warmP90Seconds, 16);
  assert.equal(result.byRunnerOS["24.04"].observedP50SavingsSeconds, 11);
  assert.equal(result.ownerAcceptedSla, false);
  assert.equal(result.archiveIsIndependentlyImmutable, false);
});

test("Build 210 deduplicates matching live GitHub logs and quarantines a conflict", () => {
  const stored = history.observations[2];
  const fresh = {
    state: "GITHUB_JOB_LOG_WITNESS_OBSERVED",
    runId: stored.runId,
    jobId: stored.jobId,
    commit: stored.headSha,
    runnerOSVersion: "24.04",
    stage: "PR",
    browserCache: "HIT",
    installSeconds: 13,
    installOutcome: "success",
    jobOutcome: "success",
  };
  const same = analyzeHistoricalCacheRetention(history, [fresh]);
  assert.equal(same.deduplicatedSampleCount, 4);
  assert.equal(same.freshVerifiedJobLogs, 0);
  const corrupt = analyzeHistoricalCacheRetention(history, [
    { ...fresh, installSeconds: 500 },
    fresh,
  ]);
  assert.equal(corrupt.state, "SOURCE_CONFLICT_REQUIRES_REVIEW");
  assert.equal(corrupt.conflicts.length, 1);
  assert.equal(corrupt.deduplicatedSampleCount, 3);
  assert.equal(corrupt.byRunnerOS["24.04"].warmSamples, 1);
});

test("Build 210 rejects malformed provenance and refuses unverified cache samples", () => {
  const wrong = structuredClone(history);
  wrong.observations[0].artifactDigest = "sha256:fiction";
  assert.throws(() => validateReviewedChromiumHistory(wrong));
  const repeated = structuredClone(history);
  repeated.observations.push(repeated.observations[0]);
  assert.throws(() => validateReviewedChromiumHistory(repeated));
  const ignored = analyzeHistoricalCacheRetention(history, [
    {
      state: "ACTIONS_JOB_LOG_SOURCE_UNAVAILABLE",
      runId: 999,
      browserCache: "HIT",
      installSeconds: 1,
    },
  ]);
  assert.equal(ignored.unverifiedJobLogsIgnored, 1);
  assert.equal(ignored.deduplicatedSampleCount, 4);
});

test("Build 210 distinguishes actual queue delays from unverifiable runner saturation", () => {
  const samples = [
    {
      check: "CI / Browser end-to-end",
      runId: 1,
      jobId: 101,
      queueSeconds: 720,
      conclusion: "success",
    },
    {
      check: "CI / Verify",
      runId: 2,
      jobId: 102,
      queueSeconds: 20,
      conclusion: "success",
    },
  ];
  const runJobs = [
    {
      run: { id: 1, head_branch: "main", created_at: "2026-11-06T00:00:00Z" },
      jobs: [{ completed_at: "2026-11-06T00:15:00Z" }],
    },
    {
      run: { id: 2, head_branch: "main", created_at: "2026-11-06T00:02:00Z" },
      jobs: [{ completed_at: "2026-11-06T00:20:00Z" }],
    },
  ];
  const queue = analyzeQueueSaturation(runJobs, samples);
  assert.equal(queue.largestObservedQueueDelays.length, 1);
  assert.equal(queue.largestObservedQueueDelays[0].queueSeconds, 720);
  assert.equal(queue.sampledOverlappingRunPairs.length, 1);
  assert.equal(queue.saturationProven, false);
  assert.equal(queue.measuredRunnerPoolCapacity, false);
});

test("Build 210 distinguishes failed job and budget exception from an incomplete source window", () => {
  const queue = {
    largestObservedQueueDelays: [
      { check: "CI / Verify", runId: 1, jobId: 10, queueSeconds: 610 },
    ],
  };
  const throughput = {
    groups: [
      {
        stage: "MAIN",
        state: "ALL_FIVE_CHECKS_OBSERVED",
        gateSeconds: 1001,
        commit: "one",
        runIds: [1],
      },
      {
        stage: "PR",
        state: "INCOMPLETE_REQUIRED_GATES",
        gateSeconds: null,
        commit: "two",
        runIds: [2],
      },
    ],
  };
  const triage = triageReleaseLatency({
    queue,
    throughput,
    samples: [
      { check: "CI / Verify", runId: 1, jobId: 10, conclusion: "failure" },
    ],
  });
  assert.equal(triage.exceptionCount, 3);
  assert.equal(triage.incompleteFiveGateGroupsExcluded, 1);
  assert.equal(triage.alertAutomaticallyRerunsWorkflows, false);
  assert.equal(triage.ownerClosureAccepted, false);
});

test("Build 210 is integrated in the existing GitHub artifact and retains all five required gates", () => {
  const result = verifyBuild210CIContract(readBuild206Inputs(), history);
  assert.equal(result.fiveRequiredChecks, 5);
  const evidence = analyzeHistory([]);
  evidence.build210 = analyzeBuild210({
    history,
    logRecords: [],
    runJobs: [],
    historical: evidence,
  });
  assert.match(formatSummary(evidence), /Build 210/);
  const missing = structuredClone(readBuild206Inputs());
  missing.workflows["ci.yml"] = missing.workflows["ci.yml"].replace(
    "run: npm run build210:ci-contract",
    "run: true",
  );
  assert.throws(() => verifyBuild210CIContract(missing, history));
  const unavailable = formatSummary({
    ...analyzeHistory([]),
    build210: { state: "SOURCE_UNAVAILABLE", sourceFailure: "NO_ACTIONS_READ" },
  });
  assert.match(unavailable, /SOURCE UNAVAILABLE/);
});
