import pg from "pg";
import { getCampgroundAuthorization } from "../authz/postgres.mjs";
import {
  normalizeReopenActionPlan,
  normalizeHoldResolution,
} from "./plans-core.mjs";
let pool;
function database() {
  if (!process.env.DATABASE_URL?.trim())
    throw new Error("DATABASE_URL is required for owner action plans.");
  return (pool ??= new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    connectionTimeoutMillis: 5000,
  }));
}
async function authorize(actor, source, target) {
  const grants = await Promise.all(
    [source, target].map((id) => getCampgroundAuthorization(actor, id)),
  );
  if (
    source === target ||
    grants.some(
      (g) =>
        !g?.roleCodes?.includes("owner_admin") ||
        !g.permissions?.includes("permanent_unit.transfer"),
    )
  )
    throw new Error(
      "Active Owner / Administrator finance access to both campgrounds is required.",
    );
}
async function transaction(actor, readOnly, work) {
  const client = await database().connect();
  try {
    await client.query(readOnly ? "begin read only" : "begin");
    await client.query("set local role icamp_app");
    await client.query("set local time zone 'UTC'");
    await client.query("set local statement_timeout = '15000ms'");
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
export async function getOwnerReopenPlans(actor, source, target) {
  await authorize(actor, source, target);
  return transaction(actor, true, async (client) => {
    const [reviews, plans, resolutions] = await Promise.all([
      client.query(
        `select id,acceptance_id,review_kind,reviewed_at from public.owner_export_acceptance_exception_reviews where source_campground_id=$1 and target_campground_id=$2 order by reviewed_at desc,id desc limit 101`,
        [source, target],
      ),
      client.query(
        `select * from public.owner_export_reopen_action_plans where source_campground_id=$1 and target_campground_id=$2 order by planned_at desc,id desc limit 151`,
        [source, target],
      ),
      client.query(
        `select * from public.owner_export_reopen_hold_resolutions where source_campground_id=$1 and target_campground_id=$2 order by resolved_at desc,id desc limit 151`,
        [source, target],
      ),
    ]);
    return {
      reviews: reviews.rows.slice(0, 100),
      plans: plans.rows.slice(0, 150),
      resolutions: resolutions.rows.slice(0, 150),
      limited:
        reviews.rows.length > 100 ||
        plans.rows.length > 150 ||
        resolutions.rows.length > 150,
    };
  });
}
export async function recordOwnerReopenActionPlan({ actorUserId, ...raw }) {
  const v = normalizeReopenActionPlan(raw);
  await authorize(actorUserId, v.sourceCampgroundId, v.targetCampgroundId);
  return transaction(actorUserId, false, async (client) => {
    const r = await client.query(
      `insert into public.owner_export_reopen_action_plans (id,exception_review_id,source_campground_id,target_campground_id,action_kind,next_due_at,evidence_reference,action_note,planned_by_user_id) values($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id`,
      [
        v.id,
        v.exceptionReviewId,
        v.sourceCampgroundId,
        v.targetCampgroundId,
        v.actionKind,
        v.nextDueAt,
        v.evidenceReference,
        v.actionNote,
        actorUserId,
      ],
    );
    return r.rows[0];
  });
}
export async function recordIndependentHoldResolution({ actorUserId, ...raw }) {
  const v = normalizeHoldResolution(raw);
  await authorize(actorUserId, v.sourceCampgroundId, v.targetCampgroundId);
  return transaction(actorUserId, false, async (client) => {
    const r = await client.query(
      `insert into public.owner_export_reopen_hold_resolutions (id,action_plan_id,source_campground_id,target_campground_id,resolution_kind,evidence_reference,resolution_note,resolved_by_user_id) values($1,$2,$3,$4,$5,$6,$7,$8) returning id,observed_unclosed_cases,cases_since_acceptance`,
      [
        v.id,
        v.actionPlanId,
        v.sourceCampgroundId,
        v.targetCampgroundId,
        v.resolutionKind,
        v.evidenceReference,
        v.resolutionNote,
        actorUserId,
      ],
    );
    return r.rows[0];
  });
}
