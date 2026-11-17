import pg from "pg";

import {
  assessMigrationReadback261,
  evaluateAssurance261,
  verifyProviderEnrollment261,
} from "./core.mjs";

const REVISION = /^[a-f0-9]{40}$/u;

function hostFromConnection(value) {
  try {
    return new URL(value || "").hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Never silently promote CI PostgreSQL results into production acceptance.
 * Only inspect the actual configured and independently pinned Vercel DB.
 */
export async function inspectFinancialAssurance261(env = process.env) {
  const revision = REVISION.test(env.VERCEL_GIT_COMMIT_SHA ?? "")
    ? env.VERCEL_GIT_COMMIT_SHA
    : null;
  const runtimeProduction = env.VERCEL_ENV === "production";
  const actualHost = hostFromConnection(env.DATABASE_URL);
  const expectedHost =
    env.ICAMP_EXPECTED_PRODUCTION_DATABASE_HOST?.trim().toLowerCase();
  const targetPinned = Boolean(
    runtimeProduction &&
      actualHost &&
      expectedHost &&
      expectedHost.length > 4 &&
      actualHost === expectedHost,
  );
  let ledgerExists = false;
  let ledgerReadSucceeded = false;
  let record = null;
  let schema = null;
  if (targetPinned) {
    const pool = new pg.Pool({
      connectionString: env.DATABASE_URL,
      max: 1,
      connectionTimeoutMillis: 3500,
      idleTimeoutMillis: 1500,
    });
    const client = await pool.connect().catch(() => null);
    if (client) {
      try {
        await client.query(
          "begin transaction isolation level repeatable read read only",
        );
        await client.query("set local statement_timeout='4000ms'");
        const tables = await client.query(
          "select to_regclass('icamp_meta.schema_migrations') is not null as ledger, " +
            "to_regclass('public.icamp_finance_close260') is not null as owner_table",
        );
        ledgerExists = tables.rows[0]?.ledger === true;
        if (ledgerExists) {
          const result = await client.query(
            "select version,name,checksum_sha256 " +
              "from icamp_meta.schema_migrations where version=$1",
            ["0238"],
          );
          record = result.rows.length === 1 ? result.rows[0] : null;
        }
        if (tables.rows[0]?.owner_table === true) {
          const check = await client.query(
            "select " +
              "(select c.relrowsecurity and c.relforcerowsecurity " +
              " from pg_class c where c.oid='public.icamp_finance_close260'::regclass) as force_rls, " +
              "(select count(*)::int from pg_policies where schemaname='public' " +
              " and tablename='icamp_finance_close260') as scoped_policy_count, " +
              "exists(select 1 from pg_trigger where tgrelid='public.icamp_finance_close260'::regclass " +
              " and tgname='icamp_finance_close260_guard' and not tgisinternal) as guard_present, " +
              "(has_table_privilege('icamp_app','public.icamp_finance_close260','UPDATE') " +
              " or has_table_privilege('icamp_app','public.icamp_finance_close260','DELETE')) as mutable_grant_present",
          );
          schema = {
            forceRls: check.rows[0]?.force_rls === true,
            guardPresent: check.rows[0]?.guard_present === true,
            scopedPolicyCount: Number(check.rows[0]?.scoped_policy_count ?? 0),
            mutableGrantPresent:
              check.rows[0]?.mutable_grant_present !== false,
          };
        }
        ledgerReadSucceeded = true;
        await client.query("commit");
      } catch {
        await client.query("rollback").catch(() => undefined);
      } finally {
        client.release();
      }
    }
    await pool.end().catch(() => undefined);
  }
  const migration = assessMigrationReadback261({
    runtimeProduction,
    revision,
    targetPinned,
    ledgerExists,
    ledgerReadSucceeded,
    record,
    schema,
  });

  const configuredProvider = String(
    env.ICAMP_PAYMENT_PROVIDER ?? "mock",
  ).trim().toLowerCase();
  const expectedProvider = String(
    env.ICAMP_SETTLEMENT260_PROVIDER ?? "",
  ).trim().toLowerCase();
  let enrollment = null;
  let enrollmentIssue = null;
  try {
    enrollment = verifyProviderEnrollment261({
      envelopeJson: env.ICAMP_SETTLEMENT261_ENROLLMENT_JSON ?? "",
      provider: expectedProvider,
      keyId: env.ICAMP_SETTLEMENT260_KEY_ID ?? "",
      providerPublicKeyPem:
        env.ICAMP_SETTLEMENT260_PUBLIC_KEY_PEM?.replaceAll("\\n", "\n") ?? "",
      reviewerPublicKeyPem:
        env.ICAMP_SETTLEMENT261_REVIEWER_PUBLIC_KEY_PEM?.replaceAll(
          "\\n",
          "\n",
        ) ?? "",
      reviewerIndependentlyEnrolled:
        env.ICAMP_SETTLEMENT261_REVIEWER_ENROLLED === "true",
      sourceRevision: revision,
    });
  } catch (error) {
    enrollmentIssue =
      error instanceof Error ? error.message : "Independent enrollment failed.";
  }

  const assurance = evaluateAssurance261({
    migration,
    enrollment,
    configuredProvider,
    expectedProvider,
    revision,
  });
  if (enrollmentIssue) assurance.blockers.push(enrollmentIssue);
  return {
    revision,
    migration,
    enrollmentStatus:
      enrollment?.status ?? "HOLD_INDEPENDENT_ENROLLMENT_MISSING",
    enrollmentExpiresAt: enrollment?.expiresAt ?? null,
    assurance,
    // Never serialize DB URLs, private keys, enrolled key bytes,
    // statement bodies, reviewer signatures or guest financial rows.
    independentDatabaseHostIdentityConfirmed: false,
    liveSettlementActivationStatus: "HOLD_EXTERNAL_ADAPTER_AND_BANK_PROOF",
    ownerEvidenceDecisionStatus: assurance.status,
  };
}
