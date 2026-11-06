import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  analyzeBuild209,
  analyzeCrossReleaseCache,
  analyzeMirrorStalls,
  browserLogCandidates,
  fetchBrowserLogEvidence,
  parseBrowserJobLog,
  reviewPromotionSLA,
} from "../scripts/build209-release-trends.mjs";
import {
  formatSummary,
  analyzeHistory,
} from "../scripts/build205-ci-runtime-diagnostics.mjs";
import { verifyBuild209CIContract } from "../scripts/verify-build209-ci-contract.mjs";
import { readBuild206Inputs } from "../scripts/verify-build206-cache-contract.mjs";

const baseline = JSON.parse(
  readFileSync(
    resolve(
      import.meta.dirname,
      "../fixtures/build208-browser-cache-baseline.json",
    ),
    "utf8",
  ),
);
const candidate = {
  runId: 42283842267,
  jobId: 127912345678,
  commit: "7c893cbbb08719c9b5cc4888d9890bc7cdf2b951",
  jobOutcome: "success",
  stage: "MAIN",
  observedAt: Date.parse("2026-11-06T18:00:00Z"),
};

function jobLog({
  cache = "MISS",
  seconds = 27,
  runId = candidate.runId,
} = {}) {
  return (
    "2026-11-06T18:00:00Z apt output: Get:1 https://azure.archive.ubuntu.com/ubuntu package\n" +
    "Fetched 21.9 MB in 9min 23s (38.8 kB/s)\n" +
    "2026-11-06T18:01:00Z " +
    JSON.stringify({
      schema: "icamp.build208.chromium-runner-diagnostics.v1",
      source: "SAME_JOB_UTC_WALL_CLOCK",
      runId: String(runId),
      commit: candidate.commit,
      runnerOSVersion: "24.04",
      browserCache: cache,
      installSeconds: seconds,
      installOutcome: "success",
    }) +
    "\n"
  );
}

test("Build 209 verifies source identity and treats malformed or missing cache evidence as unavailable", () => {
  const observed = parseBrowserJobLog(jobLog(), candidate);
  assert.equal(observed.state, "GITHUB_JOB_LOG_WITNESS_OBSERVED");
  assert.equal(observed.browserCache, "MISS");
  assert.equal(observed.aptFetchSeconds, 563);
  assert.equal(observed.mirror, "azure.archive.ubuntu.com");
  assert.equal(
    parseBrowserJobLog(jobLog({ runId: 123 }), candidate).state,
    "NO_VALID_JOB_WITNESS",
  );
  assert.equal(
    parseBrowserJobLog("{" + "invalid JSON", candidate).state,
    "NO_VALID_JOB_WITNESS",
  );
  assert.equal(
    parseBrowserJobLog("Install Chromium took 999s", candidate).mirror,
    null,
  );
});

test("Build 209 never combines Ubuntu versions or accepts one cold/warm pair as an SLA", () => {
  const cold = parseBrowserJobLog(
    jobLog({ cache: "MISS", seconds: 27 }),
    candidate,
  );
  const warm = { ...cold, browserCache: "HIT", installSeconds: 14 };
  const differentOS = { ...warm, runnerOSVersion: "26.04" };
  const onlyCold = analyzeCrossReleaseCache([cold]);
  assert.equal(onlyCold.byRunnerOS["24.04"].warmSamples, 0);
  const crossOS = analyzeCrossReleaseCache([cold, differentOS]);
  assert.equal(crossOS.byRunnerOS["24.04"].warmSamples, 0);
  assert.equal(crossOS.byRunnerOS["26.04"].coldSamples, 0);
  const paired = analyzeCrossReleaseCache([cold, warm]);
  assert.equal(paired.byRunnerOS["24.04"].provisionalMedianSavingsSeconds, 13);
  assert.equal(paired.state, "PROVISIONAL_SMALL_SAMPLE_TREND");
  assert.equal(analyzeCrossReleaseCache([]).state, "NO_VERIFIED_JOB_WITNESSES");
});

test("Build 209 retains pinned original mirror alert and cannot infer a new one from slow installer alone", () => {
  const alerts = analyzeMirrorStalls([], baseline);
  assert.equal(alerts.confirmedAlerts.length, 1);
  assert.equal(alerts.confirmedAlerts[0].aptFetchSeconds, 563);
  const slowWithoutSource = {
    ...candidate,
    state: "NO_VALID_JOB_WITNESS",
    installSeconds: 600,
  };
  assert.equal(
    analyzeMirrorStalls([slowWithoutSource], baseline).confirmedAlerts.length,
    1,
  );
  const recent = parseBrowserJobLog(jobLog(), candidate);
  assert.equal(
    analyzeMirrorStalls([recent], baseline).state,
    "CURRENT_UBUNTU_MIRROR_STALL_REVIEW_REQUIRED",
  );
});

test("Build 209 only counts complete protected gate cohorts in SLA review", () => {
  const throughput = {
    groups: [
      {
        stage: "PR",
        state: "ALL_FIVE_CHECKS_OBSERVED",
        gateSeconds: 1100,
      },
      { stage: "PR", state: "INCOMPLETE_REQUIRED_GATES", gateSeconds: 20 },
      {
        stage: "MAIN",
        state: "ALL_FIVE_CHECKS_OBSERVED",
        gateSeconds: 600,
      },
    ],
  };
  const sla = reviewPromotionSLA(throughput);
  assert.equal(sla.state, "REVIEW_REQUIRED");
  assert.equal(sla.stages.PR.fullyProtectedSampleCount, 1);
  assert.equal(sla.stages.PR.state, "PROMOTION_SLA_REVIEW_REQUIRED");
  assert.equal(sla.stages.MAIN.state, "PROVISIONAL_SAMPLE_WINDOW");
  const full = analyzeBuild209({
    logRecords: [],
    throughput,
    reviewedBaseline: baseline,
  });
  assert.equal(full.productionReleaseApproval, false);
  assert.equal(full.trustedCommsTestHandshakeAuthorized, false);
  assert.match(
    formatSummary({ ...analyzeHistory([]), build209: full }),
    /Build 209/,
  );
});

test("Build 209 strictly bounds read-only remote job log requests and fails closed on API errors", async () => {
  const runJobs = Array.from({ length: 8 }, (_, index) => ({
    run: {
      id: index + 1,
      name: "CI",
      status: "completed",
      event: "push",
      head_branch: "main",
      head_sha: candidate.commit,
      created_at: new Date(
        Date.parse("2026-11-06T00:00:00Z") + index * 1000,
      ).toISOString(),
    },
    jobs: [
      { id: index + 101, name: "Browser end-to-end", conclusion: "success" },
    ],
  }));
  assert.equal(browserLogCandidates(runJobs).length, 4);
  let requests = 0;
  const logs = await fetchBrowserLogEvidence(runJobs, {
    token: "test-token",
    repository: "RosevearCreations/iCamp",
    fetchImpl: async () => {
      requests++;
      return { ok: false, status: 403 };
    },
  });
  assert.equal(requests, 4);
  assert.equal(logs.length, 4);
  assert.ok(
    logs.every((item) => item.state === "ACTIONS_JOB_LOG_SOURCE_UNAVAILABLE"),
  );
});

test("Build 209 preserves five required gates, exact browser cache, and existing workflow events", () => {
  const inputs = readBuild206Inputs();
  assert.equal(verifyBuild209CIContract(inputs).protectedRequiredJobs, 5);
  const insecure = structuredClone(inputs);
  insecure.workflows["ci.yml"] = insecure.workflows["ci.yml"].replace(
    "actions: read",
    "actions: none",
  );
  assert.throws(() => verifyBuild209CIContract(insecure));
  const missing = structuredClone(inputs);
  missing.workflows["ci.yml"] = missing.workflows["ci.yml"].replace(
    "run: npm run build209:ci-contract",
    "run: true",
  );
  assert.throws(() => verifyBuild209CIContract(missing));
});
