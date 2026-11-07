import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readBuild206Inputs } from "./verify-build206-cache-contract.mjs";
import { verifyBuild219CIContract } from "./verify-build219-ci-contract.mjs";
import { analyzeBuild220Ci } from "./build220-byte-custody-closure.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export function verifyBuild220CIContract(inputs, history) {
  const previous = verifyBuild219CIContract(inputs, history);
  assert.equal(previous.requiredChecks, 5);
  assert.deepEqual(Object.keys(inputs.workflows).sort(), [
    "ci.yml",
    "codeql.yml",
    "secrets.yml",
  ]);
  const workflow = inputs.workflows["ci.yml"];
  assert.match(
    workflow,
    /name: Verify Build 220 original ZIP readback and independent offline closure safety\n\s+run: npm run build220:ci-contract/,
  );
  assert.doesNotMatch(workflow, /continue-on-error:\s*true|schedule:\s*\n/);
  const result = analyzeBuild220Ci(null);
  assert.equal(result.originalArtifactBytesInCi, false);
  assert.equal(result.privateOwnerOrCustodianKeysInCi, false);
  assert.equal(result.automatedOwnerClosure, false);
  assert.equal(result.commsTestAuthorized, false);
  return {
    requiredChecks: 5,
    newWorkflowsOrCronSchedules: 0,
    realArchiveBytesAndPrivateKeysNeverLoadedIntoCI: true,
    localByteDigestCannotEstablishOriginalSourceOrOffsiteDurability: true,
    distinctPinnedSignersAndOwnerClosureRequired: true,
    allRetentionClosureStatesRemainFailClosed: true,
    noAutomaticSourceWritesOrCommsTest: true,
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
    "Build 220 protected contract:",
    JSON.stringify(verifyBuild220CIContract(readBuild206Inputs(), history)),
  );
}
