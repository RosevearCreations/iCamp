import pg from "pg";
import { hasCampgroundPermission } from "../authz/postgres.mjs";
import {
  emergencyUuid,
  normalizeEmergencyPlan,
  normalizeEmergencyDecision,
} from "./core.mjs";

const { Pool } = pg;
let pool;
function connection() {
  if (!pool) {
    if (!process.env.DATABASE_URL?.trim())
      throw new Error("DATABASE_URL required for emergency notices.");
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
    });
  }
  return pool;
}
export async function closeEmergencyNoticePoolForTests() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}
async function transaction(actor, work) {
  const client = await connection().connect();
  try {
    await client.query("begin");
    await client.query("set local role icamp_app");
    await client.query("select set_config('icamp.user_id',$1,true)", [actor]);
    const result = await work(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
async function assertPermission(user, campground, permission) {
  if (!(await hasCampgroundPermission(user, campground, permission)))
    throw new Error("Not authorized for campground emergency notices.");
}
async function scope(client, campgroundId) {
  const { rows } = await client.query(
    "select id,organization_id,name,lifecycle_state from public.campgrounds where id=$1 and lifecycle_state<>'archived'",
    [campgroundId],
  );
  if (!rows[0]) throw new Error("Campground is unavailable.");
  return rows[0];
}
function matchingEvidence(record, expected) {
  return (
    Boolean(record) &&
    Object.entries(expected).every(([field, value]) => record[field] === value)
  );
}
export async function getEmergencyNoticePermissions(userId, campgroundId) {
  const [read, draft, record, approve] = await Promise.all(
    [
      "emergency.notice.read",
      "emergency.notice.draft",
      "emergency.notice.record",
      "emergency.broadcast",
    ].map((key) => hasCampgroundPermission(userId, campgroundId, key)),
  );
  return { read, draft, record, approve };
}
export async function getEmergencyNoticeDashboard(userId, campgroundId) {
  const camp = emergencyUuid(campgroundId, "Campground");
  await assertPermission(userId, camp, "emergency.notice.read");
  // These are exclusively site labels; the actor already holds the notice-read permission.
  // Scoped queries avoid exposing unrelated guests, staff contact details or reservation data.
  const [sections, accommodations] = await Promise.all([
    connection().query(
      "select id,name,code from public.campground_sections where campground_id=$1 and lifecycle_state='active' order by sort_order,name limit 250",
      [camp],
    ),
    connection().query(
      "select id,code,display_name from public.accommodations where campground_id=$1 and lifecycle_state='active' order by code limit 300",
      [camp],
    ),
  ]);
  return transaction(userId, async (client) => {
    const campground = await scope(client, camp);
    const [plans, events] = await Promise.all([
      client.query(
        "select * from public.emergency_notice_plans where campground_id=$1 order by created_at desc,id desc limit 150",
        [camp],
      ),
      client.query(
        "select * from public.emergency_notice_events where campground_id=$1 order by occurred_at desc,id desc limit 350",
        [camp],
      ),
    ]);
    return {
      campground,
      sections: sections.rows,
      accommodations: accommodations.rows,
      plans: plans.rows,
      events: events.rows,
      permissions: await getEmergencyNoticePermissions(userId, camp),
    };
  });
}
export async function createEmergencyNotice({
  actorUserId,
  campgroundId,
  ...input
}) {
  const camp = emergencyUuid(campgroundId, "Campground");
  const plan = normalizeEmergencyPlan(input);
  await assertPermission(actorUserId, camp, "emergency.notice.draft");
  return transaction(actorUserId, async (client) => {
    const scopeRow = await scope(client, camp);
    const old = await client.query(
      "select * from public.emergency_notice_plans where id=$1",
      [plan.id],
    );
    if (old.rows[0]) {
      if (
        !matchingEvidence(old.rows[0], {
          organization_id: scopeRow.organization_id,
          campground_id: camp,
          audience: plan.audience,
          section_id: plan.sectionId,
          accommodation_id: plan.accommodationId,
          severity: plan.severity,
          title: plan.title,
          message: plan.message,
          onsite_instructions: plan.onsiteInstructions,
          created_by_user_id: actorUserId,
        })
      )
        throw new Error(
          "Notice retry ID already belongs to different evidence.",
        );
      return old.rows[0];
    }
    const { rows } = await client.query(
      `insert into public.emergency_notice_plans
      (id,organization_id,campground_id,audience,section_id,accommodation_id,severity,title,message,onsite_instructions,created_by_user_id)
      values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning *`,
      [
        plan.id,
        scopeRow.organization_id,
        camp,
        plan.audience,
        plan.sectionId,
        plan.accommodationId,
        plan.severity,
        plan.title,
        plan.message,
        plan.onsiteInstructions,
        actorUserId,
      ],
    );
    return rows[0];
  });
}
export async function recordEmergencyNoticeDecision({
  actorUserId,
  campgroundId,
  ...input
}) {
  const camp = emergencyUuid(campgroundId, "Campground");
  const event = normalizeEmergencyDecision(input);
  await assertPermission(
    actorUserId,
    camp,
    event.kind === "manual_handoff"
      ? "emergency.notice.record"
      : "emergency.broadcast",
  );
  return transaction(actorUserId, async (client) => {
    const scopeRow = await scope(client, camp);
    const old = await client.query(
      "select * from public.emergency_notice_events where id=$1",
      [event.id],
    );
    if (old.rows[0]) {
      if (
        !matchingEvidence(old.rows[0], {
          organization_id: scopeRow.organization_id,
          campground_id: camp,
          notice_id: event.noticeId,
          kind: event.kind,
          method: event.method,
          evidence_reference: event.evidenceReference,
          real_world_boundary_ack: event.boundaryAcknowledged,
          onsite_plan_checked: event.onsitePlanChecked,
          note: event.note,
          actor_user_id: actorUserId,
        })
      )
        throw new Error(
          "Notice event retry ID already belongs to different evidence.",
        );
      return old.rows[0];
    }
    const { rows } = await client.query(
      `insert into public.emergency_notice_events
       (id,organization_id,campground_id,notice_id,kind,method,evidence_reference,
        real_world_boundary_ack,onsite_plan_checked,note,actor_user_id)
       values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning *`,
      [
        event.id,
        scopeRow.organization_id,
        camp,
        event.noticeId,
        event.kind,
        event.method,
        event.evidenceReference,
        event.boundaryAcknowledged,
        event.onsitePlanChecked,
        event.note,
        actorUserId,
      ],
    );
    return rows[0];
  });
}
