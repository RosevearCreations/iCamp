import pg from "pg";
import { getCampgroundAuthorization } from "../authz/postgres.mjs";
import { normalizeTrendAnnotation, normalizeHandoffPlan } from "./core.mjs";
let pool;
function database() {
  if (!pool) {
    if (!process.env.DATABASE_URL?.trim())
      throw new Error("DATABASE_URL required for owner planning.");
    pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      connectionTimeoutMillis: 5000,
    });
  }
  return pool;
}
async function owner(actor, campgroundId) {
  const auth = await getCampgroundAuthorization(actor, campgroundId);
  if (
    !auth?.roleCodes?.includes("owner_admin") ||
    !auth.permissions?.includes("permanent_unit.transfer")
  )
    throw new Error(
      "An active Owner / Administrator assignment is required on each campground.",
    );
  return auth;
}
async function scoped(actor, readOnly, work) {
  const client = await database().connect();
  try {
    await client.query(readOnly ? "begin read only" : "begin");
    await client.query("set local role icamp_app");
    await client.query("set local time zone 'UTC'");
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
export async function getOwnerPlanning(actorUserId, authorizedCampgroundIds) {
  // Caller supplies IDs from Build 101's independently checked owner report; SQL RLS rechecks every row.
  const camps = [...new Set(authorizedCampgroundIds)].slice(0, 50);
  if (!camps.length)
    return {
      annotations: [],
      handoffs: [],
      annotationLimited: false,
      handoffLimited: false,
    };
  await Promise.all(camps.map((c) => owner(actorUserId, c)));
  return scoped(actorUserId, true, async (client) => {
    const [annotations, handoffs] = await Promise.all([
      client.query(
        `select id,campground_id,week_start::text as week_start,metric,disposition,evidence_reference,note,next_review_at,recorded_at
         from public.permanent_unit_finance_owner_trend_annotations
         where campground_id=any($1::uuid[]) order by recorded_at desc,id desc limit 101`,
        [camps],
      ),
      client.query(
        `select id,source_campground_id,target_campground_id,source_annotation_id,planning_scope,
         due_at,evidence_reference,owner_note,planned_at
         from public.permanent_unit_finance_owner_handoff_plans
         where source_campground_id=any($1::uuid[]) and target_campground_id=any($1::uuid[])
         order by planned_at desc,id desc limit 101`,
        [camps],
      ),
    ]);
    return {
      annotations: annotations.rows.slice(0, 100).map((r) => ({
        id: r.id,
        campgroundId: r.campground_id,
        weekStart: r.week_start,
        metric: r.metric,
        disposition: r.disposition,
        evidenceReference: r.evidence_reference,
        note: r.note,
        nextReviewAt: r.next_review_at.toISOString(),
        recordedAt: r.recorded_at.toISOString(),
      })),
      handoffs: handoffs.rows.slice(0, 100).map((r) => ({
        id: r.id,
        sourceCampgroundId: r.source_campground_id,
        targetCampgroundId: r.target_campground_id,
        sourceAnnotationId: r.source_annotation_id,
        planningScope: r.planning_scope,
        dueAt: r.due_at.toISOString(),
        evidenceReference: r.evidence_reference,
        ownerNote: r.owner_note,
        plannedAt: r.planned_at.toISOString(),
      })),
      annotationLimited: annotations.rows.length > 100,
      handoffLimited: handoffs.rows.length > 100,
    };
  });
}
export async function recordOwnerTrendAnnotation({ actorUserId, ...raw }) {
  const v = normalizeTrendAnnotation(raw);
  await owner(actorUserId, v.campgroundId);
  return scoped(actorUserId, false, async (client) => {
    const result = await client.query(
      `insert into public.permanent_unit_finance_owner_trend_annotations
       (id,organization_id,campground_id,week_start,metric,disposition,evidence_reference,note,next_review_at,recorded_by_user_id)
       select $1,c.organization_id,c.id,$3::date,$4,$5,$6,$7,$8,$9
       from public.campgrounds c where c.id=$2 returning id`,
      [
        v.id,
        v.campgroundId,
        v.weekStart,
        v.metric,
        v.disposition,
        v.evidenceReference,
        v.note,
        v.nextReviewAt,
        actorUserId,
      ],
    );
    if (!result.rows[0]) throw new Error("Owner campground unavailable.");
    return result.rows[0].id;
  });
}
export async function recordOwnerHandoffPlan({ actorUserId, ...raw }) {
  const v = normalizeHandoffPlan(raw);
  await Promise.all([
    owner(actorUserId, v.sourceCampgroundId),
    owner(actorUserId, v.targetCampgroundId),
  ]);
  return scoped(actorUserId, false, async (client) => {
    const result = await client.query(
      `insert into public.permanent_unit_finance_owner_handoff_plans
       (id,source_organization_id,source_campground_id,target_organization_id,target_campground_id,
        source_annotation_id,planning_scope,due_at,evidence_reference,owner_note,planned_by_user_id)
       select $1,s.organization_id,s.id,t.organization_id,t.id,$4,$5,$6,$7,$8,$9
       from public.campgrounds s cross join public.campgrounds t where s.id=$2 and t.id=$3 returning id`,
      [
        v.id,
        v.sourceCampgroundId,
        v.targetCampgroundId,
        v.sourceAnnotationId,
        v.planningScope,
        v.dueAt,
        v.evidenceReference,
        v.ownerNote,
        actorUserId,
      ],
    );
    if (!result.rows[0])
      throw new Error(
        "Source or target campground unavailable in the owner scope.",
      );
    return result.rows[0].id;
  });
}
