import assert from "node:assert/strict";
import test from "node:test";
import {
  analyzeHistory,
  analyzeReleaseThroughput,
  formatSummary,
} from "../scripts/build205-ci-runtime-diagnostics.mjs";
import {
  buildCacheRecord,
  cacheState,
  formatCacheSummary,
} from "../scripts/build207-cache-witness.mjs";
import { verifyBuild207CacheContract } from "../scripts/verify-build207-cache-contract.mjs";
import { readBuild206Inputs } from "../scripts/verify-build206-cache-contract.mjs";

const digest = "a".repeat(64);
const workflows = readBuild206Inputs();
const three = ["Verify", "Browser end-to-end", "Database migrations"];

function promotion(commit, stage, number, completionLag = 110) {
  const main = stage === "MAIN";
  const timestamp = Date.parse("2026-11-06T00:00:00Z") + number * 3600000;
  const groups = [
    ["CI", three],
    ["Secret Scan", ["Gitleaks"]],
    ["CodeQL", ["Analyze JavaScript and TypeScript"]],
  ];
  return groups.map(([name, jobNames], index) => ({
    run: {
      name,
      id: number * 10 + index,
      head_sha: commit,
      event: main ? "push" : "pull_request",
      head_branch: main ? "main" : "dev",
      created_at: new Date(timestamp).toISOString(),
      status: "completed",
      conclusion: "success",
    },
    jobs: jobNames.map((jobName, j) => ({
      id: number * 100 + index * 10 + j,
      name: jobName,
      conclusion: "success",
      started_at: new Date(timestamp + 1000).toISOString(),
      completed_at: new Date(
        timestamp + (completionLag + index * 8 + j) * 1000,
      ).toISOString(),
    })),
  }));
}

test("Build 207 retains all five required protected CI jobs and exact-version Chromium cache", () => {
  assert.equal(verifyBuild207CacheContract(workflows).protectedJobs, 5);
  const unsafe = structuredClone(workflows);
  unsafe.workflows["ci.yml"] = unsafe.workflows["ci.yml"].replace(
    "hashFiles('package-lock.json')",
    "hashFiles('package.json')",
  );
  assert.throws(() => verifyBuild207CacheContract(unsafe));
  const missingBrowserInstall = structuredClone(workflows);
  missingBrowserInstall.workflows["ci.yml"] = missingBrowserInstall.workflows[
    "ci.yml"
  ].replace("npx playwright install --with-deps chromium", "true");
  assert.throws(() => verifyBuild207CacheContract(missingBrowserInstall));
});

test("Build 207 distinguishes observed HIT, MISS and absent signals without inventing trust", () => {
  assert.equal(cacheState("true"), "HIT");
  assert.equal(cacheState("false"), "MISS");
  assert.equal(cacheState(undefined), "UNVERIFIED");
  const record = buildCacheRecord({
    lane: "browser",
    npmHit: "true",
    browserHit: "false",
    lockSha256: digest,
    browserExecutableVerified: true,
  });
  assert.equal(record.npmCache, "HIT");
  assert.equal(record.browserCache, "MISS");
  assert.equal(record.cacheHitIsNotReleaseApproval, true);
  assert.match(formatCacheSummary(record), /mandatory installation/);
  assert.throws(() =>
    buildCacheRecord({ lane: "browser", lockSha256: digest }),
  );
  assert.throws(() =>
    buildCacheRecord({ lane: "verify", lockSha256: "not_sha" }),
  );
});

test("Build 207 measures GitHub five-check completion for PR and main separately", () => {
  const records = [
    ...promotion("abc1", "PR", 1, 100),
    ...promotion("abc2", "PR", 2, 120),
    ...promotion("def1", "MAIN", 3, 140),
    ...promotion("def2", "MAIN", 4, 160),
  ];
  const measured = analyzeReleaseThroughput(records);
  assert.equal(measured.stages.PR.completedPromotions, 2);
  assert.equal(measured.stages.MAIN.completedPromotions, 2);
  assert.equal(measured.stages.MAIN.p90Seconds, 176);
  assert.equal(measured.stages.MAIN.state, "OBSERVED_BASELINE");
  assert.equal(measured.includesVercelDeployment, false);
  assert.equal(measured.productionReleaseAuthorized, false);
  assert.match(
    formatSummary(analyzeHistory(records)),
    /complete protected-gate throughput/,
  );
});

test("Build 207 excludes missing, failed, and incomplete protected gates", () => {
  const incomplete = promotion("bad", "PR", 1);
  incomplete[1].jobs[0].conclusion = "failure";
  const measured = analyzeReleaseThroughput(incomplete);
  assert.equal(measured.stages.PR.completedPromotions, 0);
  assert.equal(measured.groups[0].gateSeconds, null);
  assert.deepEqual(measured.groups[0].missing, ["Secret Scan / Gitleaks"]);
  assert.equal(measured.stages.PR.state, "INSUFFICIENT_COMPLETE_PROMOTIONS");
  const missingCodeQL = promotion("missing", "MAIN", 1).slice(0, 2);
  assert.equal(
    analyzeReleaseThroughput(missingCodeQL).stages.MAIN.completedPromotions,
    0,
  );
});
