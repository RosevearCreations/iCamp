import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readBuild206Inputs } from "./verify-build206-cache-contract.mjs";
import { verifyBuild217CIContract } from "./verify-build217-ci-contract.mjs";
import {
  analyzeBuild218Ci,
  createSourceRecheckSchedule,
} from "./build218-source-recheck-portability.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function verifyBuild218CIContract(inputs, history) {
  const prior = verifyBuild217CIContract(inputs, history);
  assert.equal(prior.requiredChecks, 5);
  assert.deepEqual(Object.keys(inputs.workflows).sort(), [
    "ci.yml",
    "codeql.yml",
    "secrets.yml",
  ]);
  const ci = inputs.workflows["ci.yml"];
  assert.match(
    ci,
    /name: Verify Build 218 owner-scoped source recheck and evidence portability safety\n\s+run: npm run build218:ci-contract/,
  );
  assert.doesNotMatch(ci, /continue-on-error:\s*true|schedule:\s*\n/);
  const blank = createSourceRecheckSchedule({
    ledger: [],
    ciEvidence: null,
    ownerReceipts: [],
    ownerPins: { schema: "icamp.build216.owner-renewal-pins.v1", signers: [] },
  });
  assert.equal(blank.state, "ORIGINAL_GITHUB_SOURCE_SNAPSHOT_UNAVAILABLE_HOLD");
  assert.equal(blank.automaticNetworkCalls, false);
  assert.equal(blank.commsTestAuthorized, false);
  assert.equal(analyzeBuild218Ci(null).privateOwnerKeysImported, false);
  return {
    requiredChecks: 5,
    newWorkflowsOrCronSchedules: 0,
    noFakeSourceOrOwnerRecheckInCI: true,
    noPrivateCredentialsOrReceiptsInCI: true,
    readOnlyRecheckRequiresOwnerApproval: true,
    noUnattendedExternalNetworkAccess: true,
    noAutomaticRetentionRenewalOrCommsActivation: true,
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
    "Build 218 protected contract:",
    JSON.stringify(verifyBuild218CIContract(readBuild206Inputs(), history)),
  );
}
