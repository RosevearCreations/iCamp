import pg from "pg";

import { hasCampgroundPermission } from "../authz/postgres.mjs";
import {
  mapTemporaryHold,
  normalizeHoldDuration,
  normalizeHoldKey,
  normalizeHoldRequest,
  temporaryHoldErrorCode,
} from "./core.mjs";

const { Pool } = pg;
let pool;

function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL?.trim();
    if (!connectionString)
      throw new Error(
        "DATABASE_URL is required for temporary reservation holds.",
      );
    pool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
  }
  return pool;
}

async function withRls(userId, callback) {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    await client.query("set local role icamp_app");
    await client.query("select set_config('icamp.user_id', $1, true)", [
      userId,
    ]);
    const result = await callback(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function requirePermission(userId, campgroundId, permission) {
  if (!(await hasCampgroundPermission(userId, campgroundId, permission))) {
    throw new Error(`Not authorized: ${permission} is required.`);
  }
}

export async function closeReservationHoldPoolForTests() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

export async function getTemporaryHoldWorkbench({ userId, campgroundId }) {
  const canCreate = await hasCampgroundPermission(
    userId,
    campgroundId,
    "reservation.create",
  );
  const canRead = await hasCampgroundPermission(
    userId,
    campgroundId,
    "reservation.read",
  );
  if (!canCreate && !canRead) {
    throw new Error("Not authorized to read temporary reservation holds.");
  }

  return withRls(userId, async (client) => {
    if (canCreate) {
      await client.query("select icamp_private.expire_reservation_holds($1)", [
        campgroundId,
      ]);
    }

    const configuration = await client.query(
      `select temporary_hold_minutes
       from public.campgrounds
       where id = $1
       limit 1`,
      [campgroundId],
    );
    if (configuration.rowCount !== 1)
      throw new Error("Campground is not available.");

    const holds = await client.query(
      `select
         h.*,
         a.code as accommodation_code,
         a.display_name as accommodation_name
       from public.reservation_holds h
       join public.accommodations a on a.id = h.accommodation_id
       where h.campground_id = $1
         and h.hold_state = 'active'
         and h.expires_at > statement_timestamp()
       order by h.expires_at, a.code, h.id`,
      [campgroundId],
    );

    return {
      holdDurationMinutes: Number(configuration.rows[0].temporary_hold_minutes),
      holds: holds.rows.map(mapTemporaryHold),
    };
  });
}

export async function createTemporaryHold({
  userId,
  campgroundId,
  accommodationId,
  arrivalDate,
  departureDate,
  holdKey,
}) {
  await requirePermission(userId, campgroundId, "reservation.create");
  const request = normalizeHoldRequest({
    accommodationId,
    arrivalDate,
    departureDate,
    holdKey,
  });

  try {
    return await withRls(userId, async (client) => {
      const result = await client.query(
        `select (icamp_private.create_reservation_hold($1,$2,$3,$4,$5)).*`,
        [
          campgroundId,
          request.accommodationId,
          request.arrivalDate,
          request.departureDate,
          request.holdKey,
        ],
      );
      return mapTemporaryHold(result.rows[0]);
    });
  } catch (error) {
    const code = temporaryHoldErrorCode(error);
    if (code) error.code = code;
    throw error;
  }
}

export async function releaseTemporaryHold({
  userId,
  campgroundId,
  holdId,
  holdKey,
}) {
  await requirePermission(userId, campgroundId, "reservation.create");
  const normalizedKey = normalizeHoldKey(holdKey);
  return withRls(userId, async (client) => {
    const result = await client.query(
      `select (icamp_private.release_reservation_hold($1,$2,$3)).*`,
      [campgroundId, holdId, normalizedKey],
    );
    return mapTemporaryHold(result.rows[0]);
  });
}

export async function updateTemporaryHoldDuration({
  userId,
  campgroundId,
  durationMinutes,
}) {
  await requirePermission(userId, campgroundId, "campground.configuration");
  const duration = normalizeHoldDuration(durationMinutes);
  return withRls(userId, async (client) => {
    const result = await client.query(
      `update public.campgrounds
       set temporary_hold_minutes = $2
       where id = $1
       returning temporary_hold_minutes, row_version`,
      [campgroundId, duration],
    );
    if (result.rowCount !== 1) throw new Error("Campground is not available.");
    return {
      holdDurationMinutes: Number(result.rows[0].temporary_hold_minutes),
      rowVersion: Number(result.rows[0].row_version),
    };
  });
}
