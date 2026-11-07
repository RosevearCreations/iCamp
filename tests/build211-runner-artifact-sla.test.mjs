import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  analyzeRunnerContention,
  analyzeBuild211,
  buildOwnerSlaPacket,
  fetchReviewedArtifactMetadata,
  normalizeArtifactResponse,
  reviewArtifactRenewal,
} from "../scripts/build211-runner-artifact-sla.mjs";
import {
  analyzeHistory,
  formatSummary,
} from "../scripts/build205-ci-runtime-diagnostics.mjs";
import { analyzeBuild210 } from "../scripts/build210-queue-history-triage.mjs";
import { verifyBuild211CIContract } from "../scripts/verify-build211-ci-contract.mjs";
import { readBuild206Inputs } from "../scripts/verify-build206-cache-contract.mjs";

const archive = JSON.parse(
  readFileSync(
    resolve(
      import.meta.dirname,
      "../fixtures/build210-reviewed-chromium-history.json",
    ),
    "utf8",
  ),
);
const reviewedAt = Date.parse("2026-11-07T00:00:00Z");
const metadata = (observation, days, digest = observation.artifactDigest) => ({
  artifactId: observation.artifactId,
  name: "build208-chromium-install-evidence",
  createdAt: "2026-11-06T00:00:00Z",
  expiresAt: new Date(reviewedAt + days * 86_400_000).toISOString(),
  expired: days <= 0,
  sizeBytes: 450,
  digest,
});
const withStages = (states) => ({
  throughput: {
    groups: states.map(([stage, gateSeconds], i) => ({
      stage,
      state: "ALL_FIVE_CHECKS_OBSERVED",
      gateSeconds,
      commit: String(i).padStart(40, "0"),
      runIds: [i + 1],
    })),
  },
});
const noExceptions = { exceptionCount: 0 };

test("Build 211 retains runner assignment witness while refusing to infer pool saturation", () => {
  const rows = [
    {
      run: { id: 1, name: "CI", created_at: "2026-11-07T00:00:00Z" },
      jobs: [
        {
          id: 99,
          name: "Browser end-to-end",
          started_at: "2026-11-07T00:15:00Z",
          completed_at: "2026-11-07T00:16:00Z",
          conclusion: "success",
          runner_name: "GitHub Actions 9",
          runner_group_name: "GitHub Actions",
          labels: ["ubuntu-24.04"],
        },
      ],
    },
  ];
  const historical = analyzeHistory(rows);
  const report = analyzeRunnerContention(rows, historical);
  assert.equal(report.delayedRequiredJobs.length, 1);
  assert.equal(
    report.delayedRequiredJobs[0].assignmentWitness.runnerName,
    "GitHub Actions 9",
  );
  assert.equal(
    report.state,
    "OBSERVED_DELAY_REQUIRES_RUNNER_CAPACITY_SOURCE_REVIEW",
  );
  assert.equal(report.actualRunnerSaturationProven, false);
  assert.equal(report.githubHostedRunnerPoolCapacityExposed, false);
});

test("Build 211 quarantines missing metadata, expiry, and digests without overwriting old artifacts", () => {
  const latest = archive.observations;
  const rows = [
    metadata(latest[0], 12),
    metadata(latest[1], 4),
    metadata(latest[2], -1),
    metadata(latest[3], 12, `sha256:${"0".repeat(64)}`),
  ];
  const report = reviewArtifactRenewal(archive, rows, reviewedAt);
  assert.equal(report.expiringCount, 1);
  assert.equal(report.expiredCount, 1);
  assert.equal(report.unavailableOrConflicted, 1);
  assert.equal(report.sources[3].status, "DIGEST_CONFLICT_QUARANTINED");
  assert.equal(report.originalArtifactsRenewed, false);
  assert.equal(report.ownerRetentionApprovalGranted, false);
  const absent = reviewArtifactRenewal(archive, rows.slice(0, 1), reviewedAt);
  assert.equal(absent.unavailableOrConflicted, 3);
  const duplicated = reviewArtifactRenewal(
    archive,
    [rows[0], rows[0]],
    reviewedAt,
  );
  assert.equal(
    duplicated.sources[0].status,
    "SOURCE_UNAVAILABLE_RENEWAL_REVIEW",
  );
});

test("Build 211 validates artifact identity and refuses arbitrary metadata", () => {
  const item = archive.observations[0];
  const valid = {
    id: item.artifactId,
    name: "build208-chromium-install-evidence",
    expired: false,
    created_at: "2026-11-06T00:00:00Z",
    expires_at: "2026-11-20T00:00:00Z",
    size_in_bytes: 100,
    digest: item.artifactDigest,
  };
  assert.equal(
    normalizeArtifactResponse(valid, item.artifactId).digest,
    item.artifactDigest,
  );
  assert.throws(() =>
    normalizeArtifactResponse({ ...valid, id: 0 }, item.artifactId),
  );
  assert.throws(() =>
    normalizeArtifactResponse({ ...valid, expired: "false" }, item.artifactId),
  );
});

test("Build 211 bounds metadata queries, including authenticated source errors", async () => {
  let calls = 0;
  const samples = await fetchReviewedArtifactMetadata(archive, {
    repository: "RosevearCreations/iCamp",
    token: "test-only",
    fetchImpl: async (url) => {
      calls++;
      const id = Number(url.split("/").at(-1));
      const item = archive.observations.find((row) => row.artifactId === id);
      return {
        ok: true,
        json: async () => ({
          id,
          name: "build208-chromium-install-evidence",
          expired: false,
          created_at: "2026-11-06T00:00:00Z",
          expires_at: "2026-11-20T00:00:00Z",
          size_in_bytes: 100,
          digest: item.artifactDigest,
        }),
      };
    },
  });
  assert.equal(calls, 4);
  assert.equal(samples.length, 4);
  assert.equal(samples.filter((row) => row.sourceFailure).length, 0);
  const missing = await fetchReviewedArtifactMetadata(archive, {
    token: "",
    repository: "RosevearCreations/iCamp",
  });
  assert.equal(missing.length, 4);
  assert.match(missing[0].sourceFailure, /UNAVAILABLE/);
});

test("Build 211 owner packet never auto-accepts an SLA even with complete samples", () => {
  const stages = ["PR", "MAIN"].flatMap((stage) =>
    [150, 180, 220].map((n) => [stage, n]),
  );
  const history = withStages(stages);
  const runnerContention = { delayedRequiredJobs: [] };
  const artifactReview = {
    state: "ORIGINAL_ARTIFACTS_CURRENT_RENEWAL_NOT_NEEDED",
    unavailableOrConflicted: 0,
  };
  const packet = buildOwnerSlaPacket({
    history,
    runnerContention,
    artifactReview,
    latencyExceptions: noExceptions,
  });
  assert.equal(packet.state, "READY_FOR_OWNER_REVIEW_NOT_APPROVED");
  assert.equal(packet.decision.status, "NOT_SIGNED");
  assert.equal(packet.productionReleaseAuthorized, false);
  assert.equal(packet.commsTestHandshakeAuthorized, false);
  const slow = buildOwnerSlaPacket({
    history: withStages([...stages, ["MAIN", 1200]]),
    runnerContention,
    artifactReview,
    latencyExceptions: noExceptions,
  });
  assert.equal(slow.stages.MAIN.state, "OBSERVED_SLA_BUDGET_BREACH");
  assert.equal(slow.state, "UNDER_REVIEW_OWNER_DECISION_REQUIRED");
  const sparse = buildOwnerSlaPacket({
    history: withStages([["PR", 200]]),
    runnerContention,
    artifactReview,
    latencyExceptions: noExceptions,
  });
  assert.equal(
    sparse.stages.MAIN.state,
    "INSUFFICIENT_COHORTS_FOR_OWNER_ACCEPTANCE",
  );
});

test("Build 211 is fail-closed monitoring within existing five protected checks", () => {
  const result = verifyBuild211CIContract(readBuild206Inputs(), archive);
  assert.equal(result.fiveRequiredChecks, 5);
  const historical = analyzeHistory([]);
  historical.build210 = analyzeBuild210({
    history: archive,
    logRecords: [],
    runJobs: [],
    historical,
  });
  historical.build211 = analyzeBuild211({
    history: archive,
    historical,
    runJobs: [],
    artifactMetadata: [],
    now: reviewedAt,
  });
  assert.match(formatSummary(historical), /Build 211/);
  assert.match(formatSummary(historical), /NOT_SIGNED/);
  const missing = structuredClone(readBuild206Inputs());
  missing.workflows["ci.yml"] = missing.workflows["ci.yml"].replace(
    "run: npm run build211:ci-contract",
    "run: true",
  );
  assert.throws(() => verifyBuild211CIContract(missing, archive));
});
