import pg from "pg";

import { appendAuditEvent } from "../audit/postgres.mjs";
import { hasCampgroundPermission } from "../authz/postgres.mjs";
import {
  normalizeRentalAllocation264,
  normalizeSupervisedPilot264,
} from "./allocations264.mjs";

const { Pool } = pg;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
let pool;
function connection() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL?.trim();
    if (!connectionString)
      throw new Error("Rental allocation database is unavailable.");
    pool = new Pool({
      connectionString,
      max: 3,
      connectionTimeoutMillis: 4500,
      idleTimeoutMillis: 10000,
    });
  }
  return pool;
}

export async function closeRentalAllocation264PoolForTests() {
  if (pool) await pool.end();
  pool = undefined;
}

async function requireManager(userId, campgroundId, pilot = false) {
  if (
    !UUID.test(campgroundId) ||
    !(await hasCampgroundPermission(userId, campgroundId, "rental.manage")) ||
    (pilot &&
      !(await hasCampgroundPermission(userId, campgroundId, "staff.manage")))
  )
    throw new Error(
      "Independent campground rental/staff manager permission required.",
    );
}

async function installed() {
  const result = await connection().query(
    "select to_regclass('icamp_private.rental_allocations264') is not null as allocations," +
      " to_regclass('icamp_private.rental_pilot_reviews264') is not null as pilots",
  );
  return (
    result.rows[0]?.allocations === true && result.rows[0]?.pilots === true
  );
}

async function transaction(actorUserId, job) {
  const client = await connection().connect();
  try {
    await client.query("begin");
    await client.query("set local statement_timeout='8000ms'");
    await client.query("select set_config('icamp.user_id',$1,true)", [
      actorUserId,
    ]);
    const result = await job(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

function day(value) {
  return value instanceof Date
    ? value.toISOString().slice(0, 10)
    : String(value).slice(0, 10);
}

export async function listManagedAllocations264({ actorUserId, campgroundId }) {
  await requireManager(actorUserId, campgroundId);
  if (!(await installed()))
    return {
      status: "HOLD_UNVERIFIED_OR_UNAPPLIED_PRODUCTION_MIGRATION_0240",
      reservations: [],
      pilotReviews: [],
    };
  const [rental, pilots] = await Promise.all([
    connection().query(
      "select a.id,a.request_id,a.offer_id,a.guest_user_id,a.start_date,a.end_date," +
        "a.status,a.approved_at,asset.display_name asset_name," +
        "req.status request_status from icamp_private.rental_allocations264 a " +
        "join icamp_private.rental_planning_requests req on req.id=a.request_id " +
        "join icamp_private.rental_planning_offers o on o.id=a.offer_id " +
        "join public.operational_assets asset on asset.id=o.asset_id " +
        "where a.campground_id=$1 order by a.approved_at desc,a.id limit 150",
      [campgroundId],
    ),
    connection().query(
      "select p.id,p.session_id,p.outcome,p.original_evidence_reference," +
        "p.reviewed_at,s.activity_kind from icamp_private.rental_pilot_reviews264 p " +
        "join icamp_private.rental_sessions263 s on s.id=p.session_id " +
        "where p.campground_id=$1 order by p.reviewed_at desc,p.id limit 150",
      [campgroundId],
    ),
  ]);
  return {
    status: "STAFF_SOURCE_OBSERVATIONS_NOT_PHYSICAL_ISSUE_OR_PAYMENT",
    reservations: rental.rows.map((row) => ({
      id: row.id,
      requestId: row.request_id,
      offerId: row.offer_id,
      guestUserId: row.guest_user_id,
      startDate: day(row.start_date),
      endDate: day(row.end_date),
      status: row.status,
      requestStatus: row.request_status,
      assetName: row.asset_name,
      approvedAt:
        row.approved_at instanceof Date
          ? row.approved_at.toISOString()
          : String(row.approved_at),
    })),
    pilotReviews: pilots.rows.map((row) => ({
      id: row.id,
      sessionId: row.session_id,
      outcome: row.outcome,
      originalEvidenceReference: row.original_evidence_reference,
      reviewedAt:
        row.reviewed_at instanceof Date
          ? row.reviewed_at.toISOString()
          : String(row.reviewed_at),
      activityKind: row.activity_kind,
    })),
    coverageCapped: rental.rowCount >= 150 || pilots.rowCount >= 150,
  };
}

export async function listOwnRentalAllocations264({ guestUserId }) {
  if (!UUID.test(guestUserId)) throw new Error("Authenticated guest required.");
  if (!(await installed()))
    return {
      status: "HOLD_UNVERIFIED_OR_UNAPPLIED_PRODUCTION_MIGRATION_0240",
      reservations: [],
    };
  const result = await connection().query(
    "select a.id,a.request_id,a.start_date,a.end_date,a.status," +
      "asset.display_name asset_name,c.name campground_name " +
      "from icamp_private.rental_allocations264 a " +
      "join icamp_private.rental_planning_offers o on o.id=a.offer_id " +
      "join public.operational_assets asset on asset.id=o.asset_id " +
      "join public.campgrounds c on c.id=a.campground_id " +
      "where a.guest_user_id=$1 order by a.approved_at desc limit 100",
    [guestUserId],
  );
  return {
    status: "OWNER_ONLY_SOURCE_BACKED_NO_PAYMENT",
    reservations: result.rows.map((row) => ({
      id: row.id,
      requestId: row.request_id,
      assetName: row.asset_name,
      campgroundName: row.campground_name,
      startDate: day(row.start_date),
      endDate: day(row.end_date),
      status: row.status,
    })),
  };
}

export async function reserveRentalAsset264({
  actorUserId,
  actorSessionId,
  campgroundId,
  input,
}) {
  await requireManager(actorUserId, campgroundId);
  if (!(await installed()))
    throw new Error("Production migration 0240 is not installed.");
  const normalized = normalizeRentalAllocation264(input);
  return transaction(actorUserId, async (client) => {
    const result = await client.query(
      "select r.id,r.organization_id,r.campground_id,r.offer_id,r.reservation_id," +
        "r.guest_user_id,r.start_date,r.end_date,r.status from " +
        "icamp_private.rental_planning_requests r " +
        "where r.id=$1 and r.campground_id=$2 for update",
      [normalized.requestId, campgroundId],
    );
    if (result.rowCount !== 1)
      throw new Error(
        "No original reviewed guest rental plan for this campground.",
      );
    const original = result.rows[0];
    const replay = await client.query(
      "select id,status from icamp_private.rental_allocations264 where request_id=$1",
      [normalized.requestId],
    );
    if (replay.rowCount) {
      if (replay.rows[0].status === "reserved_for_staff_collection")
        return replay.rows[0].id;
      throw new Error(
        "Cancelled original reservation cannot be silently reactivated.",
      );
    }
    if (original.status !== "reviewed")
      throw new Error("Staff must first review the original guest request.");
    const saved = await client.query(
      "insert into icamp_private.rental_allocations264 (" +
        "organization_id,campground_id,offer_id,request_id,reservation_id," +
        "guest_user_id,start_date,end_date,staff_safety_review,approved_by_user_id" +
        ") values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning id",
      [
        original.organization_id,
        campgroundId,
        original.offer_id,
        original.id,
        original.reservation_id,
        original.guest_user_id,
        original.start_date,
        original.end_date,
        normalized.staffSafetyReview,
        actorUserId,
      ],
    );
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: original.organization_id,
      campgroundId,
      actionKey: "rental.allocation264.reserve",
      permissionKey: "rental.manage",
      subjectType: "rental.source_asset_reservation",
      subjectId: saved.rows[0].id,
      afterState: {
        requestId: original.id,
        sourceOfferId: original.offer_id,
        status: "reserved_for_staff_collection",
        paymentCaptured: false,
        assetIssued: false,
      },
    });
    return saved.rows[0].id;
  });
}

export async function cancelRentalAsset264({
  actorUserId,
  actorSessionId,
  campgroundId,
  allocationId,
}) {
  await requireManager(actorUserId, campgroundId);
  if (!UUID.test(allocationId))
    throw new Error("Invalid original allocation identifier.");
  if (!(await installed()))
    throw new Error("Production migration 0240 is not installed.");
  return transaction(actorUserId, async (client) => {
    const existing = await client.query(
      "select id,organization_id,request_id,offer_id from " +
        "icamp_private.rental_allocations264 where id=$1 and campground_id=$2 " +
        "and status='reserved_for_staff_collection' for update",
      [allocationId, campgroundId],
    );
    if (existing.rowCount !== 1)
      throw new Error("Active original rental reservation not found.");
    const record = existing.rows[0];
    await client.query(
      "update icamp_private.rental_allocations264 set status='cancelled' " +
        "where id=$1 and campground_id=$2",
      [allocationId, campgroundId],
    );
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: record.organization_id,
      campgroundId,
      actionKey: "rental.allocation264.cancel",
      permissionKey: "rental.manage",
      subjectType: "rental.source_asset_reservation",
      subjectId: allocationId,
      afterState: {
        requestId: record.request_id,
        sourceOfferId: record.offer_id,
        status: "cancelled",
        paymentCaptured: false,
      },
    });
    return allocationId;
  });
}

export async function recordSupervisedPilotReview264({
  actorUserId,
  actorSessionId,
  campgroundId,
  input,
}) {
  await requireManager(actorUserId, campgroundId, true);
  if (!(await installed()))
    throw new Error("Production migration 0240 is not installed.");
  const normalized = normalizeSupervisedPilot264(input);
  return transaction(actorUserId, async (client) => {
    const source = await client.query(
      "select id,organization_id,campground_id from " +
        "icamp_private.rental_sessions263 where id=$1 and campground_id=$2 for share",
      [normalized.sessionId, campgroundId],
    );
    if (source.rowCount !== 1)
      throw new Error(
        "Original supervised session is outside this campground.",
      );
    const inserted = await client.query(
      "insert into icamp_private.rental_pilot_reviews264 (" +
        "organization_id,campground_id,session_id,outcome," +
        "original_evidence_reference,supervision_welfare_check,reviewer_user_id" +
        ") values ($1,$2,$3,$4,$5,$6,$7) returning id",
      [
        source.rows[0].organization_id,
        campgroundId,
        normalized.sessionId,
        normalized.outcome,
        normalized.originalEvidenceReference,
        normalized.supervisionWelfareCheck,
        actorUserId,
      ],
    );
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: source.rows[0].organization_id,
      campgroundId,
      actionKey: "rental.pilot264.independent_review",
      permissionKey: "staff.manage",
      subjectType: "rental.supervised_pilot_review",
      subjectId: inserted.rows[0].id,
      afterState: {
        sessionId: normalized.sessionId,
        outcome: normalized.outcome,
        originalEvidenceReference: normalized.originalEvidenceReference,
        guestBookingsEnabled: false,
        liveInsuranceCertified: false,
      },
    });
    return inserted.rows[0].id;
  });
}
