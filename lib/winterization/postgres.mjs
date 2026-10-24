import pg from "pg";

import { hasCampgroundPermission } from "../authz/postgres.mjs";
import {
  normalizeWinterTemplate,
  normalizeWinterRun,
  normalizeWinterStep,
  normalizeWinterReview,
  winterUuid,
} from "./core.mjs";

const { Pool } = pg;
let pool;
function connection() {
  if (!pool) {
    if (!process.env.DATABASE_URL?.trim())
      throw new Error("DATABASE_URL is required for winterization.");
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }
  return pool;
}

export async function closeWinterizationPoolForTests() {
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
    throw new Error("Not authorized for campground winterization.");
}

export async function getWinterizationPermissions(userId, campgroundId) {
  const keys = [
    "winterization.read",
    "winterization.record",
    "winterization.template.manage",
    "winterization.signoff",
  ];
  const [read, record, templateManage, signoff] = await Promise.all(
    keys.map((key) => hasCampgroundPermission(userId, campgroundId, key)),
  );
  return { read, record, templateManage, signoff };
}

async function campgroundScope(client, campgroundId) {
  const result = await client.query(
    "select id,organization_id,name,lifecycle_state from public.campgrounds where id=$1 and lifecycle_state<>'archived'",
    [campgroundId],
  );
  if (!result.rows[0]) throw new Error("Campground is unavailable.");
  return result.rows[0];
}

function sameEvidence(row, input) {
  return Object.entries(input).every(([key, value]) => row[key] === value);
}

export async function getWinterizationDashboard(userId, campgroundId) {
  const camp = winterUuid(campgroundId, "Campground");
  await permission(userId, camp, "winterization.read");
  return transaction(userId, async (client) => {
    const campground = await campgroundScope(client, camp);
    const [templates, assignments, runs, steps, reviews, workOrders] =
      await Promise.all([
        client.query(
          `select * from public.winterization_templates where campground_id=$1
           order by version_number desc limit 40`,
          [camp],
        ),
        client.query(
          `select s.id,s.assignment_kind,s.occupancy_state,s.assignment_state,
             s.winterization_required,s.occupant_display_name,a.code,a.display_name
           from public.seasonal_assignments s join public.accommodations a
             on a.id=s.accommodation_id and a.campground_id=s.campground_id
           where s.campground_id=$1 and s.assignment_state='active'
           order by a.code limit 300`,
          [camp],
        ),
        client.query(
          `select * from public.winterization_runs where campground_id=$1
           order by winter_year desc,started_at desc,id desc limit 150`,
          [camp],
        ),
        client.query(
          `select * from public.winterization_step_events where campground_id=$1
           order by recorded_at desc,id desc limit 1200`,
          [camp],
        ),
        client.query(
          `select * from public.winterization_reviews where campground_id=$1
           order by reviewed_at desc,id desc limit 350`,
          [camp],
        ),
        client.query(
          `select id,title,status,accommodation_id from public.maintenance_work_orders
           where campground_id=$1 and status in ('open','assigned','in_progress','blocked')
           order by created_at desc limit 200`,
          [camp],
        ),
      ]);
    return {
      campground,
      templates: templates.rows,
      assignments: assignments.rows,
      runs: runs.rows,
      steps: steps.rows,
      reviews: reviews.rows,
      workOrders: workOrders.rows,
      permissions: await getWinterizationPermissions(userId, camp),
    };
  });
}

export async function createWinterizationTemplate({
  actorUserId,
  campgroundId,
  ...input
}) {
  const camp = winterUuid(campgroundId, "Campground");
  const template = normalizeWinterTemplate(input);
  await permission(actorUserId, camp, "winterization.template.manage");
  return transaction(actorUserId, async (client) => {
    const campground = await campgroundScope(client, camp);
    const existing = await client.query(
      "select * from public.winterization_templates where id=$1",
      [template.id],
    );
    if (existing.rows[0]) {
      if (
        !sameEvidence(existing.rows[0], {
          campground_id: camp,
          organization_id: campground.organization_id,
          name: template.name,
          instructions: template.instructions,
          created_by_user_id: actorUserId,
        }) ||
        JSON.stringify(existing.rows[0].steps) !==
          JSON.stringify(template.steps)
      )
        throw new Error("Template retry ID belongs to different evidence.");
      return existing.rows[0];
    }
    await client.query("select pg_advisory_xact_lock(hashtextextended($1,0))", [
      "winter-template:" + camp,
    ]);
    const version = await client.query(
      "select coalesce(max(version_number),0)+1 as version from public.winterization_templates where campground_id=$1",
      [camp],
    );
    const inserted = await client.query(
      `insert into public.winterization_templates
       (id,organization_id,campground_id,version_number,name,instructions,steps,created_by_user_id)
       values($1,$2,$3,$4,$5,$6,$7::jsonb,$8) returning *`,
      [
        template.id,
        campground.organization_id,
        camp,
        version.rows[0].version,
        template.name,
        template.instructions,
        JSON.stringify(template.steps),
        actorUserId,
      ],
    );
    return inserted.rows[0];
  });
}

export async function startWinterizationRun({
  actorUserId,
  campgroundId,
  ...input
}) {
  const camp = winterUuid(campgroundId, "Campground");
  const value = normalizeWinterRun(input);
  const permissions = await getWinterizationPermissions(actorUserId, camp);
  if (
    !permissions.record &&
    !(await hasCampgroundPermission(actorUserId, camp, "seasonal.manage"))
  )
    throw new Error("Not authorized to start a winterization run.");
  return transaction(actorUserId, async (client) => {
    const campground = await campgroundScope(client, camp);
    const existing = await client.query(
      "select * from public.winterization_runs where id=$1",
      [value.id],
    );
    if (existing.rows[0]) {
      if (
        !sameEvidence(existing.rows[0], {
          organization_id: campground.organization_id,
          campground_id: camp,
          assignment_id: value.assignmentId,
          template_id: value.templateId,
          winter_year: value.winterYear,
          created_by_user_id: actorUserId,
        })
      )
        throw new Error(
          "Winterization run retry ID belongs to different evidence.",
        );
      return existing.rows[0];
    }
    const result = await client.query(
      `insert into public.winterization_runs
       (id,organization_id,campground_id,assignment_id,template_id,winter_year,created_by_user_id)
       values($1,$2,$3,$4,$5,$6,$7) returning *`,
      [
        value.id,
        campground.organization_id,
        camp,
        value.assignmentId,
        value.templateId,
        value.winterYear,
        actorUserId,
      ],
    );
    return result.rows[0];
  });
}

export async function recordWinterizationStep({
  actorUserId,
  campgroundId,
  ...input
}) {
  const camp = winterUuid(campgroundId, "Campground");
  const value = normalizeWinterStep(input);
  await permission(actorUserId, camp, "winterization.record");
  return transaction(actorUserId, async (client) => {
    const campground = await campgroundScope(client, camp);
    const existing = await client.query(
      "select * from public.winterization_step_events where id=$1",
      [value.id],
    );
    if (existing.rows[0]) {
      if (
        !sameEvidence(existing.rows[0], {
          organization_id: campground.organization_id,
          campground_id: camp,
          run_id: value.runId,
          step_key: value.stepKey,
          result: value.result,
          evidence_reference: value.evidenceReference,
          note: value.note,
          work_order_id: value.workOrderId,
          actor_user_id: actorUserId,
        })
      )
        throw new Error(
          "Step evidence retry ID belongs to different evidence.",
        );
      return existing.rows[0];
    }
    const result = await client.query(
      `insert into public.winterization_step_events
       (id,organization_id,campground_id,run_id,step_key,result,evidence_reference,note,work_order_id,actor_user_id)
       values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning *`,
      [
        value.id,
        campground.organization_id,
        camp,
        value.runId,
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

export async function reviewWinterizationRun({
  actorUserId,
  campgroundId,
  ...input
}) {
  const camp = winterUuid(campgroundId, "Campground");
  const value = normalizeWinterReview(input);
  await permission(actorUserId, camp, "winterization.signoff");
  return transaction(actorUserId, async (client) => {
    const campground = await campgroundScope(client, camp);
    const existing = await client.query(
      "select * from public.winterization_reviews where id=$1",
      [value.id],
    );
    if (existing.rows[0]) {
      if (
        !sameEvidence(existing.rows[0], {
          organization_id: campground.organization_id,
          campground_id: camp,
          run_id: value.runId,
          decision: value.decision,
          note: value.note,
          actor_user_id: actorUserId,
        })
      )
        throw new Error("Sign-off retry ID belongs to different evidence.");
      return existing.rows[0];
    }
    const result = await client.query(
      `insert into public.winterization_reviews
       (id,organization_id,campground_id,run_id,decision,note,actor_user_id)
       values($1,$2,$3,$4,$5,$6,$7) returning *`,
      [
        value.id,
        campground.organization_id,
        camp,
        value.runId,
        value.decision,
        value.note,
        actorUserId,
      ],
    );
    return result.rows[0];
  });
}
