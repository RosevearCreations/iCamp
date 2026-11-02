import pg from "pg";
import { getCampgroundAuthorization } from "../authz/postgres.mjs";
import {
  normalizeIndependentReview,
  normalizeReviewAcceptance,
} from "./core.mjs";
let pool;
function database() {
  if (!pool) {
    if (!process.env.DATABASE_URL?.trim())
      throw new Error(
        "DATABASE_URL required for owner resolution independent review.",
      );
    pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      connectionTimeoutMillis: 5000,
    });
  }
  return pool;
}
async function owner(actor, campgroundId) {
  const authorization = await getCampgroundAuthorization(actor, campgroundId);
  if (
    !authorization?.roleCodes?.includes("owner_admin") ||
    !authorization.permissions?.includes("permanent_unit.transfer")
  )
    throw new Error(
      "Independent review requires active Owner / Administrator finance permission at both campgrounds.",
    );
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
export async function getOwnerResolutionReview(
  actorUserId,
  authorizedCampgroundIds,
) {
  const ids = [...new Set(authorizedCampgroundIds)].slice(0, 50);
  if (!ids.length)
    return {
      reviews: [],
      acceptances: [],
      reviewsLimited: false,
      acceptancesLimited: false,
    };
  await Promise.all(ids.map((id) => owner(actorUserId, id)));
  return transaction(actorUserId, true, async (client) => {
    const reviews = await client.query(
      `select id,resolution_id,plan_id,source_campground_id,target_campground_id,review_kind,next_review_at,
       evidence_reference,reviewer_note,reviewed_by_user_id,reviewed_at
       from public.permanent_unit_finance_owner_resolution_reassessments
       where source_campground_id=any($1::uuid[]) and target_campground_id=any($1::uuid[])
       order by reviewed_at desc,id desc limit 301`,
      [ids],
    );
    const acceptances = await client.query(
      `select id,resolution_id,plan_id,reassessment_id,source_campground_id,target_campground_id,
       evidence_reference,acceptance_note,accepted_by_user_id,accepted_at
       from public.permanent_unit_finance_owner_resolution_acceptances
       where source_campground_id=any($1::uuid[]) and target_campground_id=any($1::uuid[])
       order by accepted_at desc,id desc limit 301`,
      [ids],
    );
    return {
      reviews: reviews.rows.slice(0, 300).map((r) => ({
        id: r.id,
        resolutionId: r.resolution_id,
        planId: r.plan_id,
        sourceCampgroundId: r.source_campground_id,
        targetCampgroundId: r.target_campground_id,
        reviewKind: r.review_kind,
        nextReviewAt: r.next_review_at?.toISOString() ?? null,
        evidenceReference: r.evidence_reference,
        reviewerNote: r.reviewer_note,
        reviewedByUserId: r.reviewed_by_user_id,
        reviewedAt: r.reviewed_at.toISOString(),
      })),
      acceptances: acceptances.rows.slice(0, 300).map((r) => ({
        id: r.id,
        resolutionId: r.resolution_id,
        planId: r.plan_id,
        reassessmentId: r.reassessment_id,
        sourceCampgroundId: r.source_campground_id,
        targetCampgroundId: r.target_campground_id,
        evidenceReference: r.evidence_reference,
        acceptanceNote: r.acceptance_note,
        acceptedByUserId: r.accepted_by_user_id,
        acceptedAt: r.accepted_at.toISOString(),
      })),
      reviewsLimited: reviews.rows.length > 300,
      acceptancesLimited: acceptances.rows.length > 300,
    };
  });
}
export async function recordOwnerResolutionReview({ actorUserId, ...input }) {
  const value = normalizeIndependentReview(input);
  await Promise.all([
    owner(actorUserId, value.sourceCampgroundId),
    owner(actorUserId, value.targetCampgroundId),
  ]);
  return transaction(actorUserId, false, async (client) => {
    const result = await client.query(
      `insert into public.permanent_unit_finance_owner_resolution_reassessments
       (id,resolution_id,plan_id,source_organization_id,source_campground_id,target_organization_id,
        target_campground_id,review_kind,next_review_at,evidence_reference,reviewer_note,reviewed_by_user_id)
       select $1,r.id,r.plan_id,r.source_organization_id,r.source_campground_id,
        r.target_organization_id,r.target_campground_id,$5,$6,$7,$8,$9
       from public.permanent_unit_finance_owner_handoff_resolutions r
       where r.id=$2 and r.plan_id=$3 and r.source_campground_id=$4 and r.target_campground_id=$10 returning id`,
      [
        value.id,
        value.resolutionId,
        value.planId,
        value.sourceCampgroundId,
        value.reviewKind,
        value.nextReviewAt,
        value.evidenceReference,
        value.reviewerNote,
        actorUserId,
        value.targetCampgroundId,
      ],
    );
    if (!result.rows[0])
      throw new Error("Resolution unavailable for this owner handoff scope.");
    return result.rows[0].id;
  });
}
export async function recordOwnerReviewAcceptance({ actorUserId, ...input }) {
  const value = normalizeReviewAcceptance(input);
  await Promise.all([
    owner(actorUserId, value.sourceCampgroundId),
    owner(actorUserId, value.targetCampgroundId),
  ]);
  return transaction(actorUserId, false, async (client) => {
    const result = await client.query(
      `insert into public.permanent_unit_finance_owner_resolution_acceptances
       (id,resolution_id,plan_id,reassessment_id,source_organization_id,source_campground_id,
        target_organization_id,target_campground_id,evidence_reference,acceptance_note,accepted_by_user_id)
       select $1,r.id,r.plan_id,$5,r.source_organization_id,r.source_campground_id,
        r.target_organization_id,r.target_campground_id,$6,$7,$8
       from public.permanent_unit_finance_owner_handoff_resolutions r
       where r.id=$2 and r.plan_id=$3 and r.source_campground_id=$4 and r.target_campground_id=$9 returning id`,
      [
        value.id,
        value.resolutionId,
        value.planId,
        value.sourceCampgroundId,
        value.reassessmentId,
        value.evidenceReference,
        value.acceptanceNote,
        actorUserId,
        value.targetCampgroundId,
      ],
    );
    if (!result.rows[0])
      throw new Error("Resolution unavailable for this owner handoff scope.");
    return result.rows[0].id;
  });
}
