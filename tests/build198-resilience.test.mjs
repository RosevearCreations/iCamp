import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import test from "node:test";

import {
  requireIsolatedDrill,
  RESILIENCE_BUDGETS,
  summarizePerformance,
  summarizeRestore,
} from "../lib/resilience/core.mjs";

const exec = promisify(execFile);

test("Build198 restore hard-rejects production/remote/unacknowledged database targets", () => {
  const databaseUrl = "postgresql://postgres:secret@127.0.0.1:5432/icamp_ci";
  const valid = {
    environment: "test",
    databaseUrl,
    acknowledgment: "ISOLATED_TEST_ONLY",
  };
  assert.equal(requireIsolatedDrill(valid).database, "icamp_ci");
  for (const input of [
    { ...valid, environment: "production" },
    { ...valid, environment: "development" },
    { ...valid, acknowledgment: "" },
    { ...valid, databaseUrl: "postgresql://postgres@db.example.com/icamp_ci" },
    { ...valid, databaseUrl: "postgresql://postgres@localhost/production" },
    {
      ...valid,
      databaseUrl: "postgresql://postgres@localhost/icamp_ci?sslmode=require",
    },
    { ...valid, databaseUrl: "https://localhost/icamp_ci" },
    { ...valid, databaseUrl: "not a URL" },
  ]) {
    assert.throws(
      () => requireIsolatedDrill(input),
      /drill|PostgreSQL|synthetic/i,
    );
  }
});

test("Build198 p95 budgets require enough real samples and fail measured breaches", () => {
  const budget = RESILIENCE_BUDGETS.health;
  assert.equal(
    summarizePerformance([], budget).status,
    "insufficient_evidence",
  );
  assert.equal(
    summarizePerformance([5], budget).status,
    "insufficient_evidence",
  );
  const passing = summarizePerformance(Array(20).fill(40), budget);
  assert.equal(passing.status, "pass");
  assert.equal(passing.p95Ms, 40);
  const failing = summarizePerformance(
    [...Array(18).fill(40), 900, 1000],
    budget,
  );
  assert.equal(failing.status, "breach");
  assert.equal(failing.p95Ms, 900);
  assert.throws(() => summarizePerformance([Number.NaN], budget), /finite/);
});

test("Build198 recovery report fails drift and foreign-tenant disclosure; never invents production RPO", () => {
  const input = {
    source: { campgrounds: 2, privacyRequests: 3 },
    restored: { campgrounds: 2, privacyRequests: 3 },
    sourceCapturedAt: "2026-11-04T00:00:00.000Z",
    restoreCompletedAt: "2026-11-04T00:00:20.000Z",
    elapsedMs: 20345.2,
    deniedCrossTenantRows: 0,
  };
  const passing = summarizeRestore(input);
  assert.equal(passing.status, "pass");
  assert.equal(passing.measuredRestoreMs, 20345);
  assert.equal(passing.productionRpo, "not_measured");
  assert.equal(passing.productionRto, "not_measured");
  assert.equal(
    summarizeRestore({
      ...input,
      restored: { campgrounds: 1, privacyRequests: 3 },
    }).status,
    "fail",
  );
  assert.equal(
    summarizeRestore({ ...input, deniedCrossTenantRows: 1 }).status,
    "fail",
  );
});

test("Build198 read-only HTTP probe detects synthetic outage and a healthy local service", async () => {
  let outage = false;
  const server = createServer((request, response) => {
    response.writeHead(outage ? 503 : 200, {
      "Content-Type": "application/json",
    });
    response.end(JSON.stringify({ status: outage ? "not-ready" : "ready" }));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    const env = {
      ...process.env,
      ICAMP_PROBE_BASE_URL: `http://127.0.0.1:${address.port}`,
    };
    const script = new URL(
      "../scripts/build198-performance-probe.mjs",
      import.meta.url,
    ).pathname;
    const passing = await exec(process.execPath, [script], { env });
    const report = JSON.parse(passing.stdout);
    assert.equal(report.results.health.status, "pass");
    assert.equal(report.results.readiness.status, "pass");
    outage = true;
    await assert.rejects(
      () => exec(process.execPath, [script], { env }),
      (error) => {
        const failed = JSON.parse(error.stdout);
        assert.equal(failed.results.health.status, "breach");
        assert.equal(failed.results.health.failures, 20);
        return true;
      },
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("Build198 I.T. navigation, authorization, CI and runbook preserve the safety boundary", () => {
  const read = (path) =>
    readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  const page = read("app/workspaces/it-analysis/resilience/page.tsx");
  const nav = read("components/standard-ops-command.tsx");
  const ci = read(".github/workflows/ci.yml");
  const drill = read("scripts/build198-recovery-drill.mjs");
  assert.match(page, /requireAnyCampgroundPermission\(\s*"it\.health\.read"/);
  assert.match(nav, /\/workspaces\/it-analysis\/resilience/);
  assert.match(
    page,
    /Production RPO, RTO and provider backup verification:[\s\S]*?not\s+established/,
  );
  assert.match(
    page,
    /Automated replay, failover and rollback remain intentionally[\s\S]*?disabled/,
  );
  assert.match(
    ci,
    /Build 198 isolated backup and restore with tenant-isolation proof/,
  );
  assert.match(ci, /ISOLATED_TEST_ONLY/);
  assert.match(drill, /pg_dump/);
  assert.match(drill, /pg_restore/);
  assert.match(drill, /set local role icamp_app/);
  assert.match(drill, /drop database/);
  assert.match(
    read("docs/BUILD_198_RESILIENCE_ACCEPTANCE.md"),
    /No production backup was restored/,
  );
});
