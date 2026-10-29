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
  const authorized = await pool.query(
    `select exists (
       select 1
       from icamp_private.platform_operator_grants g
       join icamp_private.user_accounts a on a.id = g.user_id
       where g.user_id = $1
         and g.grant_state = 'active'
         and a.account_state = 'active'
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
