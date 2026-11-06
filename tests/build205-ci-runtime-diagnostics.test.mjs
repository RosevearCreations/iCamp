import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  analyzeHistory,
  fetchGitHubHistory,
  formatSummary,
  percentile,
  REQUIRED_CHECK_BUDGETS,
  REQUIRED_WORKFLOWS,
  safeSeconds,
} from "../scripts/build205-ci-runtime-diagnostics.mjs";

const run = (id, name = "CI") => ({
  id,
  name,
  created_at: "2026-11-05T12:00:00Z",
  head_sha: "synthetic-sha",
  head_branch: "main",
  event: "push",
});

const job = (
  id,
  name,
  queueSeconds,
  durationSeconds,
  conclusion = "success",
) => ({
  id,
  name,
  started_at: new Date(
    Date.parse("2026-11-05T12:00:00Z") + queueSeconds * 1000,
  ).toISOString(),
  completed_at: new Date(
    Date.parse("2026-11-05T12:00:00Z") +
      (queueSeconds + durationSeconds) * 1000,
  ).toISOString(),
  conclusion,
});

test("Build 205 uses deterministic nearest-rank p90 and rejects bad clocks", () => {
  assert.equal(percentile([12, 3, 9, 7], 0.9), 12);
  assert.equal(percentile([], 0.9), null);
  assert.equal(safeSeconds("2026-11-05T12:00:00Z", "2026-11-05T12:01:30Z"), 90);
  assert.equal(safeSeconds("bad", "2026-11-05T12:01:30Z"), null);
  assert.equal(
    safeSeconds("2026-11-05T12:01:30Z", "2026-11-05T12:00:00Z"),
    null,
  );
});

test("Build 205 measures queue and job runtime independently", () => {
  const runs = [
    { run: run(10), jobs: [job(1, "Verify", 40, 300)] },
    { run: run(11), jobs: [job(2, "Verify", 70, 330)] },
    { run: run(12), jobs: [job(3, "Verify", 120, 360)] },
  ];
  const evidence = analyzeHistory(runs);
  assert.equal(evidence.checks["CI / Verify"].queueP90Seconds, 120);
  assert.equal(evidence.checks["CI / Verify"].runtimeP90Seconds, 360);
  assert.equal(
    evidence.checks["CI / Verify"].status,
    "WITHIN_MONITORING_BUDGET",
  );
  assert.equal(evidence.protectedGatesModified, false);
  assert.equal(evidence.releaseApprovalGranted, false);
  assert.equal(evidence.commsHandshakeAuthorized, false);
  assert.equal(evidence.samples[0].commit, "synthetic-sha");
  assert.match(formatSummary(evidence), /CI \/ Verify/);
});

test("Build 205 warns independently on long queue, slow job and failed evidence", () => {
  const runs = [
    {
      run: run(21),
      jobs: [
        job(1, "Verify", 601, 30),
        job(2, "Database migrations", 5, 900, "failure"),
      ],
    },
  ];
  const evidence = analyzeHistory(runs);
  assert.equal(
    evidence.checks["CI / Verify"].status,
    "SLA_BREACH_DIAGNOSTIC_ONLY",
  );
  assert.match(evidence.checks["CI / Verify"].recovery, /runner availability/);
  assert.equal(
    evidence.checks["CI / Database migrations"].status,
    "SLA_BREACH_DIAGNOSTIC_ONLY",
  );
  assert.match(
    evidence.checks["CI / Database migrations"].recovery,
    /slow steps/,
  );
  assert.deepEqual(
    evidence.checks["CI / Database migrations"].unsuccessfulRunIds,
    [21],
  );
});

test("Build 205 refuses to claim SLA GREEN from missing or insufficient evidence", () => {
  const missing = analyzeHistory([]);
  assert.equal(missing.measurementState, "NO_MEASUREMENT");
  for (const result of Object.values(missing.checks)) {
    assert.equal(result.status, "INSUFFICIENT_MEASUREMENTS");
  }
  const sparse = analyzeHistory([
    { run: run(1), jobs: [job(7, "Verify", 2, 8)] },
  ]);
  assert.equal(
    sparse.checks["CI / Verify"].status,
    "INSUFFICIENT_MEASUREMENTS",
  );
  assert.equal(sparse.checks["CI / Verify"].sampleCount, 1);
  const malformed = analyzeHistory([
    { run: run(1), jobs: [{ ...job(7, "Verify", 2, 8), completed_at: null }] },
    { run: run(2, "Unknown Workflow"), jobs: [job(8, "Verify", 2, 8)] },
  ]);
  assert.equal(malformed.sampledJobs, 0);
});

test("Build 205 read-only GitHub collector requires identity, selects bounded required runs", async () => {
  await assert.rejects(
    () => fetchGitHubHistory({ token: "", repository: "org/repo" }),
    {
      message: "MISSING_ACTIONS_READ_ACCESS",
    },
  );
  const paths = [];
  const fetchImpl = async (url, options) => {
    paths.push(url);
    assert.equal(options.headers.Authorization, "Bearer fake-test-token");
    const value = url.includes("/runs?")
      ? {
          workflow_runs: [
            run(1),
            run(2, "Unknown Workflow"),
            run(3, "Secret Scan"),
          ],
        }
      : { jobs: [job(55, "Verify", 5, 90)] };
    return { ok: true, json: async () => value };
  };
  const result = await fetchGitHubHistory({
    fetchImpl,
    token: "fake-test-token",
    repository: "RosevearCreations/iCamp",
  });
  assert.equal(result.length, 2);
  assert.equal(paths.length, 3);
  assert.ok(
    paths.every((path) =>
      path.includes("/repos/RosevearCreations/iCamp/actions/"),
    ),
  );
});

test("Build 205 preserves five protected gate names, main/PR triggers, and evidence upload", () => {
  const ci = readFileSync(resolve(".github/workflows/ci.yml"), "utf8");
  assert.deepEqual(Object.keys(REQUIRED_CHECK_BUDGETS), [
    "CI / Verify",
    "CI / Browser end-to-end",
    "CI / Database migrations",
    "Secret Scan / Gitleaks",
    "CodeQL / Analyze JavaScript and TypeScript",
  ]);
  assert.equal(Object.values(REQUIRED_WORKFLOWS).flat().length, 5);
  assert.match(ci, /branches: \[main\]/);
  assert.match(ci, /branches: \[dev, main\]/);
  assert.match(ci, /  actions: read/);
  assert.match(
    ci,
    /name: Capture Build 205 historical CI queue and runtime evidence/,
  );
  assert.match(ci, /if: always\(\)/);
  assert.match(ci, /name: build205-ci-runtime-evidence/);
  assert.match(ci, /retention-days: 14/);
  assert.match(ci, /run: npm run db:verify/);
  assert.match(ci, /run: npm audit --omit=dev --audit-level=high/);
});
