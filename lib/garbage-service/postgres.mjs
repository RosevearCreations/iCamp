import pg from "pg";

import { hasCampgroundPermission } from "../authz/postgres.mjs";
import {
  nextGarbagePickupState,
  normalizeGarbagePickup,
  normalizeGarbagePolicy,
} from "./core.mjs";

const { Pool } = pg;
let pool;

function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL?.trim();
    if (!connectionString)
      throw new Error("DATABASE_URL is required for garbage services.");
    pool = new Pool({
      connectionString,
      max: 5,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
    });
  }
  return pool;
}

export async function closeGarbageServicePoolForTests() {
  if (pool) await pool.end();
  pool = undefined;
}

async function permission(userId, campgroundId, key) {
  if (!(await hasCampgroundPermission(userId, campgroundId, key))) {
    throw new Error(`Not authorized for ${key}.`);
  }
}

async function scoped(client, userId, campgroundId) {
  await client.query("set local role icamp_app");
  await client.query("select set_config('icamp.user_id',$1,true)", [userId]);
  const result = await client.query(
    `select organization_id,id,name from public.campgrounds
     where id=$1 and lifecycle_state <> 'archived' limit 1`,
    [campgroundId],
  );
  if (result.rowCount !== 1) throw new Error("Campground is unavailable.");
  return result.rows[0];
}

async function transact(userId, campgroundId, operation) {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const campground = await scoped(client, userId, campgroundId);
    const value = await operation(client, campground);
    await client.query("commit");
    return value;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function getGarbageServiceSnapshot(userId, campgroundId) {
  await permission(userId, campgroundId, "garbage.read");
  return transact(userId, campgroundId, async (client, campground) => {
    const [policies, pickups, accommodations] = await Promise.all([
      client.query(
        `select * from public.garbage_service_policies
        where campground_id=$1 order by stream,service_mode`,
        [campgroundId],
      ),
      client.query(
        `select p.*,a.code as accommodation_code
        from public.garbage_pickup_requests p
        join public.accommodations a on a.id=p.accommodation_id
        where p.campground_id=$1 order by p.created_at desc limit 150`,
        [campgroundId],
      ),
      client.query(
        `select id,code from public.accommodations
        where campground_id=$1 and lifecycle_state <> 'archived'
        order by code limit 500`,
        [campgroundId],
      ),
    ]);
    return {
      campground,
      policies: policies.rows,
      pickups: pickups.rows,
      accommodations: accommodations.rows,
    };
  });
}

export async function saveGarbagePolicy({
  actorUserId,
  campgroundId,
  expectedRowVersion,
  ...input
}) {
  await permission(actorUserId, campgroundId, "garbage.configure");
  const policy = normalizeGarbagePolicy(input);
  return transact(actorUserId, campgroundId, async (client, campground) => {
    await client.query(`select pg_advisory_xact_lock(hashtextextended($1,0))`, [
      `icamp-garbage-policy:${campgroundId}:${policy.stream}:${policy.mode}`,
    ]);
    const existing = await client.query(
      `select id,row_version from public.garbage_service_policies
       where campground_id=$1 and stream=$2 and service_mode=$3 for update`,
      [campgroundId, policy.stream, policy.mode],
    );
    if (existing.rowCount) {
      if (Number(existing.rows[0].row_version) !== Number(expectedRowVersion)) {
        throw new Error("Service settings changed. Refresh before saving.");
      }
      const result = await client.query(
        `update public.garbage_service_policies set enabled=$2,weekday=$3,
          fee_cents=$4,instructions=$5,location_description=$6,
          updated_by_user_id=$7,updated_at=now(),row_version=row_version+1
         where id=$1 returning *`,
        [
          existing.rows[0].id,
          policy.isEnabled,
          policy.weekday,
          policy.feeCents,
          policy.instructions,
          policy.locationDescription,
          actorUserId,
        ],
      );
      return result.rows[0];
    }
    const result = await client.query(
      `insert into public.garbage_service_policies
       (organization_id,campground_id,stream,service_mode,enabled,weekday,fee_cents,
        instructions,location_description,updated_by_user_id)
       values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning *`,
      [
        campground.organization_id,
        campgroundId,
        policy.stream,
        policy.mode,
        policy.isEnabled,
        policy.weekday,
        policy.feeCents,
        policy.instructions,
        policy.locationDescription,
        actorUserId,
      ],
    );
    return result.rows[0];
  });
}

export async function requestGarbagePickup({
  actorUserId,
  campgroundId,
  accommodationId,
  reservationId,
  ...input
}) {
  await permission(actorUserId, campgroundId, "garbage.dispatch");
  const request = normalizeGarbagePickup(input);
  return transact(actorUserId, campgroundId, async (client, campground) => {
    // Serialize identical retries before the uniqueness check so two browser
    // submissions cannot race into an avoidable duplicate-key error.
    await client.query(`select pg_advisory_xact_lock(hashtextextended($1,0))`, [
      `icamp-garbage-request:${campgroundId}:${request.clientRequestId}`,
    ]);
    const prior = await client.query(
      `select * from public.garbage_pickup_requests
       where campground_id=$1 and client_request_id=$2`,
      [campgroundId, request.clientRequestId],
    );
    if (prior.rowCount) {
      const row = prior.rows[0];
      if (
        row.accommodation_id !== accommodationId ||
        row.reservation_id !== (reservationId || null) ||
        row.stream !== request.stream ||
        row.service_mode !== request.mode ||
        row.note !== request.note
      ) {
        throw new Error(
          "Pickup request ID was already used with different details.",
        );
      }
      return row;
    }
    const selected = await client.query(
      `select id,fee_cents from public.garbage_service_policies
       where campground_id=$1 and stream=$2 and service_mode=$3 and enabled=true
       for share`,
      [campgroundId, request.stream, request.mode],
    );
    if (selected.rowCount !== 1)
      throw new Error("That pickup service is not enabled.");
    const accommodation = await client.query(
      `select id from public.accommodations where id=$1 and campground_id=$2
       and lifecycle_state <> 'archived'`,
      [accommodationId, campgroundId],
    );
    if (accommodation.rowCount !== 1)
      throw new Error("Select an active campground site.");
    if (reservationId) {
      const stay = await client.query(
        `select id from public.reservations where id=$1 and campground_id=$2
         and accommodation_id=$3 and status='checked_in'`,
        [reservationId, campgroundId, accommodationId],
      );
      if (stay.rowCount !== 1)
        throw new Error("Reservation must be checked in at this site.");
    }
    const policy = selected.rows[0];
    const billing =
      request.mode === "paid_on_demand" ? "pending_checkout" : "not_applicable";
    const created = await client.query(
      `insert into public.garbage_pickup_requests
       (organization_id,campground_id,policy_id,accommodation_id,reservation_id,
        client_request_id,stream,service_mode,fee_cents,billing_state,note,
        created_by_user_id,updated_by_user_id)
       values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12) returning *`,
      [
        campground.organization_id,
        campgroundId,
        policy.id,
        accommodationId,
        reservationId || null,
        request.clientRequestId,
        request.stream,
        request.mode,
        policy.fee_cents,
        billing,
        request.note,
        actorUserId,
      ],
    );
    await client.query(
      `insert into public.garbage_pickup_events
       (organization_id,campground_id,pickup_id,event_type,note,actor_user_id)
       values($1,$2,$3,'requested',$4,$5)`,
      [
        campground.organization_id,
        campgroundId,
        created.rows[0].id,
        request.note,
        actorUserId,
      ],
    );
    return created.rows[0];
  });
}

export async function transitionGarbagePickup({
  actorUserId,
  campgroundId,
  pickupId,
  expectedRowVersion,
  nextState,
  note,
  scheduledFor,
}) {
  await permission(actorUserId, campgroundId, "garbage.dispatch");
  return transact(actorUserId, campgroundId, async (client, campground) => {
    const found = await client.query(
      `select * from public.garbage_pickup_requests where id=$1 and campground_id=$2 for update`,
      [pickupId, campgroundId],
    );
    if (found.rowCount !== 1) throw new Error("Pickup request is unavailable.");
    const prior = found.rows[0];
    if (Number(prior.row_version) !== Number(expectedRowVersion)) {
      throw new Error("Pickup changed. Refresh before updating.");
    }
    nextGarbagePickupState(prior.state, nextState);
    if (
      nextState === "scheduled" &&
      (!scheduledFor || Number.isNaN(Date.parse(scheduledFor)))
    ) {
      throw new Error("Scheduling needs a valid date and time.");
    }
    const cleanNote = String(note ?? "").trim();
    if (cleanNote.length > 1000) throw new Error("Pickup note is too long.");
    const updated = await client.query(
      `update public.garbage_pickup_requests
       set state=$2,scheduled_for=coalesce($3,scheduled_for),
           completed_at=case when $2='completed' then now() else null end,
           completion_note=case when $2='completed' then $4 else completion_note end,
           updated_by_user_id=$5,row_version=row_version+1
       where id=$1 returning *`,
      [
        pickupId,
        nextState,
        scheduledFor || null,
        cleanNote || null,
        actorUserId,
      ],
    );
    const event = {
      scheduled: "scheduled",
      in_progress: "started",
      completed: "completed",
      cancelled: "cancelled",
    }[nextState];
    await client.query(
      `insert into public.garbage_pickup_events
       (organization_id,campground_id,pickup_id,event_type,note,actor_user_id)
       values($1,$2,$3,$4,$5,$6)`,
      [
        campground.organization_id,
        campgroundId,
        pickupId,
        event,
        cleanNote || null,
        actorUserId,
      ],
    );
    return updated.rows[0];
  });
}
