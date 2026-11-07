import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readBuild206Inputs } from "./verify-build206-cache-contract.mjs";
import { verifyBuild220CIContract } from "./verify-build220-ci-contract.mjs";
import { analyzeBuild221Ci } from "./build221-provenance-retention-audit.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export function verifyBuild221CIContract(inputs, history) {
  const previous = verifyBuild220CIContract(inputs, history);
  assert.equal(previous.requiredChecks, 5);
  assert.deepEqual(Object.keys(inputs.workflows).sort(), [
    "ci.yml",
    "codeql.yml",
    "secrets.yml",
  ]);
  const workflow = inputs.workflows["ci.yml"];
  assert.match(
    workflow,
    /name: Verify Build 221 independent provenance and retention review safety\n\s+run: npm run build221:ci-contract/,
  );
  assert.doesNotMatch(workflow, /continue-on-error:\s*true|schedule:\s*\n/);
  const analysis = analyzeBuild221Ci();
  assert.equal(analysis.externalOriginalEvidenceImportedToCI, false);
  assert.equal(analysis.originalPrivateSigningKeysInCI, false);
  assert.equal(analysis.autonomousConnectionAllowed, false);
  assert.equal(analysis.retentionAutomaticallyClosed, false);
  assert.equal(analysis.allFiveProtectedChecksPreserved, true);
  return {
    requiredChecks: 5,
    newlyScheduledWorkflows: 0,
    independentSourceReviewKeyAndArchiveReviewerKeyRemainExternal: true,
    noOriginalGitHubIssuerOrOffsiteDurabilityInvented: true,
    connectedCount: 0,
    connectionState: "DISCONNECTED / HOLD",
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
    "Build 221 protected contract:",
    JSON.stringify(verifyBuild221CIContract(readBuild206Inputs(), history)),
  );
}
