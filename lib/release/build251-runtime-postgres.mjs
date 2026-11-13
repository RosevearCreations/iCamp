import pg from "pg";
import { BUILD251_TABLES, classifyProductionDatabase, inspectOriginalSignerEnrollment } from "./build251-readiness-core.mjs";

const REV = /^[a-f0-9]{40}$/u;
const sourceRevision = () => {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA ?? "";
  return REV.test(sha) ? sha : null;
};
function safeObject(value) {
  if (!value || value.length > 8192) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : null;
  } catch {
    return null;
  }
}
function actualHost(connectionString) {
  if (!connectionString) return null;
  try {
    return new URL(connectionString).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** Read-only evidence directly from the connection actually used by the app.
 * Never infer production adoption from an unrelated named Supabase project,
 * preview migration job, self-reported UI state, or public browser input. */
export async function inspectRuntimeDatabaseAdoption() {
  const connection = process.env.DATABASE_URL ?? "";
  const pin = (process.env.ICAMP_EXPECTED_PRODUCTION_DATABASE_HOST ?? "")
    .trim()
    .toLowerCase();
  const revision = sourceRevision();
  let rows = [];
  let querySucceeded = false;
  if (connection) {
    const pool = new pg.Pool({
      connectionString: connection,
      max: 1,
      connectionTimeoutMillis: 3500,
      idleTimeoutMillis: 1500,
    });
    const client = await pool.connect().catch(() => null);
    if (client) {
      try {
        await client.query("begin read only");
        await client.query("set local statement_timeout='4000ms'");
        const result = await client.query(
          [
            "select wanted.name, c.oid is not null as present,",
            "coalesce(c.relrowsecurity,false) as row_level_security,",
            "coalesce(c.relforcerowsecurity,false) as force_row_level_security,",
            "count(distinct p.polname)::integer as policy_count,",
            "not exists (select 1 from information_schema.table_privileges tp",
            "  where tp.table_schema='public' and tp.table_name=wanted.name",
            "  and tp.grantee in ('icamp_app','anon','authenticated')",
            "  and tp.privilege_type in ('UPDATE','DELETE')) as append_only,",
            "exists(select 1 from pg_trigger t where t.tgrelid=c.oid",
            "  and not t.tgisinternal) as has_guard_trigger",
            "from unnest($1::text[]) as wanted(name)",
            "left join pg_class c on c.relname=wanted.name",
            "  and c.relnamespace='public'::regnamespace",
            "left join pg_policy p on p.polrelid=c.oid",
            "group by wanted.name,c.oid,c.relrowsecurity,c.relforcerowsecurity",
            "order by wanted.name",
          ].join(" "),
          [BUILD251_TABLES],
        );
        rows = result.rows.map((row) => ({
          name: row.name,
          present: row.present,
          rowLevelSecurity: row.row_level_security,
          forceRowLevelSecurity: row.force_row_level_security,
          policyCount: Number(row.policy_count),
          appendOnly: row.append_only,
          hasGuardTrigger: row.has_guard_trigger,
        }));
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
  return classifyProductionDatabase({
    sourceRevision: revision,
    databaseConfigured: Boolean(connection),
    expectedHost: pin || null,
    runtimeHost: actualHost(connection),
    querySucceeded,
    tables: rows,
  });
}

export function inspectProtectedOriginalSourceEnrollment() {
  return inspectOriginalSignerEnrollment({
    sourceRevision: sourceRevision(),
    originalPin: safeObject(process.env.ICAMP_SOURCE_HEALTH_PIN_JSON),
    originalCustodianEnrolled:
      process.env.ICAMP_SOURCE_HEALTH_CUSTODIAN_ENROLLED === "true",
    reviewerPin: safeObject(process.env.ICAMP_SOURCE_CUSTODY_REVIEWER_PIN_JSON),
    reviewerReceipt: safeObject(process.env.ICAMP_SOURCE_CUSTODY_ATTESTATION_JSON),
    asOf: new Date().toISOString(),
  });
}
export async function inspectBuild251Runtime() {
  const [database, signer] = await Promise.all([
    inspectRuntimeDatabaseAdoption(),
    Promise.resolve(inspectProtectedOriginalSourceEnrollment()),
  ]);
  return {
    sourceRevision: sourceRevision(),
    database,
    signer,
    operationalApproval: "HOLD",
    masterConnected: false,
  };
}
