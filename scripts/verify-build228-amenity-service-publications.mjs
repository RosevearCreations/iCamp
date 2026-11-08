import assert from "node:assert/strict";
import pg from "pg";

const connectionString = process.env.DATABASE_URL?.trim();
if (!connectionString)
  throw new Error("DATABASE_URL required for Build 228 schema verification.");
const pool = new pg.Pool({
  connectionString,
  max: 1,
  connectionTimeoutMillis: 5000,
});
try {
  const columns = await pool.query(
    `select column_name,column_default,is_nullable
     from information_schema.columns
     where table_schema='icamp_private'
       and table_name='campground_wayfinding_publications'
       and column_name like 'service_%'`,
  );
  const byName = new Map(columns.rows.map((row) => [row.column_name, row]));
  for (const name of [
    "service_is_published",
    "service_operating_status",
    "service_hours_summary",
    "service_accessibility_details",
    "service_reviewed_at",
    "service_reviewed_by_user_id",
  ])
    assert.ok(byName.has(name), `Missing Build 228 ${name}`);
  assert.match(byName.get("service_is_published").column_default, /false/i);
  assert.equal(byName.get("service_is_published").is_nullable, "NO");

  const contracts = await pool.query(
    `select c.relrowsecurity,c.relforcerowsecurity,
       (select string_agg(pg_get_constraintdef(k.oid), ' ')
          from pg_constraint k where k.conrelid=c.oid
            and k.conname='campground_wayfinding_service_review_check') as review_check,
       (select string_agg(t.tgname, ',') from pg_trigger t
          where t.tgrelid=c.oid and not t.tgisinternal
            and t.tgname='campground_wayfinding_service_expiry') as expiry_trigger
     from pg_class c
     where c.oid='icamp_private.campground_wayfinding_publications'::regclass`,
  );
  const contract = contracts.rows[0];
  assert.equal(contract.relrowsecurity, true);
  assert.equal(contract.relforcerowsecurity, true);
  assert.match(contract.review_check, /service_is_published/);
  assert.match(contract.review_check, /service_reviewed_by_user_id/);
  assert.equal(contract.expiry_trigger, "campground_wayfinding_service_expiry");
  const expiry = await pool.query(
    `select pg_get_functiondef('icamp_private.expire_relocated_amenity_service()'::regprocedure) as source`,
  );
  assert.match(expiry.rows[0].source, /map_image_version_id IS DISTINCT FROM/i);
  assert.match(expiry.rows[0].source, /service_is_published := false/i);
  console.log(
    "Build 228: additive schema, default-private, RLS and source-expiry guard VERIFIED.",
  );
} finally {
  await pool.end();
}
