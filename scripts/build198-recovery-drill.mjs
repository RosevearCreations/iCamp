import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { promisify } from "node:util";

import pg from "pg";

import {
  requireIsolatedDrill,
  summarizeRestore,
} from "../lib/resilience/core.mjs";

const exec = promisify(execFile);
const source = requireIsolatedDrill({
  environment: process.env.ICAMP_APP_ENV,
  databaseUrl: process.env.DATABASE_URL,
  acknowledgment: process.env.ICAMP_DRILL_ACK,
});

const name = `icamp_drill_restore_${randomBytes(8).toString("hex")}`;
const workspace = await mkdtemp(join(tmpdir(), "icamp198-"));
const snapshotFile = join(workspace, "synthetic.dump");
const sourceUrl = process.env.DATABASE_URL;
const restoredUrl = new URL(sourceUrl);
restoredUrl.pathname = `/${name}`;
const { Client } = pg;
const sourceClient = new Client({ connectionString: sourceUrl });
const restoreClient = new Client({ connectionString: restoredUrl.toString() });
const adminUrl = new URL(sourceUrl);
adminUrl.pathname = "/postgres";
const admin = new Client({ connectionString: adminUrl.toString() });
const connection = {
  PGHOST: source.host,
  PGPORT: source.port,
  PGUSER: source.user,
  PGPASSWORD: source.password,
};

const checks = [
  ["organizations", "public.organizations"],
  ["campgrounds", "public.campgrounds"],
  ["privacyRequests", "icamp_private.guest_privacy_requests"],
  ["privacyEvents", "icamp_private.guest_privacy_request_events"],
  ["queuedJobs", "icamp_private.job_queue"],
];

async function inventory(client) {
  const result = {};
  for (const [label, table] of checks) {
    const count = await client.query(
      `select count(*)::int as total from ${table}`,
    );
    result[label] = count.rows[0].total;
  }
  return result;
}

async function verifyIsolation(client) {
  const policies = await client.query(`
    select relname, relrowsecurity, relforcerowsecurity
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'icamp_private'
      and relname in ('guest_privacy_requests', 'guest_privacy_request_events')
  `);
  if (
    policies.rowCount !== 2 ||
    policies.rows.some((row) => !row.relrowsecurity || !row.relforcerowsecurity)
  ) {
    throw new Error(
      "Restored privacy tables must retain enabled, forced row security.",
    );
  }
  await client.query("begin");
  try {
    await client.query("set local role icamp_app");
    await client.query(
      "set local icamp.user_id = '00000000-0000-4000-8000-000000000099'",
    );
    const visible = await client.query(
      "select count(*)::int as total from public.campgrounds",
    );
    return visible.rows[0].total;
  } finally {
    await client.query("rollback");
  }
}

let created = false;
let sourceConnected = false;
let restoredConnected = false;
let adminConnected = false;
const started = performance.now();
const capturedAt = new Date().toISOString();
try {
  await sourceClient.connect();
  sourceConnected = true;
  const sourceCounts = await inventory(sourceClient);
  if (sourceCounts.campgrounds < 1) {
    throw new Error(
      "Synthetic source must contain a seeded campground before recovery drill.",
    );
  }

  await exec(
    "pg_dump",
    ["--no-password", "-Fc", "-f", snapshotFile, "-d", source.database],
    {
      env: { ...process.env, ...connection },
      maxBuffer: 1024 * 1024,
    },
  );

  await admin.connect();
  adminConnected = true;
  // Exact identifier is internally generated; never accepts input or points at production.
  await admin.query(`create database "${name}"`);
  created = true;
  await exec(
    "pg_restore",
    [
      "--no-password",
      "--no-owner",
      "--exit-on-error",
      "-d",
      name,
      snapshotFile,
    ],
    {
      env: { ...process.env, ...connection },
      maxBuffer: 1024 * 1024,
    },
  );

  await restoreClient.connect();
  restoredConnected = true;
  const restoredCounts = await inventory(restoreClient);
  const deniedCrossTenantRows = await verifyIsolation(restoreClient);
  const report = summarizeRestore({
    source: sourceCounts,
    restored: restoredCounts,
    sourceCapturedAt: capturedAt,
    restoreCompletedAt: new Date().toISOString(),
    elapsedMs: performance.now() - started,
    deniedCrossTenantRows,
  });
  console.log(
    JSON.stringify(
      { kind: "build198_synthetic_recovery_drill", ...report },
      null,
      2,
    ),
  );
  if (report.status !== "pass") process.exitCode = 1;
} finally {
  if (restoredConnected) await restoreClient.end();
  if (sourceConnected) await sourceClient.end();
  if (created && adminConnected) {
    // The uniquely generated temporary database is the only drop target.
    await admin.query(`drop database "${name}" with (force)`);
  }
  if (adminConnected) await admin.end();
  await rm(workspace, { recursive: true, force: true });
}
