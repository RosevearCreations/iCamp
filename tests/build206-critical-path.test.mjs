import assert from "node:assert/strict";
import test from "node:test";
import {
  analyzeHistory,
  analyzeProtectedTrends,
  formatSummary,
} from "../scripts/build205-ci-runtime-diagnostics.mjs";
import {
  readBuild206Inputs,
  verifyBuild206CacheContract,
} from "../scripts/verify-build206-cache-contract.mjs";

const baseline = readBuild206Inputs();

function record(id, queue, runtime, name = "Verify", conclusion = "success") {
  const created = Date.parse("2026-11-06T00:00:00Z") + id * 3600000;
  return {
    run: {
      id,
      name: "CI",
      created_at: new Date(created).toISOString(),
    },
    jobs: [
      {
        name,
        conclusion,
        started_at: new Date(created + queue * 1000).toISOString(),
        completed_at: new Date(
          created + (queue + runtime) * 1000,
        ).toISOString(),
      },
    ],
  };
}

test("Build 206 pins SHA-512 npm integrity and preserves every security gate", () => {
  const result = verifyBuild206CacheContract(baseline);
  assert.equal(result.checkedJobs, 3);
  assert.equal(result.protectedGates, 5);
  assert.ok(result.lockedPackages > 200);
});

test("Build 206 rejects restoring unpinned npm installs or excluding migration checks", () => {
  const changed = structuredClone(baseline);
  changed.workflows["ci.yml"] = changed.workflows["ci.yml"].replace(
    "npm ci --ignore-scripts",
    "npm install --ignore-scripts",
  );
  assert.throws(() => verifyBuild206CacheContract(changed));
  const migrationRemoval = structuredClone(baseline);
  migrationRemoval.workflows["ci.yml"] = migrationRemoval.workflows[
    "ci.yml"
  ].replace("name: Apply migrations", "name: Removed migration checks");
  assert.throws(() => verifyBuild206CacheContract(migrationRemoval));
});

test("Build 206 rejects caches without reviewed lockfile input or missing integrity", () => {
  const cacheDrift = structuredClone(baseline);
  cacheDrift.workflows["ci.yml"] = cacheDrift.workflows["ci.yml"].replace(
    "cache-dependency-path: package-lock.json",
    "cache-dependency-path: package.json",
  );
  assert.throws(() => verifyBuild206CacheContract(cacheDrift));
  const badLock = structuredClone(baseline);
  const first = Object.keys(badLock.lock.packages).find(
    (key) => key.length > 0,
  );
  badLock.lock.packages[first].integrity = "not-an-integrity-digest";
  assert.throws(() => verifyBuild206CacheContract(badLock));
});

test("Build 206 treats fewer than two successful samples per window as unaccepted", () => {
  const incomplete = analyzeProtectedTrends([
    record(1, 50, 150),
    record(2, 40, 140),
    record(3, 30, 130),
  ]);
  assert.equal(incomplete.state, "INSUFFICIENT_WINDOW_EVIDENCE");
  assert.equal(
    incomplete.checks["CI / Verify"].status,
    "INSUFFICIENT_TREND_EVIDENCE",
  );
  assert.equal(incomplete.releaseGateChanged, false);
  assert.equal(incomplete.acceptedByOwner, false);
});

test("Build 206 recognizes stable trend without manufacturing release approval", () => {
  const history = [
    record(1, 100, 300),
    record(2, 110, 320),
    record(3, 100, 300),
    record(4, 105, 300),
  ];
  const trend = analyzeProtectedTrends(history);
  assert.equal(trend.checks["CI / Verify"].previousQueueP90Seconds, 110);
  assert.equal(trend.checks["CI / Verify"].recentQueueP90Seconds, 105);
  assert.equal(
    trend.checks["CI / Verify"].status,
    "MONITORING_TREND_ACCEPTABLE",
  );
  assert.equal(trend.acceptedByOwner, false);
  assert.match(formatSummary(analyzeHistory(history)), /Prior queue p90/);
});

test("Build 206 flags meaningful queue/runtime regressions and rejects failed samples", () => {
  const history = [
    record(1, 100, 300),
    record(2, 100, 300),
    record(3, 200, 480),
    record(4, 240, 490),
    record(5, 9000, 1, "Verify", "failure"),
  ];
  const trend = analyzeProtectedTrends(history);
  assert.equal(trend.state, "REVIEW_REQUIRED");
  assert.equal(trend.checks["CI / Verify"].recentQueueP90Seconds, 240);
  assert.equal(
    trend.checks["CI / Verify"].status,
    "OWNER_PERFORMANCE_REVIEW_REQUIRED",
  );
});
