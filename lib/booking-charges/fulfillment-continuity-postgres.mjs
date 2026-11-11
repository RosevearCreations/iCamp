import pg from "pg";

import { appendAuditEvent } from "../audit/postgres.mjs";
import { hasCampgroundPermission } from "../authz/postgres.mjs";
import { validateSupervisorContinuityReview } from "./fulfillment-continuity-core.mjs";

const { Pool } = pg;
let pool;

function getPool() {
  if (!pool) {
    if (!process.env.DATABASE_URL?.trim()) {
      throw new Error(
        "DATABASE_URL is required for private supervisor continuity.",
      );
    }
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 4,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
  }
  return pool;
}

async function assertSupervisor(userId, campgroundId) {
  const permissions = await Promise.all([
    hasCampgroundPermission(userId, campgroundId, "staff.manage"),
    hasCampgroundPermission(userId, campgroundId, "reservation.modify"),
  ]);
  if (permissions.some((allowed) => !allowed)) {
    throw new Error("Private campground supervisor permission is required.");
  }
}

async function scopedTransaction(userId, work) {
  const client = await getPool().connect();
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

const iso = (value) =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();

export async function listSupervisorContinuityEvidence({
  userId,
  campgroundId,
}) {
  await assertSupervisor(userId, campgroundId);
  return scopedTransaction(userId, async (client) => {
    const rows = await client.query(
      `with ranked as (
         select e.*, row_number() over (
           partition by e.dispatch_id,e.review_kind
           order by e.reviewed_at desc,e.id desc
         ) as history_rank
         from public.service_fulfillment_supervisor_review_events e
         where e.campground_id=$1
       ) select * from ranked where history_rank=1
       order by reviewed_at desc,id desc limit 1501`,
      [campgroundId],
    );
    const mapped = rows.rows.slice(0, 1500).map((row) => ({
      id: row.id,
      dispatchId: row.dispatch_id,
      subjectId: row.subject_id,
      previousEventId: row.previous_event_id,
      reviewKind: row.review_kind,
      decision: row.decision,
      note: row.note,
      reviewedByUserId: row.reviewed_by_user_id,
      reviewedAt: iso(row.reviewed_at),
    }));
    return {
      caseFollowups: mapped.filter((row) => row.reviewKind === "case_followup"),
      deviceReviews: mapped.filter((row) => row.reviewKind === "field_device"),
      truncated: rows.rows.length > 1500,
    };
  });
}

export async function recordSupervisorContinuityReview({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  ...input
}) {
  await assertSupervisor(actorUserId, campgroundId);
  const review = validateSupervisorContinuityReview(input);
  return scopedTransaction(actorUserId, async (client) => {
    const dispatch = await client.query(
      `select organization_id from public.service_fulfillment_dispatches
       where campground_id=$1 and id=$2`,
      [campgroundId, review.dispatchId],
    );
    if (dispatch.rowCount !== 1)
      throw new Error("Source dispatch unavailable.");
    const organizationId = dispatch.rows[0].organization_id;
    const saved = await client.query(
      `insert into public.service_fulfillment_supervisor_review_events
       (organization_id,campground_id,dispatch_id,subject_id,previous_event_id,
        review_kind,decision,note,reviewed_by_user_id)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id`,
      [
        organizationId,
        campgroundId,
        review.dispatchId,
        review.subjectId,
        review.previousReviewId,
        review.reviewKind,
        review.decision,
        review.note,
        actorUserId,
      ],
    );
    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId,
      campgroundId,
      actionKey: "campground.fulfillment.supervisor_continuity_review",
      permissionKey: "staff.manage",
      subjectType: "service_fulfillment_supervisor_review_events",
      subjectId: saved.rows[0].id,
      afterState: {
        dispatchId: review.dispatchId,
        reviewKind: review.reviewKind,
        decision: review.decision,
        subjectId: review.subjectId,
        independentAcceptance: "HOLD",
      },
    });
    return { id: saved.rows[0].id };
  });
}
