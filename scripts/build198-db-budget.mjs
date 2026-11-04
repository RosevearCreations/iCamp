import { performance } from "node:perf_hooks";

import pg from "pg";

import {
  requireIsolatedDrill,
  RESILIENCE_BUDGETS,
  summarizePerformance,
} from "../lib/resilience/core.mjs";

// The same protective isolation gate prevents accidentally benchmarking production rows.
requireIsolatedDrill({
  environment: process.env.ICAMP_APP_ENV,
  databaseUrl: process.env.DATABASE_URL,
  acknowledgment: process.env.ICAMP_DRILL_ACK,
});

const { Client } = pg;
const client = new Client({ connectionString: process.env.DATABASE_URL });
try {
  await client.connect();
  const seed = await client.query(
    "select id from public.organizations order by id limit 1",
  );
  if (!seed.rowCount)
    throw new Error(
      "A synthetic organization must exist before a database budget drill.",
    );
  const times = [];
  for (let i = 0; i < RESILIENCE_BUDGETS.database.sampleMinimum; i += 1) {
    const started = performance.now();
    await client.query(
      "select id, name from public.campgrounds where organization_id = $1 order by name limit 25",
      [seed.rows[0].id],
    );
    times.push(performance.now() - started);
  }
  const result = summarizePerformance(times, RESILIENCE_BUDGETS.database);
  console.log(
    JSON.stringify(
      {
        kind: "build198_synthetic_database_budget",
        recordedAt: new Date().toISOString(),
        ...result,
      },
      null,
      2,
    ),
  );
  if (result.status !== "pass") process.exitCode = 1;
} finally {
  await client.end();
}
