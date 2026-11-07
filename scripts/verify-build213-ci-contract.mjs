import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readBuild206Inputs } from "./verify-build206-cache-contract.mjs";
import { verifyBuild212CIContract } from "./verify-build212-ci-contract.mjs";
import { MAX_REVIEWED_RUNS } from "./build205-ci-runtime-diagnostics.mjs";
import { accrueFiveGateCohorts } from "./build213-cohort-custody-reconciliation.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function verifyBuild213CIContract(inputs, archivedHistory) {
  const previous = verifyBuild212CIContract(inputs, archivedHistory);
  assert.equal(previous.protectedRequiredChecks, 5);
  assert.equal(MAX_REVIEWED_RUNS, 30);
  const ci = inputs.workflows["ci.yml"];
  assert.match(
    ci,
    /name: Verify Build 213 cohort source and offline custody proof safety\n\s+run: npm run build213:ci-contract/,
  );
  assert.match(
    ci,
    /name: Capture Build 205 historical CI queue and runtime evidence[\s\S]*run: node scripts\/build205-ci-runtime-diagnostics\.mjs/,
  );
  assert.match(ci, /name: Upload Build 205 CI queue and runtime evidence/);
  assert.match(ci, /actions: read/);
  assert.doesNotMatch(ci, /continue-on-error:\s*true/);
  const none = accrueFiveGateCohorts([]);
  assert.equal(none.state, "COHORT_ACCRUAL_UNDER_REVIEW");
  assert.equal(none.stages.PR.needAdditionalCohorts, 3);
  assert.equal(none.stages.MAIN.needAdditionalCohorts, 3);
  assert.equal(none.automaticSlaAcceptance, false);
  return {
    fiveProtectedChecks: 5,
    protectedWorkflowCountUnchanged: true,
    auditedMaxCompletedRuns: MAX_REVIEWED_RUNS,
    ownerDecisionNotAutoSigned: true,
    externalArchiveNotAutoTrusted: true,
    noCommsHubTestActivation: true,
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
    "Build 213 protected contract:",
    JSON.stringify(verifyBuild213CIContract(readBuild206Inputs(), history)),
  );
}
