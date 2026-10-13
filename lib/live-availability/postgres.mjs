import pg from "pg";

import { hasCampgroundPermission } from "../authz/postgres.mjs";
import {
  assertLiveAvailability,
  mapAvailabilityRow,
  normalizeAvailabilityWindow,
} from "./core.mjs";

const { Pool } = pg;
let pool;

function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL?.trim();
    if (!connectionString)
      throw new Error("DATABASE_URL is required for live availability.");
    pool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }
  return pool;
}

export async function closeLiveAvailabilityPoolForTests() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

async function canRead(userId, campgroundId) {
  const keys = [
    "reservation.read",
    "reservation.create",
    "reservation.modify",
    "reservation.override",
    "accommodation.read",
    "campground.operations.manage",
  ];
  const checks = await Promise.all(
    keys.map((key) => hasCampgroundPermission(userId, campgroundId, key)),
  );
  return checks.some(Boolean);
}

export async function getLiveAvailabilitySnapshot({
  userId,
  campgroundId,
  arrivalDate,
  departureDate,
}) {
  if (!(await canRead(userId, campgroundId)))
    throw new Error("Not authorized to read live availability.");
  const window = normalizeAvailabilityWindow({ arrivalDate, departureDate });
  const client = await getPool().connect();
  try {
    await client.query("begin");
    await client.query("set local role icamp_app");
    await client.query("select set_config('icamp.user_id', $1, true)", [
      userId,
    ]);
    const result = await client.query(
      `select av.*, a.code, a.display_name, a.accommodation_kind
       from icamp_private.live_accommodation_availability($1,$2,$3) av
       join public.accommodations a on a.id = av.accommodation_id
       order by a.code`,
      [campgroundId, window.arrivalDate, window.departureDate],
    );
    await client.query("commit");
    const items = result.rows.map((row) => ({
      ...mapAvailabilityRow(row),
      code: row.code,
      displayName: row.display_name,
      accommodationKind: row.accommodation_kind,
    }));
    return {
      campgroundId,
      ...window,
      generatedAt: new Date().toISOString(),
      revision: items.reduce(
        (max, item) => Math.max(max, item.availabilityRevision),
        0,
      ),
      items,
    };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function assertServerAvailable(input) {
  const snapshot = await getLiveAvailabilitySnapshot(input);
  const item = snapshot.items.find(
    (candidate) => candidate.accommodationId === input.accommodationId,
  );
  if (!item) throw new Error("Accommodation is unavailable.");
  return assertLiveAvailability(item);
}
