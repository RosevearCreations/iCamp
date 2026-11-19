import pg from "pg";

import {
  assessRentalMigrationReadback264,
  RENTAL_MIGRATIONS264,
} from "./migration264.mjs";

/** Inspects only original configured Production PostgreSQL without schema
 * writes, advisory migrations, tenant rows or user secrets. Source-exact
 * ledger verification is separate from independent physical DB ownership. */
export async function inspectRentalMigration264(env = process.env) {
  const production = env.VERCEL_ENV === "production";
  const revision = /^[a-f0-9]{40}$/u.test(env.VERCEL_GIT_COMMIT_SHA ?? "")
    ? env.VERCEL_GIT_COMMIT_SHA
    : null;
  let host = "";
  try {
    host = new URL(env.DATABASE_URL ?? "").hostname.toLowerCase();
  } catch {
    host = "";
  }
  const expectedHost = String(env.ICAMP_EXPECTED_PRODUCTION_DATABASE_HOST ?? "")
    .trim()
    .toLowerCase();
  const pinnedDatabaseHost =
    production &&
    host.length > 4 &&
    expectedHost.length > 4 &&
    host === expectedHost;
  let readSucceeded = false,
    rows = [],
    tables = [];
  if (pinnedDatabaseHost) {
    const pool = new pg.Pool({
      connectionString: env.DATABASE_URL,
      max: 1,
      connectionTimeoutMillis: 4000,
      idleTimeoutMillis: 1500,
    });
    const client = await pool.connect().catch(() => null);
    if (client) {
      try {
        await client.query(
          "begin transaction isolation level repeatable read read only",
        );
        await client.query("set local statement_timeout='4500ms'");
        const ledger = await client.query(
          "select to_regclass('icamp_meta.schema_migrations') is not null as ready",
        );
        if (ledger.rows[0]?.ready) {
          const record = await client.query(
            "select version,name,checksum_sha256 from icamp_meta.schema_migrations " +
              "where version = any($1::text[])",
            [RENTAL_MIGRATIONS264.map((m) => m.version)],
          );
          rows = record.rows;
        }
        for (const [name, guardName] of [
          ["rental_planning_offers", "rental_offer_guard"],
          ["rental_sessions263", "rental_session263_guard"],
          ["rental_allocations264", "rental_allocation264_guard"],
          ["rental_pilot_reviews264", "rental_pilot264_guard"],
        ]) {
          const relation = await client.query(
            "select c.relrowsecurity and c.relforcerowsecurity as force_rls, " +
              "exists(select 1 from pg_trigger t where t.tgrelid=c.oid " +
              "and t.tgname=$2 and not t.tgisinternal) as guard_present, " +
              "(has_table_privilege('icamp_app',c.oid,'SELECT') " +
              "or has_table_privilege('icamp_app',c.oid,'INSERT') " +
              "or has_table_privilege('icamp_app',c.oid,'UPDATE') " +
              "or has_table_privilege('icamp_app',c.oid,'DELETE')) as app_direct_grants " +
              "from pg_class c join pg_namespace n on n.oid=c.relnamespace " +
              "where n.nspname='icamp_private' and c.relname=$1",
            [name, guardName],
          );
          const row = relation.rows[0];
          tables.push({
            name,
            guardName,
            forceRls: row?.force_rls === true,
            guardPresent: row?.guard_present === true,
            appDirectGrants: row?.app_direct_grants !== false,
          });
        }
        readSucceeded = ledger.rows[0]?.ready === true;
        await client.query("commit");
      } catch {
        await client.query("rollback").catch(() => undefined);
        readSucceeded = false;
      } finally {
        client.release();
      }
    }
    await pool.end().catch(() => undefined);
  }
  return assessRentalMigrationReadback264({
    production,
    pinnedDatabaseHost,
    revision,
    readSucceeded,
    rows,
    tables,
  });
}
