import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readBuild206Inputs } from "./verify-build206-cache-contract.mjs";
import { verifyBuild213CIContract } from "./verify-build213-ci-contract.mjs";
import {
  analyzeBuild214Aging,
  verifyRegistrationLedger,
} from "./build214-owner-custody-register.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function verifyBuild214CIContract(inputs, archivedHistory) {
  const old = verifyBuild213CIContract(inputs, archivedHistory);
  assert.equal(old.fiveProtectedChecks, 5);
  assert.deepEqual(Object.keys(inputs.workflows).sort(), [
    "ci.yml",
    "codeql.yml",
    "secrets.yml",
  ]);
  const ci = inputs.workflows["ci.yml"];
  assert.match(
    ci,
    /name: Verify Build 214 external-registration and evidence-aging safety\n\s+run: npm run build214:ci-contract/,
  );
  assert.match(
    ci,
    /name: Capture Build 205 historical CI queue and runtime evidence[\s\S]*run: node scripts\/build205-ci-runtime-diagnostics\.mjs/,
  );
  assert.doesNotMatch(ci, /continue-on-error:\s*true/);
  assert.doesNotMatch(ci, /schedule:\s*\n/);
  const missing = analyzeBuild214Aging(null);
  assert.equal(
    missing.state,
    "ORIGINAL_ARTIFACT_SOURCE_UNAVAILABLE_REVIEW_REQUIRED",
  );
  assert.equal(missing.automatedApproval, false);
  assert.equal(verifyRegistrationLedger([]).productionApprovalGranted, false);
  return {
    protectedRequiredChecks: 5,
    protectedWorkflowCountUnchanged: true,
    noPrivateKeysOrOriginalArchiveInCI: true,
    noAutomaticOwnerSlaAcceptance: true,
    offlineRegistrationDoesNotActivateComms: true,
    originalExpiryWarningsAreReadOnly: true,
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
    "Build 214 protected contract:",
    JSON.stringify(verifyBuild214CIContract(readBuild206Inputs(), history)),
  );
}
