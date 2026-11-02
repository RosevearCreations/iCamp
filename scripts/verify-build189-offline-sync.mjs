import assert from "node:assert/strict";
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl)
  throw new Error("DATABASE_URL required for Build189 lifecycle verification.");
const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();

async function one(sql, args = []) {
  const result = await client.query(sql, args);
  assert.equal(result.rowCount, 1);
  return result.rows[0];
}

async function denied(sql, args, pattern) {
  await client.query("savepoint build189_denial");
  let rejected = false;
  try {
    await client.query(sql, args);
  } catch (error) {
    rejected = true;
    assert.match(String(error.message), pattern);
  } finally {
    await client.query("rollback to savepoint build189_denial");
    await client.query("release savepoint build189_denial");
  }
  assert.ok(rejected, "Expected denied Build189 mutation");
}

try {
  await client.query("begin");
  const orgA = await one(
    "insert into public.organizations(name,slug) values('Build189 A','build189-a') returning id",
  );
  const orgB = await one(
    "insert into public.organizations(name,slug) values('Build189 B','build189-b') returning id",
  );
  const campA = await one(
    "insert into public.campgrounds(organization_id,name,slug) values($1,'Build189 A','build189-a') returning id",
    [orgA.id],
  );
  const campB = await one(
    "insert into public.campgrounds(organization_id,name,slug) values($1,'Build189 B','build189-b') returning id",
    [orgB.id],
  );
  const actorA = await one(
    "insert into icamp_private.user_accounts(email_normalized,account_type) values('build189-a@test.invalid','staff') returning id",
  );
  const actorB = await one(
    "insert into icamp_private.user_accounts(email_normalized,account_type) values('build189-b@test.invalid','staff') returning id",
  );
  for (const [userId, orgId, campgroundId] of [
    [actorA.id, orgA.id, campA.id],
    [actorB.id, orgB.id, campB.id],
  ]) {
    const assignment = await one(
      "insert into icamp_private.campground_assignments(user_id,organization_id,campground_id) values($1,$2,$3) returning id",
      [userId, orgId, campgroundId],
    );
    await client.query(
      "insert into icamp_private.campground_assignment_roles(assignment_id,role_id) select $1,id from icamp_private.roles where role_code='maintenance' and role_kind='template'",
      [assignment.id],
    );
  }

  const targetA = (await one("select gen_random_uuid() as id")).id;
  const targetB = (await one("select gen_random_uuid() as id")).id;
  const originalOperation = (await one("select gen_random_uuid() as id")).id;
  const replayOperation = (await one("select gen_random_uuid() as id")).id;
  const otherOperation = (await one("select gen_random_uuid() as id")).id;
  const fingerprint = "a".repeat(64);
  await client.query("set local role icamp_app");
  await client.query("select set_config('icamp.user_id',$1,true)", [actorA.id]);
  const original = await one(
    `insert into public.maintenance_offline_sync_conflicts
    (organization_id,campground_id,actor_user_id,client_operation_id,operation_kind,target_id,payload_fingerprint,reason_code)
    values($1,$2,$3,$4,'work_order_note',$5,$6,'stale_version') returning id`,
    [orgA.id, campA.id, actorA.id, originalOperation, targetA, fingerprint],
  );
  const repeat = await client.query(
    `insert into public.maintenance_offline_sync_conflicts
    (organization_id,campground_id,actor_user_id,client_operation_id,operation_kind,target_id,payload_fingerprint,reason_code)
    values($1,$2,$3,$4,'work_order_note',$5,$6,'stale_version')
    on conflict (actor_user_id,campground_id,client_operation_id) do nothing`,
    [orgA.id, campA.id, actorA.id, originalOperation, targetA, fingerprint],
  );
  assert.equal(
    repeat.rowCount,
    0,
    "Repeated conflict detections must not duplicate evidence",
  );
  await one(
    `insert into public.maintenance_offline_sync_receipts
    (organization_id,campground_id,actor_user_id,client_operation_id,operation_kind,target_id,payload_fingerprint,reviewed_conflict_id,resolution_reason)
    values($1,$2,$3,$4,'work_order_note',$5,$6,$7,'Reviewed current work-order assignment and version; retained field observation.') returning id`,
    [
      orgA.id,
      campA.id,
      actorA.id,
      replayOperation,
      targetA,
      fingerprint,
      original.id,
    ],
  );
  assert.equal(
    (
      await client.query(
        "select id from public.maintenance_offline_sync_receipts where reviewed_conflict_id=$1",
        [original.id],
      )
    ).rowCount,
    1,
  );
  await denied(
    `insert into public.maintenance_offline_sync_receipts
    (organization_id,campground_id,actor_user_id,client_operation_id,operation_kind,target_id,payload_fingerprint,reviewed_conflict_id,resolution_reason)
    values($1,$2,$3,$4,'work_order_note',$5,$6,$7,'Tried to cite conflict evidence for a different work order.')`,
    [
      orgA.id,
      campA.id,
      actorA.id,
      otherOperation,
      targetB,
      fingerprint,
      original.id,
    ],
    /Reviewed offline conflict does not match replay scope/,
  );
  await denied(
    "update public.maintenance_offline_sync_conflicts set reason_code='finalized' where id=$1",
    [original.id],
    /permission denied|immutable/i,
  );
  await denied(
    "delete from public.maintenance_offline_sync_conflicts where id=$1",
    [original.id],
    /permission denied|immutable/i,
  );

  await client.query("select set_config('icamp.user_id',$1,true)", [actorB.id]);
  assert.equal(
    (
      await client.query(
        "select id from public.maintenance_offline_sync_conflicts where id=$1",
        [original.id],
      )
    ).rowCount,
    0,
  );
  assert.equal(
    (
      await client.query(
        "select id from public.maintenance_offline_sync_receipts where reviewed_conflict_id=$1",
        [original.id],
      )
    ).rowCount,
    0,
  );
  await denied(
    `insert into public.maintenance_offline_sync_conflicts
    (organization_id,campground_id,actor_user_id,client_operation_id,operation_kind,target_id,payload_fingerprint,reason_code)
    values($1,$2,$3,$4,'work_order_note',$5,$6,'stale_version')`,
    [orgA.id, campA.id, actorB.id, otherOperation, targetA, fingerprint],
    /row-level security|violates/i,
  );
  assert.equal(
    (
      await client.query(
        "select count(*)::int as n from public.maintenance_offline_sync_conflicts",
      )
    ).rows[0].n,
    0,
  );
  await client.query("rollback");
  process.stdout.write(
    "Build189 PostgreSQL: conflict dedupe, reviewed replay, immutability and cross-tenant RLS PASS (rolled back).\n",
  );
} catch (error) {
  await client.query("rollback").catch(() => undefined);
  throw error;
} finally {
  await client.end();
}
