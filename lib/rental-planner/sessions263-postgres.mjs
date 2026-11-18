import pg from "pg";

import { appendAuditEvent } from "../audit/postgres.mjs";
import { hasCampgroundPermission } from "../authz/postgres.mjs";
import { normalizeRentalSession263 } from "./core.mjs";

const { Pool } = pg;
const UUID263 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
let pool;

function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL?.trim();
    if (!connectionString)
      throw new Error("Original rental session database is unavailable.");
    pool = new Pool({
      connectionString,
      max: 2,
      connectionTimeoutMillis: 4500,
      idleTimeoutMillis: 10000,
    });
  }
  return pool;
}

export async function closeRentalSessions263PoolForTests() {
  if (pool) await pool.end();
  pool = undefined;
}

async function authorized(actorUserId, campgroundId) {
  if (!UUID263.test(campgroundId) ||
      !(await hasCampgroundPermission(actorUserId, campgroundId, "rental.manage")))
    throw new Error("Current campground rental manager access required.");
}

async function inTransaction(actorUserId, work) {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    await client.query("set local statement_timeout='8500ms'");
    await client.query("select set_config('icamp.user_id',$1,true)", [actorUserId]);
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

export async function listSupervisedSessions263({ actorUserId, campgroundId }) {
  await authorized(actorUserId, campgroundId);
  const check = await getPool().query(
    "select to_regclass('icamp_private.rental_sessions263') is not null as installed",
  );
  if (check.rows[0]?.installed !== true)
    return {
      status: "HOLD_MIGRATION_0239_NOT_APPLIED",
      sessions: [],
      note: "Proposed sessions remain unavailable until the actual production migration is verified.",
    };
  const query = await getPool().query(
    "select s.id,s.offer_id,s.planned_day,s.start_minute,s.end_minute," +
      "s.participant_limit,s.activity_kind,s.safety_brief,s.status," +
      "a.display_name asset_name from icamp_private.rental_sessions263 s " +
      "join icamp_private.rental_planning_offers o on o.id=s.offer_id " +
      "join public.operational_assets a on a.id=o.asset_id " +
      "where s.campground_id=$1 and s.planned_day >= current_date - 7 " +
      "order by s.planned_day,s.start_minute,s.id limit 150",
    [campgroundId],
  );
  return {
    status: "ORIGINAL_STAFF_PLANS_OBSERVED_NOT_GUEST_BOOKINGS",
    sessions: query.rows.map((row) => ({
      id: row.id,
      offerId: row.offer_id,
      plannedDay: row.planned_day instanceof Date
        ? row.planned_day.toISOString().slice(0, 10)
        : String(row.planned_day).slice(0, 10),
      startMinute: Number(row.start_minute),
      endMinute: Number(row.end_minute),
      participantLimit: Number(row.participant_limit),
      activityKind: row.activity_kind,
      safetyBrief: row.safety_brief,
      status: row.status,
      assetName: row.asset_name,
    })),
    evidenceMayBeTruncated: query.rowCount >= 150,
  };
}

export async function planSupervisedSession263({
  actorUserId,
  actorSessionId,
  campgroundId,
  input,
}) {
  await authorized(actorUserId, campgroundId);
  const normalized = normalizeRentalSession263(input);
  return inTransaction(actorUserId, async (client) => {
    const origin = await client.query(
      "select o.organization_id,o.campground_id " +
        "from icamp_private.rental_planning_offers o " +
        "where o.id=$1 and o.campground_id=$2 for share",
      [normalized.offerId, campgroundId],
    );
    if (origin.rowCount !== 1)
      throw new Error("Original rental offer does not belong to this campground.");
    const organizationId = origin.rows[0].organization_id;
    const inserted = await client.query(
      "insert into icamp_private.rental_sessions263 (" +
        "organization_id,campground_id,offer_id,planned_day,start_minute," +
        "end_minute,participant_limit,activity_kind,safety_brief,planned_by_user_id) " +
        "values ($1,$2,$3,$4::date,$5,$6,$7,$8,$9,$10) returning id",
      [
        organizationId,
        campgroundId,
        normalized.offerId,
        normalized.plannedDay,
        normalized.startMinute,
        normalized.endMinute,
        normalized.participantLimit,
        normalized.activityKind,
        normalized.safetyBrief,
        actorUserId,
      ],
    );
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId,
      campgroundId,
      actionKey: "rental.session263.plan",
      permissionKey: "rental.manage",
      subjectType: "rental.supervised_session",
      subjectId: inserted.rows[0].id,
      afterState: {
        offerId: normalized.offerId,
        day: normalized.plannedDay,
        startMinute: normalized.startMinute,
        endMinute: normalized.endMinute,
        guestBookingCreated: false,
        moneyMovement: false,
      },
    });
    return inserted.rows[0].id;
  });
}

export async function cancelSupervisedSession263({
  actorUserId,
  actorSessionId,
  campgroundId,
  sessionId,
}) {
  await authorized(actorUserId, campgroundId);
  if (!UUID263.test(sessionId))
    throw new Error("Original supervised session ID is invalid.");
  return inTransaction(actorUserId, async (client) => {
    const original = await client.query(
      "select id,organization_id from icamp_private.rental_sessions263 " +
        "where id=$1 and campground_id=$2 and status='planned' for update",
      [sessionId, campgroundId],
    );
    if (original.rowCount !== 1)
      throw new Error("Original planned session is unavailable or already cancelled.");
    await client.query(
      "update icamp_private.rental_sessions263 set status='cancelled' " +
        "where id=$1 and campground_id=$2",
      [sessionId, campgroundId],
    );
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: original.rows[0].organization_id,
      campgroundId,
      actionKey: "rental.session263.cancel",
      permissionKey: "rental.manage",
      subjectType: "rental.supervised_session",
      subjectId: sessionId,
      afterState: {
        disposition: "cancelled_provisional_staff_session_only",
        guestBookingCancelled: false,
        moneyMovement: false,
      },
    });
    return sessionId;
  });
}
