import pg from "pg";
import { getCampgroundAuthorization } from "../authz/postgres.mjs";
import {
  normalizeHandoffOutcome,
  normalizeHandoffResolution,
} from "./core.mjs";
let pool;
function database() {
  if (!pool) {
    if (!process.env.DATABASE_URL?.trim())
      throw new Error("DATABASE_URL required for owner handoff outcomes.");
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
      "Active Owner / Administrator finance permission required on both campgrounds.",
    );
  return auth;
}
async function transaction(actor, readOnly, work) {
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
export async function getOwnerHandoffEvidence(
  actorUserId,
  authorizedCampgroundIds,
) {
  const ids = [...new Set(authorizedCampgroundIds)].slice(0, 50);
  if (!ids.length)
    return {
      outcomes: [],
      resolutions: [],
      outcomesLimited: false,
      resolutionsLimited: false,
    };
  await Promise.all(ids.map((id) => owner(actorUserId, id)));
  return transaction(actorUserId, true, async (client) => {
    const outcomes = await client.query(
      `select id,plan_id,source_campground_id,target_campground_id,outcome_kind,next_action_at,
       evidence_reference,owner_note,recorded_at
       from public.permanent_unit_finance_owner_handoff_outcomes
       where source_campground_id=any($1::uuid[]) and target_campground_id=any($1::uuid[])
       order by recorded_at desc,id desc limit 301`,
      [ids],
    );
    const resolutions = await client.query(
      `select id,plan_id,latest_outcome_id,source_campground_id,target_campground_id,resolution_kind,
       evidence_reference,owner_note,resolved_at
       from public.permanent_unit_finance_owner_handoff_resolutions
       where source_campground_id=any($1::uuid[]) and target_campground_id=any($1::uuid[])
       order by resolved_at desc,id desc limit 301`,
      [ids],
    );
    return {
      outcomes: outcomes.rows.slice(0, 300).map((r) => ({
        id: r.id,
        planId: r.plan_id,
        sourceCampgroundId: r.source_campground_id,
        targetCampgroundId: r.target_campground_id,
        outcomeKind: r.outcome_kind,
        nextActionAt: r.next_action_at?.toISOString() ?? null,
        evidenceReference: r.evidence_reference,
        ownerNote: r.owner_note,
        recordedAt: r.recorded_at.toISOString(),
      })),
      resolutions: resolutions.rows.slice(0, 300).map((r) => ({
        id: r.id,
        planId: r.plan_id,
        latestOutcomeId: r.latest_outcome_id,
        sourceCampgroundId: r.source_campground_id,
        targetCampgroundId: r.target_campground_id,
        resolutionKind: r.resolution_kind,
        evidenceReference: r.evidence_reference,
        ownerNote: r.owner_note,
        resolvedAt: r.resolved_at.toISOString(),
      })),
      outcomesLimited: outcomes.rows.length > 300,
      resolutionsLimited: resolutions.rows.length > 300,
    };
  });
}
export async function recordOwnerHandoffOutcome({ actorUserId, ...input }) {
  const v = normalizeHandoffOutcome(input);
  await Promise.all([
    owner(actorUserId, v.sourceCampgroundId),
    owner(actorUserId, v.targetCampgroundId),
  ]);
  return transaction(actorUserId, false, async (client) => {
    const result = await client.query(
      `insert into public.permanent_unit_finance_owner_handoff_outcomes
       (id,plan_id,source_organization_id,source_campground_id,target_organization_id,target_campground_id,
        outcome_kind,next_action_at,evidence_reference,owner_note,recorded_by_user_id)
       select $1,p.id,p.source_organization_id,p.source_campground_id,p.target_organization_id,p.target_campground_id,
        $4,$5,$6,$7,$8 from public.permanent_unit_finance_owner_handoff_plans p
       where p.id=$2 and p.source_campground_id=$3 and p.target_campground_id=$9 returning id`,
      [
        v.id,
        v.planId,
        v.sourceCampgroundId,
        v.outcomeKind,
        v.nextActionAt,
        v.evidenceReference,
        v.ownerNote,
        actorUserId,
        v.targetCampgroundId,
      ],
    );
    if (!result.rows[0])
      throw new Error(
        "Owner handoff plan unavailable to this source and target scope.",
      );
    return result.rows[0].id;
  });
}
export async function recordOwnerHandoffResolution({ actorUserId, ...input }) {
  const v = normalizeHandoffResolution(input);
  await Promise.all([
    owner(actorUserId, v.sourceCampgroundId),
    owner(actorUserId, v.targetCampgroundId),
  ]);
  return transaction(actorUserId, false, async (client) => {
    const result = await client.query(
      `insert into public.permanent_unit_finance_owner_handoff_resolutions
       (id,plan_id,latest_outcome_id,source_organization_id,source_campground_id,
        target_organization_id,target_campground_id,resolution_kind,evidence_reference,owner_note,resolved_by_user_id)
       select $1,p.id,$4,p.source_organization_id,p.source_campground_id,
        p.target_organization_id,p.target_campground_id,$5,$6,$7,$8
       from public.permanent_unit_finance_owner_handoff_plans p
       where p.id=$2 and p.source_campground_id=$3 and p.target_campground_id=$9 returning id`,
      [
        v.id,
        v.planId,
        v.sourceCampgroundId,
        v.latestOutcomeId,
        v.resolutionKind,
        v.evidenceReference,
        v.ownerNote,
        actorUserId,
        v.targetCampgroundId,
      ],
    );
    if (!result.rows[0])
      throw new Error(
        "Owner handoff plan unavailable to this source and target scope.",
      );
    return result.rows[0].id;
  });
}
