import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  analyzeChromiumInstallHistory,
  analyzeHistory,
  formatSummary,
} from "../scripts/build205-ci-runtime-diagnostics.mjs";
import {
  analyzeCacheBenefit,
  browserCacheProof,
  buildInstallEvidence,
  formatInstallSummary,
} from "../scripts/build208-browser-runtime-diagnostics.mjs";
import { verifyBuild208CIContract } from "../scripts/verify-build208-ci-contract.mjs";
import { readBuild206Inputs } from "../scripts/verify-build206-cache-contract.mjs";

const root = resolve(import.meta.dirname, "..");
const baseline = JSON.parse(
  readFileSync(
    resolve(root, "fixtures/build208-browser-cache-baseline.json"),
    "utf8",
  ),
);
const inputs = readBuild206Inputs();

function record(id, installSeconds, conclusion = "success", stage = "MAIN") {
  const first = Date.parse("2026-11-06T00:00:00Z") + id * 3600000;
  return {
    run: {
      id,
      name: "CI",
      event: stage === "MAIN" ? "push" : "pull_request",
      head_branch: stage === "MAIN" ? "main" : "dev",
      head_sha: `sha-${id}`,
      created_at: new Date(first).toISOString(),
      status: "completed",
      conclusion,
    },
    jobs: [
      {
        id: id * 100,
        name: "Browser end-to-end",
        conclusion,
        steps: [
          {
            name: "Install Chromium",
            conclusion,
            started_at: new Date(first + 1000).toISOString(),
            completed_at: new Date(
              first + (1000 + installSeconds * 1000),
            ).toISOString(),
          },
        ],
      },
    ],
  };
}

test("Build 208 pins the audited browser OS and exact-cache key without bypassing protected gates", () => {
  assert.equal(verifyBuild208CIContract(inputs).protectedRequiredJobs, 5);
  const floatingRunner = structuredClone(inputs);
  floatingRunner.workflows["ci.yml"] = floatingRunner.workflows[
    "ci.yml"
  ].replace("runs-on: ubuntu-24.04", "runs-on: ubuntu-latest");
  assert.throws(() => verifyBuild208CIContract(floatingRunner));
  const wrongOSKey = structuredClone(inputs);
  wrongOSKey.workflows["ci.yml"] = wrongOSKey.workflows["ci.yml"].replace(
    "ubuntu24.04-icamp-chromium-",
    "ubuntu26.04-icamp-chromium-",
  );
  assert.throws(() => verifyBuild208CIContract(wrongOSKey));
  const missingInstall = structuredClone(inputs);
  missingInstall.workflows["ci.yml"] = missingInstall.workflows[
    "ci.yml"
  ].replace("npx playwright install --with-deps chromium", "true");
  assert.throws(() => verifyBuild208CIContract(missingInstall));
});

test("Build 208 reports authentic cold, warm and slow mirror evidence with small-sample caveat", () => {
  const result = analyzeCacheBenefit(baseline);
  assert.equal(result.savedJobSeconds, 5);
  assert.equal(result.savedInstallSecondsAfterRestore, 4);
  assert.equal(result.coldMainInstallSeconds, 580);
  assert.equal(result.coldMainAptFetchSeconds, 563);
  assert.equal(result.status, "PROVISIONAL_TWO_PR_RUNS_NOT_ACCEPTED_SLA");
  assert.equal(result.cacheHitGrantsReleaseApproval, false);
  const fake = structuredClone(baseline);
  fake.stages.coldPR.result = "failure";
  assert.throws(() => analyzeCacheBenefit(fake));
});

test("Build 208 preserves fail-closed install outcome and precise runner cache evidence", () => {
  assert.equal(
    browserCacheProof({ cacheHit: "", restoreCompleted: true }),
    "MISS",
  );
  assert.equal(
    browserCacheProof({ cacheHit: "true", restoreCompleted: true }),
    "HIT",
  );
  assert.equal(
    browserCacheProof({ cacheHit: undefined, restoreCompleted: false }),
    "UNVERIFIED",
  );
  const fields = {
    startedAtMs: 10000,
    completedAtMs: 90000,
    installOutcome: "success",
    browserCache: "HIT",
    npmCache: "HIT",
    runnerOSVersion: "24.04",
    runId: "4222",
    commit: "abc123",
    benefit: analyzeCacheBenefit(baseline),
  };
  const normal = buildInstallEvidence(fields);
  assert.equal(normal.installSeconds, 80);
  assert.equal(normal.diagnosticState, "WITHIN_OBSERVATION_BUDGET");
  assert.match(formatInstallSummary(normal), /not an accepted SLA/);
  const delayed = buildInstallEvidence({ ...fields, completedAtMs: 600000 });
  assert.equal(delayed.diagnosticState, "COLD_RUNNER_INSTALL_REVIEW_REQUIRED");
  const failed = buildInstallEvidence({ ...fields, installOutcome: "failure" });
  assert.equal(
    failed.diagnosticState,
    "INSTALL_FAILED_REQUIRED_GATE_MUST_FAIL",
  );
  assert.equal(failed.releaseApprovalGranted, false);
  assert.throws(() => buildInstallEvidence({ ...fields, startedAtMs: NaN }));
});

test("Build 208 historical analysis sees actual 580s install outlier but never invents its cause", () => {
  const records = [
    record(1, 17, "success", "PR"),
    record(2, 9, "success", "PR"),
    record(3, 580),
  ];
  const analysis = analyzeChromiumInstallHistory(records);
  assert.equal(analysis.sampleCount, 3);
  assert.equal(analysis.outlierCount, 1);
  assert.equal(analysis.p90InstallSeconds, 580);
  assert.equal(analysis.state, "COLD_RUNNER_INSTALL_REVIEW_REQUIRED");
  assert.equal(analysis.rootCauseInferredFromStepTimes, false);
  assert.match(
    formatSummary(analyzeHistory(records)),
    /Chromium install history/,
  );
  const missing = analyzeChromiumInstallHistory([
    { run: { name: "CI" }, jobs: [] },
  ]);
  assert.equal(missing.state, "INSUFFICIENT_HISTORICAL_INSTALL_STEPS");
});
