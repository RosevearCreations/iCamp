import pg from "pg";

import { appendAuditEvent } from "../audit/postgres.mjs";
import { hasCampgroundPermission } from "../authz/postgres.mjs";
import {
  normalizeRecreationEvent,
  normalizeRecreationRequest,
  recreationUuid,
} from "./core.mjs";

const { Pool } = pg;
let pool;

function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL?.trim();
    if (!connectionString)
      throw new Error("Recreation schedule database is unavailable.");
    pool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
  }
  return pool;
}

export async function closeRecreationPoolForTests() {
  if (pool) await pool.end();
  pool = undefined;
}

async function transaction(work) {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const value = await work(client);
    await client.query("commit");
    return value;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

function date(value) {
  return value instanceof Date
    ? value.toISOString().slice(0, 10)
    : String(value).slice(0, 10);
}

function mapEvent(row) {
  return {
    id: row.id,
    campgroundId: row.campground_id,
    campgroundName: row.campground_name,
    campgroundSlug: row.campground_slug,
    timezone: row.timezone,
    category: row.category,
    title: row.title,
    description: row.description,
    locationName: row.location_name,
    eventDate: date(row.event_date),
    startTime: String(row.start_time).slice(0, 5),
    endTime: String(row.end_time).slice(0, 5),
    capacityPlaces:
      row.capacity_places == null ? null : Number(row.capacity_places),
    requestedPlaces: Number(row.requested_places ?? 0),
    requiresRegistration: row.requires_registration,
    acceptingRequests: row.accepting_requests,
    accessibilityNote: row.accessibility_note,
    ageGuidance: row.age_guidance,
    status: row.status,
    isPublished: row.is_published,
    rowVersion: Number(row.row_version),
  };
}

const EVENT_SELECT = `select e.*, c.name campground_name, c.slug campground_slug, c.timezone,
  (select coalesce(sum(rr.party_size),0)::integer
     from icamp_private.recreation_registration_requests rr
     where rr.event_id=e.id and rr.status in ('pending','reviewed')) requested_places
  from icamp_private.campground_recreation_events e
  join public.campgrounds c on c.id=e.campground_id`;

async function requireManager(userId, campgroundId) {
  recreationUuid(campgroundId, "Campground ID");
  if (!(await hasCampgroundPermission(userId, campgroundId, "event.manage"))) {
    throw new Error(
      "Event management permission is required for this campground.",
    );
  }
}

async function requireGuest(userId) {
  const result = await getPool().query(
    `select 1 from icamp_private.user_accounts
     where id=$1 and account_type='guest' and account_state='active'`,
    [userId],
  );
  if (result.rowCount !== 1)
    throw new Error("An active guest account is required.");
}

export async function listEventCampgrounds() {
  const result = await getPool().query(
    `select id, name, slug from public.campgrounds
     where lifecycle_state='active' order by name,id limit 200`,
  );
  return result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
  }));
}

export async function listPublicRecreationEvents({
  campgroundSlug = "",
  category = "",
  search = "",
} = {}) {
  const safeSearch = String(search).trim().slice(0, 100);
  const result = await getPool().query(
    `${EVENT_SELECT}
     where e.is_published=true and c.lifecycle_state='active'
       and e.event_date >= (statement_timestamp() at time zone c.timezone)::date
       and ($1::text='' or c.slug=$1)
       and ($2::text='' or e.category=$2)
       and ($3::text='' or e.title ilike '%'||$3||'%' or e.description ilike '%'||$3||'%')
     order by e.event_date,e.start_time,e.id limit 100`,
    [
      String(campgroundSlug).slice(0, 100),
      String(category).slice(0, 30),
      safeSearch,
    ],
  );
  return result.rows.map(mapEvent);
}

export async function listManagedRecreationEvents({ userId, campgroundId }) {
  await requireManager(userId, campgroundId);
  const result = await getPool().query(
    `${EVENT_SELECT} where e.campground_id=$1 order by e.event_date desc,e.start_time,e.id limit 100`,
    [campgroundId],
  );
  return result.rows.map(mapEvent);
}

export async function listManagedRecreationRequests({ userId, campgroundId }) {
  await requireManager(userId, campgroundId);
  const result = await getPool().query(
    `select rr.id,rr.event_id,rr.reservation_id,rr.party_size,rr.status,
       rr.guest_note,rr.created_at,rr.row_version,e.title event_title,e.event_date
     from icamp_private.recreation_registration_requests rr
     join icamp_private.campground_recreation_events e on e.id=rr.event_id
     where rr.campground_id=$1 order by rr.created_at desc,rr.id limit 200`,
    [campgroundId],
  );
  return result.rows.map((row) => ({
    id: row.id,
    eventId: row.event_id,
    reservationId: row.reservation_id,
    partySize: row.party_size,
    status: row.status,
    guestNote: row.guest_note,
    createdAt: new Date(row.created_at).toISOString(),
    rowVersion: Number(row.row_version),
    eventTitle: row.event_title,
    eventDate: date(row.event_date),
  }));
}

export async function saveRecreationEvent({
  actorUserId,
  actorSessionId,
  campgroundId,
  eventId,
  expectedRowVersion,
  input,
}) {
  await requireManager(actorUserId, campgroundId);
  const normalized = normalizeRecreationEvent(input);
  if (eventId) recreationUuid(eventId, "Event ID");
  if (!Number.isSafeInteger(expectedRowVersion) || expectedRowVersion < 0)
    throw new Error("Event version is invalid.");
  return transaction(async (client) => {
    const campground = await client.query(
      `select organization_id,(statement_timestamp() at time zone timezone)::date local_date
       from public.campgrounds where id=$1 and lifecycle_state='active' for share`,
      [campgroundId],
    );
    if (campground.rowCount !== 1)
      throw new Error("Active campground was not found.");
    const scope = campground.rows[0];
    if (
      normalized.isPublished &&
      normalized.eventDate < date(scope.local_date)
    ) {
      throw new Error("An event in the past cannot be published.");
    }
    const beforeResult = eventId
      ? await client.query(
          `select * from icamp_private.campground_recreation_events
       where id=$1 and campground_id=$2 for update`,
          [eventId, campgroundId],
        )
      : null;
    const before = beforeResult?.rows[0] ?? null;
    if (
      (before ? Number(before.row_version) : 0) !== expectedRowVersion ||
      (eventId && !before)
    ) {
      throw new Error("Event changed; refresh and review the latest details.");
    }
    const occupied = before
      ? await client.query(
          `select coalesce(sum(party_size),0)::integer total from icamp_private.recreation_registration_requests
       where event_id=$1 and status in ('pending','reviewed')`,
          [eventId],
        )
      : null;
    if (
      Number(occupied?.rows[0]?.total ?? 0) > 0 &&
      date(before.event_date) !== normalized.eventDate
    ) {
      throw new Error(
        "An activity date with active requests cannot be changed; resolve those requests first.",
      );
    }
    if (
      Number(occupied?.rows[0]?.total ?? 0) > (normalized.capacityPlaces ?? 0)
    ) {
      throw new Error(
        "Capacity cannot fall below existing active request places.",
      );
    }
    const fields = [
      scope.organization_id,
      campgroundId,
      normalized.category,
      normalized.title,
      normalized.description,
      normalized.locationName,
      normalized.eventDate,
      normalized.startTime,
      normalized.endTime,
      normalized.capacityPlaces,
      normalized.requiresRegistration,
      normalized.acceptingRequests,
      normalized.accessibilityNote,
      normalized.ageGuidance,
      normalized.isPublished,
      normalized.status,
      actorUserId,
    ];
    const saved = before
      ? await client.query(
          `update icamp_private.campground_recreation_events set
        category=$3,title=$4,description=$5,location_name=$6,event_date=$7,
        start_time=$8,end_time=$9,capacity_places=$10,requires_registration=$11,
        accepting_requests=$12,accessibility_note=$13,age_guidance=$14,
        is_published=$15,status=$16,updated_by_user_id=$17,
        reviewed_by_user_id=case when $15 then $17 else reviewed_by_user_id end,
        reviewed_at=case when $15 then statement_timestamp() else reviewed_at end
       where id=$18 and campground_id=$2 returning *`,
          [...fields, eventId],
        )
      : await client.query(
          `insert into icamp_private.campground_recreation_events (
        organization_id,campground_id,category,title,description,location_name,
        event_date,start_time,end_time,capacity_places,requires_registration,
        accepting_requests,accessibility_note,age_guidance,is_published,status,
        created_by_user_id,updated_by_user_id,reviewed_by_user_id,reviewed_at
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,
        $17,$17,case when $15 then $17 else null end,
        case when $15 then statement_timestamp() else null end) returning *`,
          fields,
        );
    const row = saved.rows[0];
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: scope.organization_id,
      campgroundId,
      actionKey: before ? "recreation.event.update" : "recreation.event.create",
      permissionKey: "event.manage",
      subjectType: "recreation.event",
      subjectId: row.id,
      beforeState: before
        ? {
            status: before.status,
            isPublished: before.is_published,
            capacityPlaces: before.capacity_places,
            rowVersion: Number(before.row_version),
          }
        : null,
      afterState: {
        status: row.status,
        isPublished: row.is_published,
        acceptingRequests: row.accepting_requests,
        capacityPlaces: row.capacity_places,
        rowVersion: Number(row.row_version),
      },
    });
    return row.id;
  });
}

export async function listGuestRecreationStays({ userId }) {
  await requireGuest(userId);
  const result = await getPool().query(
    `select r.id,r.campground_id,c.name campground_name,r.status,r.arrival_date,r.departure_date
     from public.reservations r join public.campgrounds c on c.id=r.campground_id
     where r.guest_user_id=$1 and r.status in ('confirmed','checked_in')
       and r.departure_date > (statement_timestamp() at time zone c.timezone)::date
     order by r.arrival_date,r.id limit 100`,
    [userId],
  );
  return result.rows.map((row) => ({
    id: row.id,
    campgroundId: row.campground_id,
    campgroundName: row.campground_name,
    status: row.status,
    arrivalDate: date(row.arrival_date),
    departureDate: date(row.departure_date),
  }));
}

export async function getOwnRecreationRequests({ userId }) {
  await requireGuest(userId);
  const result = await getPool().query(
    `select rr.id,rr.event_id,rr.reservation_id,rr.party_size,rr.status,
       rr.created_at,e.title event_title,e.event_date,c.name campground_name
     from icamp_private.recreation_registration_requests rr
     join icamp_private.campground_recreation_events e on e.id=rr.event_id
     join public.campgrounds c on c.id=rr.campground_id
     where rr.guest_user_id=$1 order by rr.created_at desc,rr.id limit 100`,
    [userId],
  );
  return result.rows.map((row) => ({
    id: row.id,
    eventId: row.event_id,
    reservationId: row.reservation_id,
    eventTitle: row.event_title,
    eventDate: date(row.event_date),
    campgroundName: row.campground_name,
    partySize: row.party_size,
    status: row.status,
    createdAt: new Date(row.created_at).toISOString(),
  }));
}

export async function requestRecreationRegistration({
  userId,
  actorSessionId,
  eventId,
  reservationId,
  input,
}) {
  recreationUuid(eventId, "Event ID");
  recreationUuid(reservationId, "Reservation ID");
  const normalized = normalizeRecreationRequest(input);
  await requireGuest(userId);
  return transaction(async (client) => {
    const event = await client.query(
      `select e.*,c.lifecycle_state,
        (statement_timestamp() at time zone c.timezone)::date local_date
       from icamp_private.campground_recreation_events e
       join public.campgrounds c on c.id=e.campground_id
       where e.id=$1 for update of e`,
      [eventId],
    );
    if (event.rowCount !== 1) throw new Error("Event was not found.");
    const e = event.rows[0];
    const previous = await client.query(
      `select id,client_request_id,status from icamp_private.recreation_registration_requests
       where event_id=$1 and reservation_id=$2 and guest_user_id=$3`,
      [eventId, reservationId, userId],
    );
    if (previous.rowCount === 1) {
      if (previous.rows[0].client_request_id !== normalized.clientRequestId) {
        throw new Error(
          "This stay already has an event request. Check your request history.",
        );
      }
      return previous.rows[0].id;
    }
    const reservation = await client.query(
      `select id from public.reservations where id=$1 and guest_user_id=$2
        and organization_id=$3 and campground_id=$4 and status in ('confirmed','checked_in')
        and arrival_date <= $5::date and departure_date > $5::date
        for share`,
      [reservationId, userId, e.organization_id, e.campground_id, e.event_date],
    );
    if (reservation.rowCount !== 1)
      throw new Error(
        "An eligible reservation for this event date is required.",
      );
    if (
      !e.is_published ||
      !e.accepting_requests ||
      !e.requires_registration ||
      e.status !== "scheduled" ||
      e.capacity_places == null ||
      e.lifecycle_state !== "active" ||
      date(e.event_date) < date(e.local_date)
    ) {
      throw new Error("Registration requests are not open for this event.");
    }
    const current = await client.query(
      `select coalesce(sum(party_size),0)::integer total
       from icamp_private.recreation_registration_requests
       where event_id=$1 and status in ('pending','reviewed')`,
      [eventId],
    );
    if (
      Number(current.rows[0].total) + normalized.partySize >
      e.capacity_places
    ) {
      throw new Error(
        "Not enough event request places remain; choose a smaller party or another event.",
      );
    }
    const saved = await client.query(
      `insert into icamp_private.recreation_registration_requests
       (organization_id,campground_id,event_id,reservation_id,guest_user_id,
        client_request_id,party_size,guest_note)
       values ($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
      [
        e.organization_id,
        e.campground_id,
        eventId,
        reservationId,
        userId,
        normalized.clientRequestId,
        normalized.partySize,
        normalized.guestNote,
      ],
    );
    await appendAuditEvent(client, {
      actorUserId: userId,
      actorSessionId,
      organizationId: e.organization_id,
      campgroundId: e.campground_id,
      actionKey: "recreation.request.submit",
      subjectType: "recreation.request",
      subjectId: saved.rows[0].id,
      afterState: {
        eventId,
        reservationId,
        partySize: normalized.partySize,
        status: "pending",
      },
    });
    return saved.rows[0].id;
  });
}

export async function withdrawRecreationRequest({
  userId,
  actorSessionId,
  requestId,
}) {
  recreationUuid(requestId, "Request ID");
  await requireGuest(userId);
  return transaction(async (client) => {
    const prior = await client.query(
      `select * from icamp_private.recreation_registration_requests
       where id=$1 and guest_user_id=$2 for update`,
      [requestId, userId],
    );
    if (prior.rowCount !== 1) throw new Error("Your request was not found.");
    const before = prior.rows[0];
    if (!["pending", "reviewed"].includes(before.status))
      throw new Error("This request can no longer be withdrawn.");
    await client.query(
      `update icamp_private.recreation_registration_requests
       set status='withdrawn',reviewed_at=null,reviewed_by_user_id=null where id=$1`,
      [requestId],
    );
    await appendAuditEvent(client, {
      actorUserId: userId,
      actorSessionId,
      organizationId: before.organization_id,
      campgroundId: before.campground_id,
      actionKey: "recreation.request.withdraw",
      subjectType: "recreation.request",
      subjectId: requestId,
      beforeState: { status: before.status },
      afterState: { status: "withdrawn" },
    });
  });
}

export async function reviewRecreationRequest({
  actorUserId,
  actorSessionId,
  campgroundId,
  requestId,
  decision,
}) {
  await requireManager(actorUserId, campgroundId);
  recreationUuid(requestId, "Request ID");
  if (!["reviewed", "declined"].includes(decision))
    throw new Error("Review decision must be reviewed or declined.");
  return transaction(async (client) => {
    const prior = await client.query(
      `select * from icamp_private.recreation_registration_requests
       where id=$1 and campground_id=$2 for update`,
      [requestId, campgroundId],
    );
    if (prior.rowCount !== 1)
      throw new Error("Request was not found in this campground.");
    const before = prior.rows[0];
    if (
      before.status !== "pending" &&
      !(before.status === "reviewed" && decision === "declined")
    ) {
      throw new Error("Request can no longer transition to that review state.");
    }
    await client.query(
      `update icamp_private.recreation_registration_requests
       set status=$2,reviewed_by_user_id=$3,reviewed_at=statement_timestamp()
       where id=$1`,
      [requestId, decision, actorUserId],
    );
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: before.organization_id,
      campgroundId,
      actionKey: "recreation.request.review",
      permissionKey: "event.manage",
      subjectType: "recreation.request",
      subjectId: requestId,
      beforeState: { status: before.status },
      afterState: { status: decision },
    });
  });
}
