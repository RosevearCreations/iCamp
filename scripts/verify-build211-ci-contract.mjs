import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readBuild206Inputs } from "./verify-build206-cache-contract.mjs";
import { verifyBuild210CIContract } from "./verify-build210-ci-contract.mjs";
import { reviewArtifactRenewal } from "./build211-runner-artifact-sla.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function verifyBuild211CIContract(inputs, archivedHistory) {
  const prior = verifyBuild210CIContract(inputs, archivedHistory);
  assert.equal(prior.fiveRequiredChecks, 5);
  const ci = inputs.workflows["ci.yml"];
  assert.match(
    ci,
    /name: Verify Build 211 runner and artifact SLA evidence safety\n\s+run: npm run build211:ci-contract/,
  );
  assert.match(
    ci,
    /name: Capture Build 205 historical CI queue and runtime evidence[\s\S]*run: node scripts\/build205-ci-runtime-diagnostics\.mjs/,
  );
  assert.match(ci, /name: Upload Build 205 CI queue and runtime evidence/);
  assert.match(ci, /actions: read/);
  assert.doesNotMatch(ci, /continue-on-error:\s*true/);
  const allMissing = reviewArtifactRenewal(archivedHistory, []);
  assert.equal(allMissing.reviewedCount, archivedHistory.observations.length);
  assert.equal(
    allMissing.unavailableOrConflicted,
    archivedHistory.observations.length,
  );
  assert.equal(allMissing.ownerRetentionApprovalGranted, false);
  assert.equal(allMissing.originalArtifactsRenewed, false);
  assert.equal(allMissing.retentionExtended, false);
  return {
    fiveRequiredChecks: 5,
    preservedGitHubWorkflowCount: 3,
    originalArtifactsReviewCount: allMissing.reviewedCount,
    runnerPoolCapacityNotInferred: true,
    ownerSlaNotAutoAccepted: true,
    monitoringOnly: true,
  };
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const archive = JSON.parse(
    readFileSync(
      resolve(root, "fixtures/build210-reviewed-chromium-history.json"),
      "utf8",
    ),
  );
  console.log(
    "Build 211 protected contract:",
    JSON.stringify(verifyBuild211CIContract(readBuild206Inputs(), archive)),
  );
}
