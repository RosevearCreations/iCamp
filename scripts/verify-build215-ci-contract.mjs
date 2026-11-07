import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readBuild206Inputs } from "./verify-build206-cache-contract.mjs";
import { verifyBuild214CIContract } from "./verify-build214-ci-contract.mjs";
import {
  analyzeBuild215Ci,
  triageCustodianRenewals,
  triageOwnerSlaExpiry,
} from "./build215-independent-anchor-triage.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function verifyBuild215CIContract(inputs, archivedHistory) {
  const previous = verifyBuild214CIContract(inputs, archivedHistory);
  assert.equal(previous.protectedRequiredChecks, 5);
  assert.deepEqual(Object.keys(inputs.workflows).sort(), [
    "ci.yml",
    "codeql.yml",
    "secrets.yml",
  ]);
  const ci = inputs.workflows["ci.yml"];
  assert.match(
    ci,
    /name: Verify Build 215 independent anchor and owner expiry safety\n\s+run: npm run build215:ci-contract/,
  );
  assert.match(
    ci,
    /name: Capture Build 205 historical CI queue and runtime evidence[\s\S]*run: node scripts\/build205-ci-runtime-diagnostics\.mjs/,
  );
  assert.doesNotMatch(ci, /continue-on-error:\s*true|schedule:\s*\n/);
  const empty = analyzeBuild215Ci(null);
  assert.equal(empty.ownerSignedAnchorVerifiedInCI, false);
  assert.equal(empty.privateKeysOrLedgerImportedIntoCI, false);
  assert.equal(
    triageCustodianRenewals([]).actualIndependentStorageVerified,
    false,
  );
  assert.equal(triageOwnerSlaExpiry([]).automaticSlaAcceptance, false);
  return {
    protectedRequiredChecks: 5,
    workflowCountUnchanged: true,
    noAutomaticAnchorTrust: true,
    noOwnerSlaDecisionSupersession: true,
    noPrivateLedgerInCI: true,
    originalArtifactAgingPreserved: true,
    commsTestRemainsHeld: true,
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
    "Build 215 protected contract:",
    JSON.stringify(verifyBuild215CIContract(readBuild206Inputs(), history)),
  );
}
