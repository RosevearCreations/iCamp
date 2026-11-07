import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readBuild206Inputs } from "./verify-build206-cache-contract.mjs";
import { verifyBuild218CIContract } from "./verify-build218-ci-contract.mjs";
import { analyzeBuild219Ci } from "./build219-runner-manifest-closure.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function verifyBuild219CIContract(inputs, history) {
  const previous = verifyBuild218CIContract(inputs, history);
  assert.equal(previous.requiredChecks, 5);
  assert.deepEqual(Object.keys(inputs.workflows).sort(), [
    "ci.yml",
    "codeql.yml",
    "secrets.yml",
  ]);
  const workflow = inputs.workflows["ci.yml"];
  assert.match(
    workflow,
    /name: Verify Build 219 separate runner and manifest signatures with fail-closed retention review\n\s+run: npm run build219:ci-contract/,
  );
  assert.doesNotMatch(workflow, /continue-on-error:\s*true|schedule:\s*\n/);
  const result = analyzeBuild219Ci(null);
  assert.equal(result.externalSourceReadsInCi, false);
  assert.equal(result.privateSignerKeysOrOwnerReceiptsInCi, false);
  assert.equal(result.automaticExceptionClosure, false);
  assert.equal(result.commsTestAuthorized, false);
  return {
    requiredChecks: 5,
    newWorkflowsOrCronSchedules: 0,
    noPrivateRunnerKeysOrSignedOwnerReceiptsInCI: true,
    noIndependentSignaturesFabricatedByCI: true,
    portableDigestMustBeSignedBySeparatePinnedCustodian: true,
    archiveStorageAndOriginalBytesStillRequireExternalProof: true,
    exceptionClosureRemainsOwnerGoverned: true,
    noAutomaticCommsOrRetentionStateChanges: true,
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
    "Build 219 protected contract:",
    JSON.stringify(verifyBuild219CIContract(readBuild206Inputs(), history)),
  );
}
