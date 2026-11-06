import assert from "node:assert/strict";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readBuild206Inputs } from "./verify-build206-cache-contract.mjs";
import { verifyBuild208CIContract } from "./verify-build208-ci-contract.mjs";
import {
  LOG_SAMPLE_LIMIT,
  MIRROR_STALL_SECONDS,
  PROMOTION_MONITORING_BUDGET_SECONDS,
} from "./build209-release-trends.mjs";

export function verifyBuild209CIContract(inputs) {
  const base = verifyBuild208CIContract(inputs);
  const ci = inputs.workflows["ci.yml"];
  assert.match(
    ci,
    /name: Verify Build 209 cross-release monitoring and protected SLA contract\n\s+run: npm run build209:ci-contract/,
  );
  assert.match(
    ci,
    /name: Capture Build 205 historical CI queue and runtime evidence\n\s+if: always\(\)\n\s+env:\n\s+GITHUB_TOKEN: \$\{\{ github\.token \}\}\n\s+run: node scripts\/build205-ci-runtime-diagnostics\.mjs/,
  );
  assert.match(ci, /actions: read/);
  assert.match(ci, /name: Upload Build 205 CI queue and runtime evidence/);
  assert.doesNotMatch(ci, /continue-on-error:\s*true/);
  assert.ok(LOG_SAMPLE_LIMIT <= 4);
  assert.equal(MIRROR_STALL_SECONDS, 120);
  assert.equal(PROMOTION_MONITORING_BUDGET_SECONDS.PR, 900);
  assert.equal(PROMOTION_MONITORING_BUDGET_SECONDS.MAIN, 900);
  return {
    ...base,
    boundedReadOnlyLogInspection: true,
    existingCIWorkflowsOnly: true,
    promotionBudgetsAreDiagnosticOnly: true,
  };
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  console.log(
    "Build 209 protected contract:",
    JSON.stringify(verifyBuild209CIContract(readBuild206Inputs())),
  );
}
