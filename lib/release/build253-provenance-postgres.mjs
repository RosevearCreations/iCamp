import pg from "pg";

import { BUILD253_CANONICAL_MIGRATIONS } from "./build253-canonical-migrations.mjs";
import {
  reconcileCanonicalMigrationChecksums,
  superviseRemediationEvidence,
  verifyIndependentDatabaseProvenance,
} from "./build253-provenance-core.mjs";
import { inspectBuild251Runtime } from "./build251-runtime-postgres.mjs";

const REV = /^[a-f0-9]{40}$/u;
function revision() {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA ?? "";
  return REV.test(sha) ? sha : null;
}
function safeJSON(value) {
  if (!value || value.length > 16384) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : null;
  } catch {
    return null;
  }
}
function runtimeHost() {
  try {
    return new URL(process.env.DATABASE_URL ?? "").hostname.toLowerCase();
  } catch {
    return null;
  }
}
function hostnameMatchesPin(host) {
  const expected =
    process.env.ICAMP_EXPECTED_PRODUCTION_DATABASE_HOST?.trim().toLowerCase();
  return Boolean(host && expected && expected.length > 4 && host === expected);
}

/** All database access is SELECT inside a READ ONLY transaction against the
 * actual runtime DATABASE_URL, never a named or guessed Supabase project. */
export async function inspectBuild253CanonicalReconciliation() {
  const host = runtimeHost();
  const pinned = hostnameMatchesPin(host);
  let querySucceeded = false;
  let ledgerExists = false;
  let records = [];
  if (pinned) {
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
        const ledger = await client.query(
          "select to_regclass('icamp_meta.schema_migrations') is not null as found",
        );
        ledgerExists = ledger.rows[0]?.found === true;
        if (ledgerExists) {
          const results = await client.query(
            [
              "select version, name, checksum_sha256",
              "from icamp_meta.schema_migrations",
              "where version = any($1::text[])",
              "order by version",
            ].join(" "),
            [BUILD253_CANONICAL_MIGRATIONS.map((row) => row.version)],
          );
          records = results.rows;
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
  return {
    checksum: reconcileCanonicalMigrationChecksums({
      sourceRevision: revision(),
      hostnameMatchesConfiguredPin: pinned,
      querySucceeded,
      ledgerExists,
      records,
    }),
    host,
  };
}
export async function inspectBuild253SupervisedReview() {
  const [current, previous] = await Promise.all([
    inspectBuild253CanonicalReconciliation(),
    inspectBuild251Runtime(),
  ]);
  const provenance = verifyIndependentDatabaseProvenance({
    sourceRevision: revision(),
    databaseHostname: current.host,
    reconciled: current.checksum,
    reviewerEnrolled:
      process.env.ICAMP_DB_PROVENANCE_REVIEWER_ENROLLED === "true",
    reviewerPin: safeJSON(process.env.ICAMP_DB_PROVENANCE_REVIEWER_PIN_JSON),
    originalSourceEnrolled:
      process.env.ICAMP_SOURCE_HEALTH_CUSTODIAN_ENROLLED === "true",
    originalSourcePin: safeJSON(process.env.ICAMP_SOURCE_HEALTH_PIN_JSON),
    receipt: safeJSON(process.env.ICAMP_DB_PROVENANCE_RECEIPT_JSON),
    asOf: new Date().toISOString(),
  });
  const supervised = superviseRemediationEvidence({
    checksum: current.checksum,
    provenance,
    prior: previous,
  });
  // Never return the private database host, recorded raw hashes or signatures.
  return {
    sourceRevision: revision(),
    checksum: current.checksum,
    provenance,
    supervised,
    previousDatabaseStatus: previous.database.status,
    previousSourceCustodyStatus: previous.signer.status,
    formalOwnerAcceptance: "HOLD",
    receiverConnected: false,
  };
}
