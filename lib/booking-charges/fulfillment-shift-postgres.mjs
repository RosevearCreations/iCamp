import pg from "pg";
import { appendAuditEvent } from "../audit/postgres.mjs";
import { hasCampgroundPermission } from "../authz/postgres.mjs";
import {
  validateShiftHandoffRequest,
  validateShiftHandoffDecision,
} from "./fulfillment-shift-core.mjs";

const { Pool } = pg;
let pool;
function getPool() {
  if (!pool) {
    if (!process.env.DATABASE_URL?.trim())
      throw new Error("DATABASE_URL required for shift review.");
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 4,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }
  return pool;
}
async function assertSupervisor(userId, campgroundId) {
  const grants = await Promise.all([
    hasCampgroundPermission(userId, campgroundId, "staff.manage"),
    hasCampgroundPermission(userId, campgroundId, "reservation.modify"),
  ]);
  if (grants.some((grant) => !grant))
    throw new Error("Campground supervisor access required.");
}
async function scoped(userId, work) {
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
const fromRow = (row) => ({
  id: row.id,
  dispatchId: row.dispatch_id,
  requestId: row.request_id,
  eventKind: row.event_kind,
  ownerEventId: row.owner_event_id,
  outgoingUserId: row.outgoing_user_id,
  incomingUserId: row.incoming_user_id,
  recordedByUserId: row.recorded_by_user_id,
  note: row.note,
  recordedAt: iso(row.recorded_at),
});

export async function listShiftRecoveryEvidence({ userId, campgroundId }) {
  await assertSupervisor(userId, campgroundId);
  return scoped(userId, async (client) => {
    const [colleagues, handoffs, reviews] = await Promise.all([
      client.query(
        "select user_id,email from icamp_private.list_fulfillment_shift_supervisors($1)",
        [campgroundId],
      ),
      client.query(
        "select * from public.service_fulfillment_shift_handoff_events where campground_id=$1 order by recorded_at desc,id desc limit 2001",
        [campgroundId],
      ),
      client.query(
        "select id,dispatch_id,review_kind,decision,reviewed_at from public.service_fulfillment_supervisor_review_events where campground_id=$1 order by reviewed_at desc,id desc limit 3001",
        [campgroundId],
      ),
    ]);
    const reviewRows = reviews.rows.slice(0, 3000).map((row) => ({
      id: row.id,
      dispatchId: row.dispatch_id,
      reviewKind: row.review_kind,
      decision: row.decision,
      reviewedAt: iso(row.reviewed_at),
    }));
    return {
      colleagues: colleagues.rows.map((row) => ({
        userId: row.user_id,
        email: row.email,
      })),
      handoffs: handoffs.rows.slice(0, 2000).map(fromRow),
      reviews: reviewRows,
      truncated: handoffs.rows.length > 2000 || reviews.rows.length > 3000,
    };
  });
}

export async function requestShiftHandoff({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  ...input
}) {
  await assertSupervisor(actorUserId, campgroundId);
  const request = validateShiftHandoffRequest(input);
  return scoped(actorUserId, async (client) => {
    const dispatch = await client.query(
      "select organization_id from public.service_fulfillment_dispatches where campground_id=$1 and id=$2",
      [campgroundId, request.dispatchId],
    );
    if (dispatch.rowCount !== 1)
      throw new Error("Source dispatch unavailable.");
    const organizationId = dispatch.rows[0].organization_id;
    const saved = await client.query(
      "insert into public.service_fulfillment_shift_handoff_events (organization_id,campground_id,dispatch_id,event_kind,owner_event_id,outgoing_user_id,incoming_user_id,recorded_by_user_id,note) values ($1,$2,$3,'request',$4,$5,$6,$7,$8) returning id",
      [
        organizationId,
        campgroundId,
        request.dispatchId,
        request.ownerEventId,
        actorUserId,
        request.targetUserId,
        actorUserId,
        request.note,
      ],
    );
    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId,
      campgroundId,
      actionKey: "campground.fulfillment.shift_handoff_requested",
      permissionKey: "staff.manage",
      subjectType: "service_fulfillment_shift_handoff_events",
      subjectId: saved.rows[0].id,
      afterState: {
        dispatchId: request.dispatchId,
        targetUserId: request.targetUserId,
        status: "awaiting_reviewer",
      },
    });
    return { id: saved.rows[0].id };
  });
}

export async function decideShiftHandoff({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  ...input
}) {
  await assertSupervisor(actorUserId, campgroundId);
  const decision = validateShiftHandoffDecision(input);
  return scoped(actorUserId, async (client) => {
    const request = await client.query(
      "select * from public.service_fulfillment_shift_handoff_events where campground_id=$1 and id=$2 and event_kind='request'",
      [campgroundId, decision.requestId],
    );
    if (request.rowCount !== 1) throw new Error("Source handoff unavailable.");
    const row = request.rows[0];
    const saved = await client.query(
      "insert into public.service_fulfillment_shift_handoff_events (organization_id,campground_id,dispatch_id,request_id,event_kind,owner_event_id,outgoing_user_id,incoming_user_id,recorded_by_user_id,note) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning id",
      [
        row.organization_id,
        campgroundId,
        row.dispatch_id,
        row.id,
        decision.decision,
        row.owner_event_id,
        row.outgoing_user_id,
        row.incoming_user_id,
        actorUserId,
        decision.note,
      ],
    );
    let newOwnershipId = null;
    if (decision.decision === "accept") {
      const ownership = await client.query(
        "insert into public.service_fulfillment_case_owner_events (organization_id,campground_id,dispatch_id,previous_event_id,claimed_by_user_id,changed_by_user_id,reason) values ($1,$2,$3,$4,$5,$6,$7) returning id",
        [
          row.organization_id,
          campgroundId,
          row.dispatch_id,
          row.owner_event_id,
          actorUserId,
          actorUserId,
          ("Shift handoff accepted: " + decision.note).slice(0, 300),
        ],
      );
      newOwnershipId = ownership.rows[0].id;
    }
    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: row.organization_id,
      campgroundId,
      actionKey: "campground.fulfillment.shift_handoff_" + decision.decision,
      permissionKey: "staff.manage",
      subjectType: "service_fulfillment_shift_handoff_events",
      subjectId: saved.rows[0].id,
      afterState: {
        dispatchId: row.dispatch_id,
        requestId: row.id,
        decision: decision.decision,
        newOwnershipId,
      },
    });
    return { id: saved.rows[0].id, newOwnershipId };
  });
}
