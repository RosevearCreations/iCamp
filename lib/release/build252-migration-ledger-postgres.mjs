import pg from "pg";

import {
  BUILD252_MIGRATIONS,
  assessBuild252MigrationHistory,
  planBuild252Remediation,
} from "./build252-migration-ledger-core.mjs";
import { inspectBuild251Runtime } from "./build251-runtime-postgres.mjs";

const REV = /^[a-f0-9]{40}$/u;
const currentRevision = () => {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA ?? "";
  return REV.test(sha) ? sha : null;
};

function authenticatedTargetPinned() {
  try {
    const expected =
      process.env.ICAMP_EXPECTED_PRODUCTION_DATABASE_HOST?.trim().toLowerCase();
    const actual = new URL(
      process.env.DATABASE_URL ?? "",
    ).hostname.toLowerCase();
    return Boolean(expected && expected.length > 4 && expected === actual);
  } catch {
    return false;
  }
}

/** Query ONLY the pinned database from the app's protected runtime.
 * A row with a plausible checksum is not proof it matches canonical SQL.
 * Never execute ALTER/INSERT/UPDATE/DELETE/CREATE, even for remediation. */
export async function inspectBuild252MigrationLedger() {
  const targetIndependentlyPinned = authenticatedTargetPinned();
  let records = [];
  let ledgerExists = false;
  let querySucceeded = false;
  if (targetIndependentlyPinned) {
    const pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      max: 1,
      connectionTimeoutMillis: 3500,
      idleTimeoutMillis: 1500,
    });
    const client = await pool.connect().catch(() => null);
    if (client) {
      try {
        await client.query("begin read only");
        await client.query("set local statement_timeout='4000ms'");
        const table = await client.query(
          "select to_regclass('icamp_meta.schema_migrations') is not null as exists",
        );
        ledgerExists = table.rows[0]?.exists === true;
        if (ledgerExists) {
          const result = await client.query(
            [
              "select version,name,checksum_sha256",
              "from icamp_meta.schema_migrations",
              "where version=any($1::text[]) order by version",
            ].join(" "),
            [BUILD252_MIGRATIONS.map((item) => item.version)],
          );
          records = result.rows;
        }
        querySucceeded = true;
        await client.query("commit");
      } catch {
        await client.query("rollback").catch(() => undefined);
      } finally {
        client.release();
      }
    }
    await pool.end().catch(() => undefined);
  }
  return assessBuild252MigrationHistory({
    sourceRevision: currentRevision(),
    targetIndependentlyPinned,
    querySucceeded,
    ledgerExists,
    records,
  });
}

export async function inspectBuild252ReleaseReadiness() {
  const [previous, migrationHistory] = await Promise.all([
    inspectBuild251Runtime(),
    inspectBuild252MigrationLedger(),
  ]);
  return {
    previous,
    migrationHistory,
    remediation: planBuild252Remediation({
      database: previous.database,
      signer: previous.signer,
      migrationHistory,
    }),
    operationalAcceptance: "HOLD",
    masterConnected: false,
  };
}
