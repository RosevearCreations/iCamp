import pg from "pg";
import { appendAuditEvent } from "../audit/postgres.mjs";
import { hasCampgroundPermission } from "../authz/postgres.mjs";
import { validateFieldClosureEvidence } from "./fulfillment-performance-core.mjs";

let pool;
function database() {
  if (!pool) {
    if (!process.env.DATABASE_URL?.trim())
      throw new Error("DATABASE_URL required for closure evidence.");
    pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      max: 4,
      connectionTimeoutMillis: 5000,
    });
  }
  return pool;
}
async function assertSupervisor(userId, campgroundId) {
  const [staff, modify] = await Promise.all([
    hasCampgroundPermission(userId, campgroundId, "staff.manage"),
    hasCampgroundPermission(userId, campgroundId, "reservation.modify"),
  ]);
  if (!staff || !modify)
    throw new Error("Campground supervisor access required.");
}
async function transaction(userId, work) {
  const client = await database().connect();
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
export async function listFieldClosureEvidence({ userId, campgroundId }) {
  await assertSupervisor(userId, campgroundId);
  return transaction(userId, async (client) => {
    const records = await client.query(
      `select id,dispatch_id,field_report_id,review_id,previous_event_id,decision,
              evidence_reference,note,recorded_by_user_id,recorded_at
       from public.service_fulfillment_field_closure_events
       where campground_id=$1 order by recorded_at desc,id desc limit 1001`,
      [campgroundId],
    );
    return {
      events: records.rows.slice(0, 1000).map((row) => ({
        id: row.id,
        dispatchId: row.dispatch_id,
        fieldReportId: row.field_report_id,
        reviewId: row.review_id,
        previousEventId: row.previous_event_id,
        decision: row.decision,
        evidenceReference: row.evidence_reference,
        note: row.note,
        recordedByUserId: row.recorded_by_user_id,
        recordedAt: new Date(row.recorded_at).toISOString(),
      })),
      truncated: records.rows.length > 1000,
    };
  });
}
export async function recordFieldClosureEvidence({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  ...input
}) {
  await assertSupervisor(actorUserId, campgroundId);
  const evidence = validateFieldClosureEvidence(input);
  return transaction(actorUserId, async (client) => {
    const dispatch = await client.query(
      "select organization_id from public.service_fulfillment_dispatches where campground_id=$1 and id=$2",
      [campgroundId, evidence.dispatchId],
    );
    if (dispatch.rowCount !== 1)
      throw new Error("Source dispatch unavailable.");
    const organizationId = dispatch.rows[0].organization_id;
    const saved = await client.query(
      `insert into public.service_fulfillment_field_closure_events
       (organization_id,campground_id,dispatch_id,field_report_id,review_id,
        previous_event_id,decision,evidence_reference,note,recorded_by_user_id)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning id`,
      [
        organizationId,
        campgroundId,
        evidence.dispatchId,
        evidence.fieldReportId,
        evidence.reviewId,
        evidence.previousEventId,
        evidence.decision,
        evidence.evidenceReference,
        evidence.note,
        actorUserId,
      ],
    );
    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId,
      campgroundId,
      actionKey: "campground.fulfillment.field_closure_evidence",
      permissionKey: "staff.manage",
      subjectType: "service_fulfillment_field_closure_events",
      subjectId: saved.rows[0].id,
      afterState: {
        dispatchId: evidence.dispatchId,
        fieldReportId: evidence.fieldReportId,
        reviewId: evidence.reviewId,
        decision: evidence.decision,
        sourceReference: evidence.evidenceReference,
        independentAcceptance: "HOLD",
      },
    });
    return { id: saved.rows[0].id };
  });
}
