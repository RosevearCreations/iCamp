import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readBuild206Inputs } from "./verify-build206-cache-contract.mjs";
import { verifyBuild216CIContract } from "./verify-build216-ci-contract.mjs";
import {
  analyzeBuild217Ci,
  summarizeRetentionDashboard,
} from "./build217-custody-retention-dashboard.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function verifyBuild217CIContract(inputs, history) {
  const prior = verifyBuild216CIContract(inputs, history);
  assert.equal(prior.requiredChecks, 5);
  assert.deepEqual(Object.keys(inputs.workflows).sort(), [
    "ci.yml",
    "codeql.yml",
    "secrets.yml",
  ]);
  assert.match(
    inputs.workflows["ci.yml"],
    /name: Verify Build 217 custody diversity and offline SLA dashboard safety\n\s+run: npm run build217:ci-contract/,
  );
  assert.doesNotMatch(
    inputs.workflows["ci.yml"],
    /continue-on-error:\s*true|schedule:\s*\n/,
  );
  const blank = summarizeRetentionDashboard({
    ledger: [],
    rotations: [],
    anchorPins: { signers: [] },
    expectedTail: "GENESIS",
    ownerReceipts: [],
    ownerPins: { signers: [] },
    ciEvidence: null,
  });
  assert.equal(blank.state, "OWNER_REVIEW_OR_EXTERNAL_EVIDENCE_HOLD");
  assert.equal(blank.productionApprovalGranted, false);
  assert.equal(blank.commsTestAuthorized, false);
  assert.equal(analyzeBuild217Ci(null).privateSignerKeysImported, false);
  return {
    requiredChecks: 5,
    additionalWorkflows: 0,
    noPrivateDataInCI: true,
    noFictitiousIndependentCustody: true,
    noAutomatedOwnerOrSourceRenewal: true,
    noCommsTestActivation: true,
  };
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const history = JSON.parse(
    readFileSync(
      resolve(ROOT, "fixtures/build210-reviewed-chromium-history.json"),
      "utf8",
    ),
  );
  console.log(
    "Build 217 protected contract:",
    JSON.stringify(verifyBuild217CIContract(readBuild206Inputs(), history)),
  );
}
