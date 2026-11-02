import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";

if (!process.env.DATABASE_URL)
  throw new Error("DATABASE_URL required for Build190 lifecycle verification.");
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
async function one(sql, args = []) {
  const result = await client.query(sql, args);
  assert.equal(result.rowCount, 1);
  return result.rows[0];
}
async function denied(sql, args, pattern) {
  await client.query("savepoint build190_denial");
  let rejected = false;
  try {
    await client.query(sql, args);
  } catch (error) {
    rejected = true;
    assert.match(String(error.message), pattern);
  } finally {
    await client.query("rollback to savepoint build190_denial");
    await client.query("release savepoint build190_denial");
  }
  assert.ok(rejected, "Expected Build190 operation to be rejected");
}
const later = (hours) => new Date(Date.now() + hours * 3_600_000).toISOString();
const ids = () => randomUUID();
async function actor(id) {
  await client.query("set local role icamp_app");
  await client.query("select set_config('icamp.user_id',$1,true)", [id]);
}

try {
  await client.query("begin");
  const orgA = await one(
    "insert into public.organizations(name,slug) values('Build190 Test A','build190-test-a') returning id",
  );
  const orgB = await one(
    "insert into public.organizations(name,slug) values('Build190 Test B','build190-test-b') returning id",
  );
  const campA = await one(
    "insert into public.campgrounds(organization_id,name,slug) values($1,'Build190 Camp A','build190-test-a') returning id",
    [orgA.id],
  );
  const campB = await one(
    "insert into public.campgrounds(organization_id,name,slug) values($1,'Build190 Camp B','build190-test-b') returning id",
    [orgB.id],
  );
  const managerA = await one(
    "insert into icamp_private.user_accounts(email_normalized,account_type) values('build190-manager-a@test.invalid','staff') returning id",
  );
  const managerB = await one(
    "insert into icamp_private.user_accounts(email_normalized,account_type) values('build190-manager-b@test.invalid','staff') returning id",
  );
  const staffA = await one(
    "insert into icamp_private.user_accounts(email_normalized,account_type) values('build190-staff-a@test.invalid','staff') returning id",
  );
  const staffB = await one(
    "insert into icamp_private.user_accounts(email_normalized,account_type) values('build190-staff-b@test.invalid','staff') returning id",
  );
  for (const [user, org, camp, role] of [
    [managerA.id, orgA.id, campA.id, "campground_manager"],
    [staffA.id, orgA.id, campA.id, "maintenance"],
    [staffB.id, orgA.id, campA.id, "maintenance"],
    [managerB.id, orgB.id, campB.id, "campground_manager"],
  ]) {
    const assignment = await one(
      "insert into icamp_private.campground_assignments(user_id,organization_id,campground_id) values($1,$2,$3) returning id",
      [user, org, camp],
    );
    await client.query(
      "insert into icamp_private.campground_assignment_roles(assignment_id,role_id) select $1,id from icamp_private.roles where role_code=$2 and role_kind='template'",
      [assignment.id, role],
    );
  }
  const shiftA = ids(),
    shiftB = ids(),
    qualA = ids(),
    handoff = ids();
  await actor(managerA.id);
  await one(
    `insert into icamp_private.staff_shift_qualification_events
    (id,organization_id,campground_id,staff_user_id,qualification_key,decision,source_reference,valid_until,review_note,reviewed_by_user_id)
    values($1,$2,$3,$4,'pool_lifeguard','verify','Verified synthetic certificate 190',$5,'Independent manager checked a future certificate expiry.',$6) returning id`,
    [qualA, orgA.id, campA.id, staffA.id, later(72), managerA.id],
  );
  await denied(
    `insert into icamp_private.staff_shift_qualification_events
    (organization_id,campground_id,staff_user_id,qualification_key,decision,source_reference,valid_until,review_note,reviewed_by_user_id)
    values($1,$2,$3,'first_aid','verify','Self certification prohibited',$4,'I independently verified myself which is prohibited.',$3)`,
    [orgA.id, campA.id, managerA.id, later(96)],
    /Independent campground staff manager|row-level security/i,
  );
  await one(
    `insert into icamp_private.staff_shift_assignments
    (id,organization_id,campground_id,staff_user_id,department,role_label,starts_at,ends_at,assignment_note,created_by_user_id)
    values($1,$2,$3,$4,'maintenance','Morning grounds maintenance',$5,$6,'Inspect and repair assigned outdoor maintenance.',$7) returning id`,
    [shiftA, orgA.id, campA.id, staffA.id, later(24), later(28), managerA.id],
  );
  await one(
    `insert into icamp_private.staff_shift_assignments
    (id,organization_id,campground_id,staff_user_id,department,role_label,starts_at,ends_at,assignment_note,created_by_user_id)
    values($1,$2,$3,$4,'grounds','Afternoon grounds review',$5,$6,'Review and follow up on unfinished grounds tasks.',$7) returning id`,
    [shiftB, orgA.id, campA.id, staffB.id, later(29), later(33), managerA.id],
  );
  await denied(
    `insert into icamp_private.staff_shift_assignments
    (organization_id,campground_id,staff_user_id,department,role_label,starts_at,ends_at,assignment_note,created_by_user_id)
    values($1,$2,$3,'maintenance','Overlapping maintenance',$4,$5,'Should be blocked by overlap review.',$6)`,
    [orgA.id, campA.id, staffA.id, later(25), later(29), managerA.id],
    /overlaps an existing active assignment/i,
  );
  await denied(
    `insert into icamp_private.staff_shift_assignments
    (organization_id,campground_id,staff_user_id,department,role_label,starts_at,ends_at,assignment_note,created_by_user_id)
    values($1,$2,$3,'aquatics','Unqualified pool safety role',$4,$5,'Must not schedule a staff member without verified training.',$6)`,
    [orgA.id, campA.id, staffB.id, later(48), later(52), managerA.id],
    /Unqualified or expiring staff/i,
  );
  const aquatic = ids();
  await one(
    `insert into icamp_private.staff_shift_assignments
    (id,organization_id,campground_id,staff_user_id,department,role_label,starts_at,ends_at,assignment_note,created_by_user_id)
    values($1,$2,$3,$4,'aquatics','Verified pool support shift',$5,$6,'Manager verified certification through the scheduled shift.',$7) returning id`,
    [aquatic, orgA.id, campA.id, staffA.id, later(48), later(52), managerA.id],
  );
  await denied(
    `insert into icamp_private.staff_shift_assignments
    (organization_id,campground_id,staff_user_id,department,role_label,starts_at,ends_at,assignment_note,created_by_user_id)
    values($1,$2,$3,'aquatics','Expiring certificate shift',$4,$5,'Expiry is before this scheduled shift ends.',$6)`,
    [orgA.id, campA.id, staffA.id, later(96), later(100), managerA.id],
    /Unqualified or expiring staff/i,
  );
  await one(
    `insert into icamp_private.staff_shift_handoffs
    (id,organization_id,campground_id,from_shift_id,to_shift_id,summary,outstanding_work,recorded_by_user_id)
    values($1,$2,$3,$4,$5,'Handoff covers checked equipment and pending work.','Drainage repairs remain open; verify barrier placement.',$6) returning id`,
    [handoff, orgA.id, campA.id, shiftA, shiftB, managerA.id],
  );
  await denied(
    `insert into icamp_private.staff_shift_events
    (organization_id,campground_id,shift_id,handoff_id,kind,reason,actor_user_id)
    values($1,$2,$3,$4,'handoff_ack','Manager cannot impersonate receiving staff acceptance.',$5)`,
    [orgA.id, campA.id, shiftB, handoff, managerA.id],
    /Only assigned receiving staff|row-level security/i,
  );
  await actor(staffB.id);
  await one(
    `insert into icamp_private.staff_shift_events
    (organization_id,campground_id,shift_id,handoff_id,kind,reason,actor_user_id)
    values($1,$2,$3,$4,'handoff_ack','I read pending drainage work and will check on-site.',$5) returning id`,
    [orgA.id, campA.id, shiftB, handoff, staffB.id],
  );
  await denied(
    `insert into icamp_private.staff_shift_events
    (organization_id,campground_id,shift_id,handoff_id,kind,reason,actor_user_id)
    values($1,$2,$3,$4,'handoff_ack','Duplicate receiving staff acknowledgment not allowed.',$5)`,
    [orgA.id, campA.id, shiftB, handoff, staffB.id],
    /duplicate key/i,
  );
  await actor(staffA.id);
  const unavailable = ids();
  await one(
    `insert into icamp_private.staff_shift_availability
    (id,organization_id,campground_id,staff_user_id,kind,starts_at,ends_at,reason,recorded_by_user_id)
    values($1,$2,$3,$4,'unavailable',$5,$6,'Personal unavailable period, no medical details.',$7) returning id`,
    [
      unavailable,
      orgA.id,
      campA.id,
      staffA.id,
      later(80),
      later(86),
      staffA.id,
    ],
  );
  await actor(managerA.id);
  await denied(
    `insert into icamp_private.staff_shift_assignments
    (organization_id,campground_id,staff_user_id,department,role_label,starts_at,ends_at,assignment_note,created_by_user_id)
    values($1,$2,$3,'maintenance','Unavailable staff work',$4,$5,'Must fail against own declared unavailability.',$6)`,
    [orgA.id, campA.id, staffA.id, later(81), later(85), managerA.id],
    /declared staff unavailability/i,
  );
  await denied(
    "update icamp_private.staff_shift_assignments set role_label='Changed' where id=$1",
    [shiftA],
    /permission denied|immutable/i,
  );
  await one(
    `insert into icamp_private.staff_shift_events
    (organization_id,campground_id,shift_id,kind,reason,actor_user_id)
    values($1,$2,$3,'cancel','Schedule owner cancelled while preserving original assignment.',$4) returning id`,
    [orgA.id, campA.id, shiftA, managerA.id],
  );
  await actor(managerB.id);
  for (const table of [
    "staff_shift_assignments",
    "staff_shift_qualification_events",
    "staff_shift_availability",
    "staff_shift_handoffs",
    "staff_shift_events",
  ]) {
    assert.equal(
      (
        await client.query(
          `select count(*)::integer as n from icamp_private.${table} where campground_id=$1`,
          [campA.id],
        )
      ).rows[0].n,
      0,
      `Cross-campground staffing evidence leaked via ${table}`,
    );
  }
  await denied(
    `insert into icamp_private.staff_shift_assignments
    (organization_id,campground_id,staff_user_id,department,role_label,starts_at,ends_at,assignment_note,created_by_user_id)
    values($1,$2,$3,'maintenance','Foreign campground shift',$4,$5,'This assignment must not cross the campground scope.',$6)`,
    [orgA.id, campA.id, staffA.id, later(120), later(124), managerB.id],
    /row-level security|Authorized manager/i,
  );
  await client.query("rollback");
  process.stdout.write(
    "Build190 PostgreSQL: independent qualification, expiry, overlap, availability, handoff acknowledgement, immutability and cross-tenant RLS PASS (rolled back).\n",
  );
} catch (error) {
  await client.query("rollback").catch(() => undefined);
  throw error;
} finally {
  await client.end();
}
