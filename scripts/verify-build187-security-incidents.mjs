import assert from "node:assert/strict";

import pg from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl)
  throw new Error(
    "DATABASE_URL is required for Build 187 lifecycle verification.",
  );

const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();

async function one(sql, args = []) {
  const result = await client.query(sql, args);
  assert.equal(result.rowCount, 1);
  return result.rows[0];
}

async function expectedFailure(sql, args, pattern) {
  await client.query("savepoint build187_expected");
  let rejected = false;
  try {
    await client.query(sql, args);
  } catch (error) {
    rejected = true;
    assert.match(String(error.message), pattern);
  } finally {
    await client.query("rollback to savepoint build187_expected");
    await client.query("release savepoint build187_expected");
  }
  assert.ok(rejected, `Expected DB guard to reject ${sql.slice(0, 72)}`);
}

try {
  await client.query("begin");
  const orgA = await one(
    "insert into public.organizations(name,slug) values('Build187 Test Organization A','build187-test-a') returning id",
  );
  const orgB = await one(
    "insert into public.organizations(name,slug) values('Build187 Test Organization B','build187-test-b') returning id",
  );
  const campA = await one(
    "insert into public.campgrounds(organization_id,name,slug) values($1,'Build187 Test A','build187-test-a') returning id",
    [orgA.id],
  );
  const campB = await one(
    "insert into public.campgrounds(organization_id,name,slug) values($1,'Build187 Test B','build187-test-b') returning id",
    [orgB.id],
  );
  const officer = await one(
    "insert into icamp_private.user_accounts(email_normalized,account_type) values('build187-officer@test.invalid','staff') returning id",
  );
  const reviewer = await one(
    "insert into icamp_private.user_accounts(email_normalized,account_type) values('build187-reviewer@test.invalid','staff') returning id",
  );
  const frontDesk = await one(
    "insert into icamp_private.user_accounts(email_normalized,account_type) values('build187-front@test.invalid','staff') returning id",
  );
  const otherOfficer = await one(
    "insert into icamp_private.user_accounts(email_normalized,account_type) values('build187-other@test.invalid','staff') returning id",
  );

  for (const [userId, organizationId, campgroundId, roleCode] of [
    [officer.id, orgA.id, campA.id, "security"],
    [reviewer.id, orgA.id, campA.id, "campground_manager"],
    [frontDesk.id, orgA.id, campA.id, "front_desk"],
    [otherOfficer.id, orgB.id, campB.id, "security"],
  ]) {
    const assignment = await one(
      `insert into icamp_private.campground_assignments(user_id,organization_id,campground_id)
      values($1,$2,$3) returning id`,
      [userId, organizationId, campgroundId],
    );
    await client.query(
      `insert into icamp_private.campground_assignment_roles(assignment_id,role_id)
      select $1,id from icamp_private.roles where role_code=$2 and role_kind='template'`,
      [assignment.id, roleCode],
    );
  }

  const caseA = await one(
    `insert into icamp_private.security_incident_cases
    (organization_id,campground_id,title,category,severity,operational_summary,opened_by_user_id)
    values($1,$2,'Restricted key incident','access','high','Independent closure requires retained evidence and findings.',$3)
    returning id`,
    [orgA.id, campA.id, officer.id],
  );
  const caseB = await one(
    `insert into icamp_private.security_incident_cases
    (organization_id,campground_id,title,category,severity,operational_summary,opened_by_user_id)
    values($1,$2,'Different tenant incident','access','high','Different campground details cannot be read by officer A.',$3)
    returning id`,
    [orgB.id, campB.id, otherOfficer.id],
  );
  await client.query(
    `insert into icamp_private.security_incident_events
    (organization_id,campground_id,case_id,actor_user_id,event_kind,summary)
    values($1,$2,$3,$4,'intake','Security case intake recorded.')`,
    [orgA.id, campA.id, caseA.id, officer.id],
  );

  await expectedFailure(
    `update icamp_private.security_incident_cases set
    status='closure_pending',closure_round=1,closure_requested_by_user_id=$2
    where id=$1`,
    [caseA.id, officer.id],
    /Closure request needs investigation and retained validated evidence/,
  );

  await client.query(
    `update icamp_private.security_incident_cases set status='investigating'
    where id=$1`,
    [caseA.id],
  );
  await client.query(
    `insert into icamp_private.security_incident_events
    (organization_id,campground_id,case_id,actor_user_id,event_kind,summary)
    values($1,$2,$3,$4,'investigated','Investigation of the observed concern recorded.')`,
    [orgA.id, campA.id, caseA.id, officer.id],
  );

  const media = await one(
    `insert into icamp_private.media_assets
    (organization_id,campground_id,classification,media_kind,storage_provider,bucket_key,
     object_key,original_filename,content_type,byte_size,checksum_sha256,
     validation_state,lifecycle_state,created_by_user_id,activated_at)
    values($1,$2,'confidential','document','supabase','icamp-confidential-media',
      $3,'evidence.pdf','application/pdf',26,$4,'validated','active',$5,statement_timestamp()) returning id`,
    [orgA.id, campA.id, `build187/${caseA.id}.pdf`, "f".repeat(64), officer.id],
  );
  await client.query(
    `insert into icamp_private.security_incident_attachments
    (organization_id,campground_id,case_id,media_asset_id,checksum_sha256,caption,actor_user_id)
    values($1,$2,$3,$4,$5,'Independent evidence photograph or report',$6)`,
    [orgA.id, campA.id, caseA.id, media.id, "f".repeat(64), officer.id],
  );
  await client.query(
    `insert into icamp_private.security_incident_events
    (organization_id,campground_id,case_id,actor_user_id,event_kind,summary)
    values($1,$2,$3,$4,'evidence_attached','Validated private evidence retained.')`,
    [orgA.id, campA.id, caseA.id, officer.id],
  );

  await expectedFailure(
    "update icamp_private.media_assets set lifecycle_state='deleted',deleted_at=now() where id=$1",
    [media.id],
    /Retained security incident evidence cannot be modified or removed/,
  );
  await expectedFailure(
    "delete from icamp_private.security_incident_events where case_id=$1",
    [caseA.id],
    /append-only/,
  );

  await client.query(
    `update icamp_private.security_incident_cases set
    status='closure_pending',closure_round=1,closure_requested_by_user_id=$2 where id=$1`,
    [caseA.id, officer.id],
  );
  await client.query(
    `insert into icamp_private.security_incident_events
    (organization_id,campground_id,case_id,actor_user_id,event_kind,summary)
    values($1,$2,$3,$4,'closure_requested','Investigation evidence offered for independent review.')`,
    [orgA.id, campA.id, caseA.id, officer.id],
  );

  await expectedFailure(
    `insert into icamp_private.security_incident_closure_reviews
    (organization_id,campground_id,case_id,closure_round,reviewer_user_id,decision,rationale)
    values($1,$2,$3,1,$4,'approved','Officer tries to independently approve own work.')`,
    [orgA.id, campA.id, caseA.id, officer.id],
    /Independent closure review is not eligible/,
  );
  await expectedFailure(
    `update icamp_private.security_incident_cases set
    status='closed',closed_by_user_id=$2,closed_at=now() where id=$1`,
    [caseA.id, reviewer.id],
    /independent approved review/,
  );

  const approved = await one(
    `insert into icamp_private.security_incident_closure_reviews
    (organization_id,campground_id,case_id,closure_round,reviewer_user_id,decision,rationale)
    values($1,$2,$3,1,$4,'approved','Independent review checks evidence and agrees with closure.') returning id`,
    [orgA.id, campA.id, caseA.id, reviewer.id],
  );
  await client.query(
    `update icamp_private.security_incident_cases set
    status='closed',closed_by_user_id=$2,closed_at=now() where id=$1`,
    [caseA.id, reviewer.id],
  );
  assert.equal(
    (
      await one(
        "select status from icamp_private.security_incident_cases where id=$1",
        [caseA.id],
      )
    ).status,
    "closed",
  );
  await expectedFailure(
    "delete from icamp_private.security_incident_closure_reviews where id=$1",
    [approved.id],
    /append-only/,
  );
  await expectedFailure(
    "delete from icamp_private.security_incident_cases where id=$1",
    [caseA.id],
    /append-only/,
  );

  await client.query("set local role icamp_app");
  await client.query("select set_config('icamp.user_id',$1,true)", [
    officer.id,
  ]);
  const officerCases = await client.query(
    "select id from icamp_private.security_incident_cases order by id",
  );
  assert.deepEqual(
    officerCases.rows.map((r) => r.id),
    [caseA.id],
  );
  assert.notEqual(caseA.id, caseB.id);
  const sensitiveCount = await one(
    "select count(*)::int as total from icamp_private.security_incident_attachments where campground_id=$1",
    [campA.id],
  );
  assert.equal(sensitiveCount.total, 1);
  await client.query("select set_config('icamp.user_id',$1,true)", [
    frontDesk.id,
  ]);
  const frontCases = await client.query(
    "select id from icamp_private.security_incident_cases",
  );
  assert.equal(frontCases.rowCount, 0);
  const frontSensitive = await client.query(
    "select id from icamp_private.security_incident_attachments",
  );
  assert.equal(frontSensitive.rowCount, 0);
  await expectedFailure(
    "delete from icamp_private.security_incident_cases where id=$1",
    [caseA.id],
    /permission denied/,
  );
  await client.query("reset role");
  console.log(
    "Build 187 DB lifecycle: tenant RLS, sensitive permission, immutable evidence, self-review denial, independent closure GREEN.",
  );
} finally {
  await client.query("rollback").catch(() => undefined);
  await client.end();
}
