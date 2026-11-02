import pg from "pg";
import { hasCampgroundPermission } from "../authz/postgres.mjs";
import {
  normalizeReadinessTemplate,
  normalizeReadinessAssessment,
  normalizeReadinessObservation,
  normalizeReadinessDecision,
  winterUuid,
} from "./core.mjs";

const { Pool } = pg;
let pool;
function connection() {
  if (!pool) {
    if (!process.env.DATABASE_URL?.trim())
      throw new Error("DATABASE_URL is required.");
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }
  return pool;
}
export async function closeReadinessPoolForTests() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}
async function transaction(userId, fn) {
  const client = await connection().connect();
  try {
    await client.query("begin");
    await client.query("set local role icamp_app");
    await client.query("select set_config('icamp.user_id',$1,true)", [userId]);
    const value = await fn(client);
    await client.query("commit");
    return value;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
async function permission(userId, campgroundId, key) {
  if (!(await hasCampgroundPermission(userId, campgroundId, key)))
    throw new Error("Not authorized for campground winter readiness.");
}
async function campground(client, id) {
  const result = await client.query(
    "select id,organization_id,name,lifecycle_state from public.campgrounds where id=$1 and lifecycle_state<>'archived'",
    [id],
  );
  if (!result.rows[0]) throw new Error("Campground is unavailable.");
  return result.rows[0];
}
function retryEqual(row, values) {
  return Object.entries(values).every(([key, value]) => row[key] === value);
}

export async function getReadinessPermissions(userId, campgroundId) {
  const keys = [
    "winter.readiness.read",
    "winter.readiness.record",
    "winter.readiness.policy.manage",
    "winter.readiness.approve",
  ];
  const [read, record, policyManage, approve] = await Promise.all(
    keys.map((key) => hasCampgroundPermission(userId, campgroundId, key)),
  );
  return { read, record, policyManage, approve };
}

export async function getReadinessDashboard(userId, campgroundId) {
  const camp = winterUuid(campgroundId, "Campground");
  await permission(userId, camp, "winter.readiness.read");
  return transaction(userId, async (client) => {
    const property = await campground(client, camp);
    const [
      templates,
      accommodations,
      assignments,
      assessments,
      observations,
      decisions,
      workOrders,
    ] = await Promise.all([
      client.query(
        "select * from public.winter_readiness_templates where campground_id=$1 order by version_number desc limit 40",
        [camp],
      ),
      client.query(
        "select id,code,display_name,accommodation_kind,lifecycle_state from public.accommodations where campground_id=$1 and lifecycle_state='active' order by code limit 350",
        [camp],
      ),
      client.query(
        "select id,accommodation_id,assignment_kind,assignment_state,occupancy_state,winterization_required from public.seasonal_assignments where campground_id=$1 and assignment_state='active' order by created_at desc limit 350",
        [camp],
      ),
      client.query(
        "select * from public.winter_readiness_assessments where campground_id=$1 order by winter_year desc,started_at desc limit 150",
        [camp],
      ),
      client.query(
        "select * from public.winter_readiness_observations where campground_id=$1 order by observed_at desc,id desc limit 1600",
        [camp],
      ),
      client.query(
        "select * from public.winter_readiness_decisions where campground_id=$1 order by decided_at desc,id desc limit 350",
        [camp],
      ),
      client.query(
        "select id,title,status,accommodation_id from public.maintenance_work_orders where campground_id=$1 and status in ('open','assigned','in_progress','blocked') order by created_at desc limit 200",
        [camp],
      ),
    ]);
    return {
      campground: property,
      templates: templates.rows,
      accommodations: accommodations.rows,
      assignments: assignments.rows,
      assessments: assessments.rows,
      observations: observations.rows,
      decisions: decisions.rows,
      workOrders: workOrders.rows,
      permissions: await getReadinessPermissions(userId, camp),
    };
  });
}

export async function publishReadinessTemplate({
  actorUserId,
  campgroundId,
  ...input
}) {
  const camp = winterUuid(campgroundId, "Campground");
  const value = normalizeReadinessTemplate(input);
  await permission(actorUserId, camp, "winter.readiness.policy.manage");
  return transaction(actorUserId, async (client) => {
    const property = await campground(client, camp);
    const existing = await client.query(
      "select * from public.winter_readiness_templates where id=$1",
      [value.id],
    );
    if (existing.rows[0]) {
      if (
        !retryEqual(existing.rows[0], {
          campground_id: camp,
          organization_id: property.organization_id,
          name: value.name,
          instructions: value.instructions,
          created_by_user_id: actorUserId,
        }) ||
        JSON.stringify(existing.rows[0].steps) !== JSON.stringify(value.steps)
      )
        throw new Error("Policy retry ID belongs to different evidence.");
      return existing.rows[0];
    }
    await client.query("select pg_advisory_xact_lock(hashtextextended($1,0))", [
      "winter-readiness-template:" + camp,
    ]);
    const version = await client.query(
      "select coalesce(max(version_number),0)+1 as version from public.winter_readiness_templates where campground_id=$1",
      [camp],
    );
    const result = await client.query(
      `insert into public.winter_readiness_templates
       (id,organization_id,campground_id,version_number,name,instructions,steps,created_by_user_id)
       values($1,$2,$3,$4,$5,$6,$7::jsonb,$8) returning *`,
      [
        value.id,
        property.organization_id,
        camp,
        version.rows[0].version,
        value.name,
        value.instructions,
        JSON.stringify(value.steps),
        actorUserId,
      ],
    );
    return result.rows[0];
  });
}

export async function startReadinessAssessment({
  actorUserId,
  campgroundId,
  ...input
}) {
  const camp = winterUuid(campgroundId, "Campground");
  const value = normalizeReadinessAssessment(input);
  await permission(actorUserId, camp, "winter.readiness.record");
  return transaction(actorUserId, async (client) => {
    const property = await campground(client, camp);
    const existing = await client.query(
      "select * from public.winter_readiness_assessments where id=$1",
      [value.id],
    );
    if (existing.rows[0]) {
      if (
        !retryEqual(existing.rows[0], {
          organization_id: property.organization_id,
          campground_id: camp,
          accommodation_id: value.accommodationId,
          assignment_id: value.assignmentId,
          template_id: value.templateId,
          winter_year: value.winterYear,
          water_mode: value.waterMode,
          operating_limits: value.operatingLimits,
          created_by_user_id: actorUserId,
        })
      )
        throw new Error("Assessment retry ID belongs to different evidence.");
      return existing.rows[0];
    }
    const result = await client.query(
      `insert into public.winter_readiness_assessments
       (id,organization_id,campground_id,accommodation_id,assignment_id,template_id,winter_year,water_mode,operating_limits,created_by_user_id)
       values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning *`,
      [
        value.id,
        property.organization_id,
        camp,
        value.accommodationId,
        value.assignmentId,
        value.templateId,
        value.winterYear,
        value.waterMode,
        value.operatingLimits,
        actorUserId,
      ],
    );
    return result.rows[0];
  });
}

export async function recordReadinessObservation({
  actorUserId,
  campgroundId,
  ...input
}) {
  const camp = winterUuid(campgroundId, "Campground");
  const value = normalizeReadinessObservation(input);
  await permission(actorUserId, camp, "winter.readiness.record");
  return transaction(actorUserId, async (client) => {
    const property = await campground(client, camp);
    const existing = await client.query(
      "select * from public.winter_readiness_observations where id=$1",
      [value.id],
    );
    if (existing.rows[0]) {
      if (
        !retryEqual(existing.rows[0], {
          organization_id: property.organization_id,
          campground_id: camp,
          assessment_id: value.assessmentId,
          step_key: value.stepKey,
          result: value.result,
          evidence_reference: value.evidenceReference,
          note: value.note,
          corrective_work_order_id: value.workOrderId,
          actor_user_id: actorUserId,
        })
      )
        throw new Error("Observation retry ID belongs to different evidence.");
      return existing.rows[0];
    }
    const result = await client.query(
      `insert into public.winter_readiness_observations
       (id,organization_id,campground_id,assessment_id,step_key,result,evidence_reference,note,corrective_work_order_id,actor_user_id)
       values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning *`,
      [
        value.id,
        property.organization_id,
        camp,
        value.assessmentId,
        value.stepKey,
        value.result,
        value.evidenceReference,
        value.note,
        value.workOrderId,
        actorUserId,
      ],
    );
    return result.rows[0];
  });
}

export async function reviewReadinessAssessment({
  actorUserId,
  campgroundId,
  ...input
}) {
  const camp = winterUuid(campgroundId, "Campground");
  const value = normalizeReadinessDecision(input);
  await permission(actorUserId, camp, "winter.readiness.approve");
  return transaction(actorUserId, async (client) => {
    const property = await campground(client, camp);
    const existing = await client.query(
      "select * from public.winter_readiness_decisions where id=$1",
      [value.id],
    );
    if (existing.rows[0]) {
      if (
        !retryEqual(existing.rows[0], {
          organization_id: property.organization_id,
          campground_id: camp,
          assessment_id: value.assessmentId,
          decision: value.decision,
          note: value.note,
          actor_user_id: actorUserId,
        })
      )
        throw new Error("Decision retry ID belongs to different evidence.");
      return existing.rows[0];
    }
    const result = await client.query(
      `insert into public.winter_readiness_decisions
       (id,organization_id,campground_id,assessment_id,decision,note,actor_user_id)
       values($1,$2,$3,$4,$5,$6,$7) returning *`,
      [
        value.id,
        property.organization_id,
        camp,
        value.assessmentId,
        value.decision,
        value.note,
        actorUserId,
      ],
    );
    return result.rows[0];
  });
}
