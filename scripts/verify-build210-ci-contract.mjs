import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readBuild206Inputs } from "./verify-build206-cache-contract.mjs";
import { verifyBuild209CIContract } from "./verify-build209-ci-contract.mjs";
import {
  analyzeHistoricalCacheRetention,
  validateReviewedChromiumHistory,
} from "./build210-queue-history-triage.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function verifyBuild210CIContract(inputs, history) {
  const previous = verifyBuild209CIContract(inputs);
  assert.equal(previous.protectedRequiredJobs, 5);
  const ci = inputs.workflows["ci.yml"];
  assert.match(
    ci,
    /name: Verify Build 210 reviewed history and protected queue diagnostics\n\s+run: npm run build210:ci-contract/,
  );
  assert.match(
    ci,
    /if: always\(\)[\s\S]*run: node scripts\/build205-ci-runtime-diagnostics\.mjs/,
  );
  assert.match(ci, /name: Upload Build 205 CI queue and runtime evidence/);
  assert.doesNotMatch(ci, /continue-on-error:\s*true/);
  const observations = validateReviewedChromiumHistory(history);
  const uniqueArtifactIds = new Set(
    observations.map((item) => item.artifactId),
  );
  assert.equal(uniqueArtifactIds.size, observations.length);
  const reported = analyzeHistoricalCacheRetention(history);
  assert.ok(reported.byRunnerOS["24.04"].coldSamples >= 2);
  assert.ok(reported.byRunnerOS["24.04"].warmSamples >= 2);
  assert.equal(reported.ownerAcceptedSla, false);
  return {
    fiveRequiredChecks: previous.protectedRequiredJobs,
    reviewedArtifacts: observations.length,
    runnerOS: "24.04",
    historicalCacheState: reported.state,
    monitoringOnly: true,
  };
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const history = JSON.parse(
    readFileSync(
      resolve(root, "fixtures/build210-reviewed-chromium-history.json"),
      "utf8",
    ),
  );
  console.log(
    "Build 210 protected contract:",
    JSON.stringify(verifyBuild210CIContract(readBuild206Inputs(), history)),
  );
}
