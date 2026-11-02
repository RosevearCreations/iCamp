import pg from "pg";
import { hasCampgroundPermission } from "../authz/postgres.mjs";
import {
  normalizeSpringTemplate,
  normalizeSpringInspection,
  normalizeSpringObservation,
  normalizeSpringDecision,
  winterUuid,
} from "./core.mjs";

const { Pool } = pg;
let pool;
function connection() {
  if (!pool) {
    if (!process.env.DATABASE_URL?.trim())
      throw new Error("DATABASE_URL is required for spring reopening.");
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }
  return pool;
}
export async function closeSpringReopeningPoolForTests() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

async function transaction(userId, work) {
  const client = await connection().connect();
  try {
    await client.query("begin");
    await client.query("set local role icamp_app");
    await client.query("select set_config('icamp.user_id',$1,true)", [userId]);
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

async function permission(userId, campgroundId, key) {
  if (!(await hasCampgroundPermission(userId, campgroundId, key)))
    throw new Error("Not authorized for campground spring reopening.");
}
function retryMatches(row, entries) {
  return Object.entries(entries).every(([key, value]) => row[key] === value);
}
async function campground(client, id) {
  const r = await client.query(
    "select id,organization_id,name,lifecycle_state from public.campgrounds where id=$1 and lifecycle_state<>'archived'",
    [id],
  );
  if (!r.rows[0]) throw new Error("Campground unavailable.");
  return r.rows[0];
}

export async function getSpringReopeningPermissions(userId, campgroundId) {
  const [read, record, policyManage, approve] = await Promise.all(
    [
      "spring.reopen.read",
      "spring.reopen.record",
      "spring.reopen.policy.manage",
      "spring.reopen.approve",
    ].map((key) => hasCampgroundPermission(userId, campgroundId, key)),
  );
  return { read, record, policyManage, approve };
}

export async function getSpringReopeningDashboard(userId, campgroundId) {
  const camp = winterUuid(campgroundId, "Campground");
  await permission(userId, camp, "spring.reopen.read");
  return transaction(userId, async (client) => {
    const property = await campground(client, camp);
    const [
      templates,
      accommodations,
      assignments,
      closureEvents,
      inspections,
      observations,
      decisions,
      workOrders,
    ] = await Promise.all([
      client.query(
        "select * from public.spring_reopening_templates where campground_id=$1 order by version_number desc limit 40",
        [camp],
      ),
      client.query(
        "select id,code,display_name,accommodation_kind,lifecycle_state from public.accommodations where campground_id=$1 and lifecycle_state='active' order by code limit 350",
        [camp],
      ),
      client.query(
        "select id,accommodation_id,assignment_kind,assignment_state,occupancy_state,winterization_required,occupant_display_name from public.seasonal_assignments where campground_id=$1 and assignment_state='active' order by created_at desc limit 350",
        [camp],
      ),
      client.query(
        "select id,assignment_id,effective_on,created_at from public.seasonal_assignment_events where campground_id=$1 and event_kind='winter_closed' order by created_at desc,id desc limit 600",
        [camp],
      ),
      client.query(
        "select * from public.spring_reopening_inspections where campground_id=$1 order by winter_year desc,started_at desc limit 150",
        [camp],
      ),
      client.query(
        "select * from public.spring_reopening_observations where campground_id=$1 order by observed_at desc,id desc limit 1800",
        [camp],
      ),
      client.query(
        "select * from public.spring_reopening_decisions where campground_id=$1 order by decided_at desc,id desc limit 350",
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
      closureEvents: closureEvents.rows.map((row) => ({
        ...row,
        effective_on:
          row.effective_on instanceof Date
            ? row.effective_on.toISOString().slice(0, 10)
            : String(row.effective_on).slice(0, 10),
      })),
      inspections: inspections.rows,
      observations: observations.rows,
      decisions: decisions.rows,
      workOrders: workOrders.rows,
      permissions: await getSpringReopeningPermissions(userId, camp),
    };
  });
}

export async function publishSpringTemplate({
  actorUserId,
  campgroundId,
  ...input
}) {
  const camp = winterUuid(campgroundId, "Campground");
  const value = normalizeSpringTemplate(input);
  await permission(actorUserId, camp, "spring.reopen.policy.manage");
  return transaction(actorUserId, async (client) => {
    const property = await campground(client, camp);
    const existing = await client.query(
      "select * from public.spring_reopening_templates where id=$1",
      [value.id],
    );
    if (existing.rows[0]) {
      if (
        !retryMatches(existing.rows[0], {
          organization_id: property.organization_id,
          campground_id: camp,
          name: value.name,
          instructions: value.instructions,
          created_by_user_id: actorUserId,
        }) ||
        JSON.stringify(existing.rows[0].steps) !== JSON.stringify(value.steps)
      )
        throw new Error("Template retry ID belongs to different evidence.");
      return existing.rows[0];
    }
    await client.query("select pg_advisory_xact_lock(hashtextextended($1,0))", [
      "spring-template:" + camp,
    ]);
    const next = await client.query(
      "select coalesce(max(version_number),0)+1 as version from public.spring_reopening_templates where campground_id=$1",
      [camp],
    );
    const inserted = await client.query(
      `insert into public.spring_reopening_templates
       (id,organization_id,campground_id,version_number,name,instructions,steps,created_by_user_id)
       values($1,$2,$3,$4,$5,$6,$7::jsonb,$8) returning *`,
      [
        value.id,
        property.organization_id,
        camp,
        next.rows[0].version,
        value.name,
        value.instructions,
        JSON.stringify(value.steps),
        actorUserId,
      ],
    );
    return inserted.rows[0];
  });
}

export async function startSpringInspection({
  actorUserId,
  campgroundId,
  ...input
}) {
  const camp = winterUuid(campgroundId, "Campground");
  const value = normalizeSpringInspection(input);
  await permission(actorUserId, camp, "spring.reopen.record");
  return transaction(actorUserId, async (client) => {
    const property = await campground(client, camp);
    const existing = await client.query(
      "select * from public.spring_reopening_inspections where id=$1",
      [value.id],
    );
    if (existing.rows[0]) {
      if (
        !retryMatches(existing.rows[0], {
          organization_id: property.organization_id,
          campground_id: camp,
          accommodation_id: value.accommodationId,
          assignment_id: value.assignmentId,
          template_id: value.templateId,
          winter_year: value.winterYear,
          water_service: value.waterService,
          operating_limits: value.operatingLimits,
          created_by_user_id: actorUserId,
        })
      )
        throw new Error("Inspection retry ID belongs to different evidence.");
      return existing.rows[0];
    }
    const inserted = await client.query(
      `insert into public.spring_reopening_inspections
       (id,organization_id,campground_id,accommodation_id,assignment_id,template_id,
        winter_year,water_service,operating_limits,created_by_user_id)
       values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning *`,
      [
        value.id,
        property.organization_id,
        camp,
        value.accommodationId,
        value.assignmentId,
        value.templateId,
        value.winterYear,
        value.waterService,
        value.operatingLimits,
        actorUserId,
      ],
    );
    return inserted.rows[0];
  });
}

export async function recordSpringObservation({
  actorUserId,
  campgroundId,
  ...input
}) {
  const camp = winterUuid(campgroundId, "Campground");
  const value = normalizeSpringObservation(input);
  await permission(actorUserId, camp, "spring.reopen.record");
  return transaction(actorUserId, async (client) => {
    const property = await campground(client, camp);
    const existing = await client.query(
      "select * from public.spring_reopening_observations where id=$1",
      [value.id],
    );
    if (existing.rows[0]) {
      if (
        !retryMatches(existing.rows[0], {
          organization_id: property.organization_id,
          campground_id: camp,
          inspection_id: value.inspectionId,
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
    const inserted = await client.query(
      `insert into public.spring_reopening_observations
       (id,organization_id,campground_id,inspection_id,step_key,result,
        evidence_reference,note,corrective_work_order_id,actor_user_id)
       values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning *`,
      [
        value.id,
        property.organization_id,
        camp,
        value.inspectionId,
        value.stepKey,
        value.result,
        value.evidenceReference,
        value.note,
        value.workOrderId,
        actorUserId,
      ],
    );
    return inserted.rows[0];
  });
}

export async function reviewSpringInspection({
  actorUserId,
  campgroundId,
  ...input
}) {
  const camp = winterUuid(campgroundId, "Campground");
  const value = normalizeSpringDecision(input);
  await permission(actorUserId, camp, "spring.reopen.approve");
  return transaction(actorUserId, async (client) => {
    const property = await campground(client, camp);
    const existing = await client.query(
      "select * from public.spring_reopening_decisions where id=$1",
      [value.id],
    );
    if (existing.rows[0]) {
      if (
        !retryMatches(existing.rows[0], {
          organization_id: property.organization_id,
          campground_id: camp,
          inspection_id: value.inspectionId,
          decision: value.decision,
          note: value.note,
          actor_user_id: actorUserId,
        })
      )
        throw new Error("Review retry ID belongs to different evidence.");
      return existing.rows[0];
    }
    const inserted = await client.query(
      `insert into public.spring_reopening_decisions
       (id,organization_id,campground_id,inspection_id,decision,note,actor_user_id)
       values($1,$2,$3,$4,$5,$6,$7) returning *`,
      [
        value.id,
        property.organization_id,
        camp,
        value.inspectionId,
        value.decision,
        value.note,
        actorUserId,
      ],
    );
    return inserted.rows[0];
  });
}
