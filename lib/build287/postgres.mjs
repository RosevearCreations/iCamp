import pg from "pg";

import { assessAccount287, databasePin287 } from "./core.mjs";

/** Self-only diagnostics. Never accept a target username or account ID from a form.
 * The caller must supply its current server-derived authenticated session.
 * No mutation, other-account details, password, seed or host is returned. */
export async function inspectOwnAccount287(session) {
  const evidence = {
    sessionEligible: false,
    sessionVerified: false,
    querySucceeded: false,
    hostPin: databasePin287(
      process.env.DATABASE_URL,
      process.env.ICAMP_EXPECTED_PRODUCTION_DATABASE_HOST,
    ),
    ownerBindingTable: false,
    migrationLedger: false,
    mfaVerified: false,
    mfaRequired: false,
    grantActive: false,
    bindingVerified: false,
  };
  const finish = () => ({ ...evidence, status: assessAccount287(evidence) });
  if (
    session?.user?.accountType !== "staff" ||
    session.assuranceLevel !== "aal2"
  )
    return finish();
  evidence.sessionEligible = true;
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) return finish();

  const pool = new pg.Pool({
    connectionString,
    max: 1,
    connectionTimeoutMillis: 3500,
  });
  const client = await pool.connect().catch(() => null);
  if (!client) {
    await pool.end().catch(() => undefined);
    return finish();
  }
  try {
    await client.query("begin read only");
    await client.query("set local statement_timeout='4000ms'");
    const current = await client.query(
      `select a.mfa_required,
         exists(select 1 from icamp_private.mfa_factors f
           where f.user_id=a.id and f.factor_state='verified') as mfa_verified,
         exists(select 1 from icamp_private.platform_operator_grants g
           where g.user_id=a.id and g.grant_state='active') as grant_active
       from icamp_private.auth_sessions s
       join icamp_private.user_accounts a on a.id=s.user_id
       where s.id=$1 and s.user_id=$2 and s.revoked_at is null
         and s.expires_at>statement_timestamp() and s.assurance_level='aal2'
         and s.reauthenticated_at>statement_timestamp()-interval '15 minutes'
         and a.account_state='active' and a.account_type='staff'`,
      [session.sessionId, session.user.id],
    );
    if (current.rowCount !== 1) {
      await client.query("rollback");
      evidence.querySucceeded = true;
      return finish();
    }
    evidence.sessionVerified = true;
    const row = current.rows[0];
    evidence.mfaRequired = row.mfa_required === true;
    evidence.mfaVerified = row.mfa_verified === true;
    evidence.grantActive = row.grant_active === true;
    const schema = await client.query(
      `select to_regclass('icamp_private.platform_master_owner_bindings')
         is not null as binding_table,
       to_regclass('icamp_meta.schema_migrations') is not null as ledger`,
    );
    evidence.ownerBindingTable = schema.rows[0]?.binding_table === true;
    evidence.migrationLedger = schema.rows[0]?.ledger === true;
    if (evidence.ownerBindingTable) {
      const binding = await client.query(
        `select exists (
           select 1 from icamp_private.platform_master_owner_bindings o
           where o.user_id=$1 and o.binding_state='verified'
             and o.owner_slot in ('ree','jack')
             and o.verified_at is not null and o.verified_by is not null
             and o.verified_by<>o.user_id
             and nullif(trim(o.verification_reference),'') is not null
         ) as verified`,
        [session.user.id],
      );
      evidence.bindingVerified = binding.rows[0]?.verified === true;
    }
    await client.query("commit");
    evidence.querySucceeded = true;
  } catch {
    evidence.sessionVerified = false;
    await client.query("rollback").catch(() => undefined);
  } finally {
    client.release();
    await pool.end().catch(() => undefined);
  }
  return finish();
}
