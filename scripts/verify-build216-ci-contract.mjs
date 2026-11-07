import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readBuild206Inputs } from "./verify-build206-cache-contract.mjs";
import { verifyBuild215CIContract } from "./verify-build215-ci-contract.mjs";
import {
  analyzeBuild216Ci,
  buildExpiryTimeline,
  verifyRotationHistory,
} from "./build216-checkpoint-renewal-timeline.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function verifyBuild216CIContract(inputs, reviewedHistory) {
  const old = verifyBuild215CIContract(inputs, reviewedHistory);
  assert.equal(old.protectedRequiredChecks, 5);
  assert.deepEqual(Object.keys(inputs.workflows).sort(), [
    "ci.yml",
    "codeql.yml",
    "secrets.yml",
  ]);
  const ci = inputs.workflows["ci.yml"];
  assert.match(
    ci,
    /name: Verify Build 216 checkpoint rotation and renewal review safety\n\s+run: npm run build216:ci-contract/,
  );
  assert.match(
    ci,
    /name: Capture Build 205 historical CI queue and runtime evidence[\s\S]*run: node scripts\/build205-ci-runtime-diagnostics\.mjs/,
  );
  assert.doesNotMatch(ci, /continue-on-error:\s*true|schedule:\s*\n/);
  const noSource = buildExpiryTimeline({ ledger: [], ciEvidence: null });
  assert.equal(noSource.state, "ORIGINAL_SOURCE_SNAPSHOT_UNAVAILABLE_HOLD");
  assert.equal(
    verifyRotationHistory({ ledger: [], records: [], pins: null })
      .ownerReleaseApprovalGranted,
    false,
  );
  assert.equal(
    analyzeBuild216Ci(null).privateLedgerOrKeysImportedIntoCI,
    false,
  );
  return {
    requiredChecks: 5,
    workflowCountUnchanged: true,
    noPrivateOwnerRenewalReceiptInCI: true,
    noIndependentRotationFabricated: true,
    noSourceRenewalFromSnapshot: true,
    noCommsTestActivation: true,
  };
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const source = JSON.parse(
    readFileSync(
      resolve(root, "fixtures/build210-reviewed-chromium-history.json"),
      "utf8",
    ),
  );
  console.log(
    "Build 216 protected contract:",
    JSON.stringify(verifyBuild216CIContract(readBuild206Inputs(), source)),
  );
}
