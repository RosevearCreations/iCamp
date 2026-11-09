import pg from "pg";

import { appendAuditEvent } from "../audit/postgres.mjs";
import { hasCampgroundPermission } from "../authz/postgres.mjs";
import { validateFulfillmentUpdate } from "./fulfillment-core.mjs";

const { Pool } = pg;
let pool;

function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL?.trim();
    if (!connectionString)
      throw new Error("DATABASE_URL is required for fulfillment.");
    pool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
  }
  return pool;
}

async function assertScheduler(userId, campgroundId) {
  if (
    !(await hasCampgroundPermission(userId, campgroundId, "reservation.modify"))
  ) {
    throw new Error(
      "Not authorized to schedule campground reservation services.",
    );
  }
}

async function beginScoped(client, userId) {
  await client.query("begin");
  await client.query("set local role icamp_app");
  await client.query("select set_config('icamp.user_id', $1, true)", [userId]);
}

function dateText(value) {
  return value instanceof Date
    ? value.toISOString().slice(0, 10)
    : String(value).slice(0, 10);
}

function mapJob(row) {
  return {
    id: row.id,
    reservationReference: String(row.reservation_id).slice(0, 8),
    displayName: row.display_name,
    serviceCode: row.code,
    quantity: Number(row.quantity),
    arrivalDate: dateText(row.arrival_date),
    departureDate: dateText(row.departure_date),
    serviceDate: dateText(row.service_date),
    serviceWindow: row.service_window,
    jobState: row.job_state,
    reservationStatus: row.reservation_status,
    staffNote: row.staff_note ?? "",
    dailyCapacity:
      row.daily_capacity === null ? null : Number(row.daily_capacity),
    rowVersion: Number(row.row_version),
    updatedAt:
      row.updated_at instanceof Date
        ? row.updated_at.toISOString()
        : String(row.updated_at),
  };
}

export async function closeFulfillmentPoolForTests() {
  if (pool) await pool.end();
  pool = undefined;
}

export async function listCampgroundFulfillment({ userId, campgroundId }) {
  await assertScheduler(userId, campgroundId);
  const client = await getPool().connect();
  try {
    await beginScoped(client, userId);
    const campground = await client.query(
      "select id, name from public.campgrounds where id = $1 and lifecycle_state = 'active' limit 1",
      [campgroundId],
    );
    if (campground.rowCount !== 1)
      throw new Error("Campground is unavailable.");
    const rows = await client.query(
      `select j.*, r.arrival_date, r.departure_date, r.status as reservation_status,
              l.display_name, l.code, c.daily_capacity
       from public.service_fulfillment_jobs j
       join public.reservations r on r.id = j.reservation_id
         and r.campground_id = j.campground_id
       join public.reservation_charge_lines l on l.id = j.charge_line_id
         and l.campground_id = j.campground_id
       join public.booking_charge_catalog c on c.id = j.charge_catalog_id
         and c.campground_id = j.campground_id
       where j.campground_id = $1
         and r.status in ('pending','confirmed','checked_in')
       order by (j.job_state = 'completed'), j.service_date, j.created_at, j.id
       limit 251`,
      [campgroundId],
    );
    await client.query("commit");
    return {
      campgroundName: campground.rows[0].name,
      jobs: rows.rows.slice(0, 250).map(mapJob),
      truncated: rows.rows.length > 250,
    };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function updateCampgroundFulfillment({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  jobId,
  expectedRowVersion,
  nextState,
  serviceDate,
  serviceWindow,
  staffNote,
}) {
  await assertScheduler(actorUserId, campgroundId);
  if (
    !Number.isSafeInteger(Number(expectedRowVersion)) ||
    Number(expectedRowVersion) < 1
  ) {
    throw new Error("Fulfillment row version is invalid.");
  }
  const client = await getPool().connect();
  try {
    await beginScoped(client, actorUserId);
    const result = await client.query(
      `select j.*, r.arrival_date, r.departure_date, r.status as reservation_status,
              l.display_name, l.code, c.daily_capacity
       from public.service_fulfillment_jobs j
       join public.reservations r on r.id = j.reservation_id
         and r.organization_id = j.organization_id and r.campground_id = j.campground_id
       join public.reservation_charge_lines l on l.id = j.charge_line_id
         and l.campground_id = j.campground_id
       join public.booking_charge_catalog c on c.id = j.charge_catalog_id
         and c.campground_id = j.campground_id
       where j.id = $1 and j.campground_id = $2
         and r.status in ('pending','confirmed','checked_in')
       for update of j`,
      [jobId, campgroundId],
    );
    if (result.rowCount !== 1)
      throw new Error("Fulfillment task is unavailable.");
    const before = mapJob(result.rows[0]);
    if (before.rowVersion !== Number(expectedRowVersion)) {
      throw new Error("Task changed since it was opened. Refresh and retry.");
    }
    const next = validateFulfillmentUpdate({
      currentState: before.jobState,
      nextState,
      serviceDate,
      arrivalDate: before.arrivalDate,
      departureDate: before.departureDate,
      serviceWindow,
      staffNote,
    });
    if (next.nextState === "blocked" && !next.staffNote) {
      throw new Error("Please explain why the service is blocked.");
    }
    const updated = await client.query(
      `update public.service_fulfillment_jobs
       set job_state = $3, service_date = $4::date, service_window = $5,
           staff_note = $6, updated_by_user_id = $7,
           completed_at = case when $3 = 'completed' then statement_timestamp() else null end
       where id = $1 and campground_id = $2 and row_version = $8
       returning *`,
      [
        jobId,
        campgroundId,
        next.nextState,
        next.serviceDate,
        next.serviceWindow,
        next.staffNote,
        actorUserId,
        before.rowVersion,
      ],
    );
    if (updated.rowCount !== 1)
      throw new Error("Task changed. Refresh and retry.");
    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: result.rows[0].organization_id,
      campgroundId,
      actionKey: "campground.service_fulfillment.update",
      permissionKey: "reservation.modify",
      riskLevel: "standard",
      subjectType: "service_fulfillment_jobs",
      subjectId: jobId,
      beforeState: before,
      afterState: {
        ...before,
        ...next,
        jobState: next.nextState,
        rowVersion: Number(updated.rows[0].row_version),
      },
    });
    await client.query("commit");
    return { state: next.nextState, id: jobId };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
