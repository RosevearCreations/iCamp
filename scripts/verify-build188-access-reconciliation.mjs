import assert from "node:assert/strict";
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl)
  throw new Error("DATABASE_URL required for Build188 lifecycle verification.");
const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();

async function one(sql, args = []) {
  const result = await client.query(sql, args);
  assert.equal(result.rowCount, 1);
  return result.rows[0];
}
async function expectedFailure(sql, args, pattern) {
  await client.query("savepoint build188_denial");
  let rejected = false;
  try {
    await client.query(sql, args);
  } catch (error) {
    rejected = true;
    assert.match(String(error.message), pattern);
  } finally {
    await client.query("rollback to savepoint build188_denial");
    await client.query("release savepoint build188_denial");
  }
  assert.ok(rejected, `Expected rejection of ${sql.slice(0, 50)}`);
}

try {
  await client.query("begin");
  const orgA = await one(
    "insert into public.organizations(name,slug) values('Build188 Test A','build188-test-a') returning id",
  );
  const orgB = await one(
    "insert into public.organizations(name,slug) values('Build188 Test B','build188-test-b') returning id",
  );
  const campA = await one(
    "insert into public.campgrounds(organization_id,name,slug) values($1,'Build188 A','build188-test-a') returning id",
    [orgA.id],
  );
  const campB = await one(
    "insert into public.campgrounds(organization_id,name,slug) values($1,'Build188 B','build188-test-b') returning id",
    [orgB.id],
  );
  const security = await one(
    "insert into icamp_private.user_accounts(email_normalized,account_type) values('build188-security@test.invalid','staff') returning id",
  );
  const front = await one(
    "insert into icamp_private.user_accounts(email_normalized,account_type) values('build188-front@test.invalid','staff') returning id",
  );
  const other = await one(
    "insert into icamp_private.user_accounts(email_normalized,account_type) values('build188-other@test.invalid','staff') returning id",
  );
  for (const [userId, orgId, campgroundId, roleCode] of [
    [security.id, orgA.id, campA.id, "security"],
    [front.id, orgA.id, campA.id, "front_desk"],
    [other.id, orgB.id, campB.id, "security"],
  ]) {
    const assignment = await one(
      "insert into icamp_private.campground_assignments(user_id,organization_id,campground_id) values($1,$2,$3) returning id",
      [userId, orgId, campgroundId],
    );
    await client.query(
      `insert into icamp_private.campground_assignment_roles(assignment_id,role_id)
      select $1,id from icamp_private.roles where role_code=$2 and role_kind='template'`,
      [assignment.id, roleCode],
    );
  }
  const credA = await one(
    `insert into public.access_credentials
    (organization_id,campground_id,credential_number,credential_type,subject_kind,subject_label)
    values($1,$2,'AC-BUILD188A','wristband','other','Synthetic reviewer credential') returning id,row_version`,
    [orgA.id, campA.id],
  );
  const credB = await one(
    `insert into public.access_credentials
    (organization_id,campground_id,credential_number,credential_type,subject_kind,subject_label)
    values($1,$2,'AC-BUILD188B','wristband','other','Different campground credential') returning id,row_version`,
    [orgB.id, campB.id],
  );

  await client.query("set local role icamp_app");
  await client.query("select set_config('icamp.user_id',$1,true)", [
    security.id,
  ]);
  const sources = await client.query(
    "select * from icamp_private.access_reconciliation_sources($1)",
    [campA.id],
  );
  assert.equal(sources.rowCount, 1);
  assert.equal(sources.rows[0].credential_id, credA.id);
  assert.equal(sources.rows[0].source_status, "not_applicable");
  assert.equal(
    (
      await client.query(
        "select * from icamp_private.access_reconciliation_sources($1)",
        [campB.id],
      )
    ).rowCount,
    0,
  );
  await one(
    `insert into icamp_private.access_reconciliation_reviews
    (organization_id,campground_id,credential_id,actor_user_id,disposition,reason,credential_status_snapshot,
      source_status_snapshot,observed_verdict,credential_version_snapshot)
    values($1,$2,$3,$4,'override_reviewed','In-app review only: staff must resolve original source mismatch.','active','not_applicable','valid_in_app',$5) returning id`,
    [orgA.id, campA.id, credA.id, security.id, credA.row_version],
  );
  assert.equal(
    (
      await client.query(
        "select * from icamp_private.access_reconciliation_reviews where campground_id=$1",
        [campA.id],
      )
    ).rowCount,
    1,
  );
  assert.equal(
    (
      await client.query(
        "select * from icamp_private.access_reconciliation_reviews where campground_id=$1",
        [campB.id],
      )
    ).rowCount,
    0,
    "An assigned security reviewer must not read another campground's evidence",
  );
  await expectedFailure(
    "update icamp_private.access_reconciliation_reviews set reason='Changed evidence not allowed' where credential_id=$1",
    [credA.id],
    /permission denied|immutable/,
  );
  await expectedFailure(
    `insert into icamp_private.access_reconciliation_reviews
    (organization_id,campground_id,credential_id,actor_user_id,disposition,reason,credential_status_snapshot,
      source_status_snapshot,observed_verdict,credential_version_snapshot)
    values($1,$2,$3,$4,'acknowledged','Tampered source status cannot become immutable evidence.','active','fabricated','valid_in_app',$5)`,
    [orgA.id, campA.id, credA.id, security.id, credA.row_version],
    /source review snapshot is stale/,
  );
  await expectedFailure(
    `insert into icamp_private.access_reconciliation_reviews
    (organization_id,campground_id,credential_id,actor_user_id,disposition,reason,credential_status_snapshot,
      source_status_snapshot,observed_verdict,credential_version_snapshot)
    values($1,$2,$3,$4,'acknowledged','Tampered eligibility verdict cannot be entered.','active','not_applicable','revoked',$5)`,
    [orgA.id, campA.id, credA.id, security.id, credA.row_version],
    /verdict does not match canonical source/,
  );
  await expectedFailure(
    `insert into icamp_private.access_reconciliation_reviews
    (organization_id,campground_id,credential_id,actor_user_id,disposition,reason,credential_status_snapshot,
      source_status_snapshot,observed_verdict,credential_version_snapshot)
    values($1,$2,$3,$4,'acknowledged','Cross-scope review should never be accepted.','active','not_applicable','valid_in_app',$5)`,
    [orgB.id, campB.id, credB.id, security.id, credB.row_version],
    /row-level security|policy|permission|snapshot is stale/,
  );
  await client.query("select set_config('icamp.user_id',$1,true)", [front.id]);
  await expectedFailure(
    `insert into icamp_private.access_reconciliation_reviews
    (organization_id,campground_id,credential_id,actor_user_id,disposition,reason,credential_status_snapshot,
      source_status_snapshot,observed_verdict,credential_version_snapshot)
    values($1,$2,$3,$4,'acknowledged','Front desk cannot sign elevated reconciliation reviews.','active','not_applicable','valid_in_app',$5)`,
    [orgA.id, campA.id, credA.id, front.id, credA.row_version],
    /row-level security|policy|permission/,
  );
  await client.query("rollback");
  process.stdout.write(
    "Build 188 scoped source, forced RLS, reasoned review and immutable evidence lifecycle passed (rolled back).\n",
  );
} catch (error) {
  await client.query("rollback").catch(() => undefined);
  throw error;
} finally {
  await client.end();
}
