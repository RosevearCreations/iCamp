import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readBuild206Inputs } from "./verify-build206-cache-contract.mjs";
import { verifyBuild211CIContract } from "./verify-build211-ci-contract.mjs";
import { analyzeBuild212 } from "./build212-escalation-custody.mjs";
import { analyzeHistoricalCacheRetention } from "./build210-queue-history-triage.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function verifyBuild212CIContract(inputs, archivedHistory) {
  const previous = verifyBuild211CIContract(inputs, archivedHistory);
  assert.equal(previous.fiveRequiredChecks, 5);
  const ci = inputs.workflows["ci.yml"];
  assert.match(
    ci,
    /name: Verify Build 212 escalation custody and signed owner decision safety\n\s+run: npm run build212:ci-contract/,
  );
  assert.match(
    ci,
    /if: always\(\)[\s\S]*run: node scripts\/build205-ci-runtime-diagnostics\.mjs/,
  );
  assert.match(ci, /name: Upload Build 205 CI queue and runtime evidence/);
  assert.match(ci, /actions: read/);
  assert.doesNotMatch(ci, /continue-on-error:\s*true/);
  const historic = analyzeHistoricalCacheRetention(archivedHistory);
  assert.equal(historic.ownerAcceptedSla, false);
  const build212 = analyzeBuild212({
    build211: {
      schema: "icamp.build211.runner-artifact-sla.v1",
      runnerContention: { delayedRequiredJobs: [] },
      artifactReview: {
        sources: archivedHistory.observations.map(({ artifactId }) => ({
          artifactId,
          status: "ORIGINAL_ARTIFACT_AVAILABLE",
        })),
        reviewedCount: archivedHistory.observations.length,
      },
      ownerSla: {
        state: "UNDER_REVIEW_OWNER_DECISION_REQUIRED",
        stages: {
          PR: { completeFiveGateCohorts: 2 },
          MAIN: { completeFiveGateCohorts: 1 },
        },
      },
    },
  });
  assert.equal(build212.ownerSlaDecision.authenticatedSignedDecision, false);
  assert.equal(build212.evidenceCustody.verifiedLongTermImmutableCopies, 0);
  assert.equal(build212.runnerEscalation.providerCasesFiled, 0);
  assert.equal(build212.noProtectedGateChanges, true);
  return {
    protectedRequiredChecks: 5,
    CIWorkflowCountUnchanged: true,
    noSyntheticOwnerSignature: true,
    noInferredLongTermCustody: true,
    noInventedProviderCase: true,
    commsHandshakeNotAuthorized: true,
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
    "Build 212 protected contract:",
    JSON.stringify(verifyBuild212CIContract(readBuild206Inputs(), history)),
  );
}
