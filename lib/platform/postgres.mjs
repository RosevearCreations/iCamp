import pg from "pg";

const { Pool } = pg;
let pool;

export async function getPlatformOverview(userId, assuranceLevel) {
  if (assuranceLevel !== "aal2") {
    return null;
  }
  if (!pool) {
    const connectionString = process.env.DATABASE_URL?.trim();
    if (!connectionString) {
      throw new Error("DATABASE_URL is required for platform operations.");
    }
    pool = new Pool({ connectionString, max: 3 });
  }
  // A deployment whose original database has not applied Build 232 stays
  // locked. This is not a reason to fall back to the old, wider grant.
  const schema = await pool.query(
    `select to_regclass('icamp_private.platform_master_owner_bindings') is not null as ready`,
  );
  if (schema.rows[0]?.ready !== true) {
    return null;
  }
  const authorized = await pool.query(
    `select exists (
       select 1
       from icamp_private.platform_operator_grants g
       join icamp_private.platform_master_owner_bindings o
         on o.user_id = g.user_id
       join icamp_private.user_accounts a on a.id = g.user_id
       where g.user_id = $1
         and g.grant_state = 'active'
         and o.binding_state = 'verified'
         and o.owner_slot in ('ree', 'jack')
         and o.verified_at is not null
         and o.verified_by is not null
         and o.verified_by <> o.user_id
         and nullif(trim(o.verification_reference), '') is not null
         and a.account_state = 'active'
         and a.account_type = 'staff'
         and a.mfa_required = true
         and exists (
           select 1 from icamp_private.mfa_factors f
           where f.user_id = a.id and f.factor_state = 'verified'
         )
     ) as allowed`,
    [userId],
  );
  if (authorized.rows[0]?.allowed !== true) {
    return null;
  }
  const result = await pool.query(
    `select
       (select count(*)::integer from public.organizations where lifecycle_state = 'active') as organizations,
       (select count(*)::integer from public.campgrounds where lifecycle_state = 'active') as campgrounds,
       (select count(*)::integer from icamp_private.user_accounts where account_state = 'active') as active_users`,
  );
  return result.rows[0];
}
