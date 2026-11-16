import pg from "pg";

import { getCampgroundAuthorization } from "../authz/postgres.mjs";
import { getLiveAvailabilitySnapshot } from "../live-availability/postgres.mjs";
import {
  buildICampInstrumentSignal,
  reviewBookingWindow,
  reviewWaitlistInterest,
  summarizePublicInventory,
} from "./build258-booking-core.mjs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
let pool;
function database() {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) throw new Error("Original private campground database required.");
  if (!pool)
    pool = new pg.Pool({
      connectionString: value,
      max: 3,
      connectionTimeoutMillis: 4000,
    });
  return pool;
}
async function allowed(userId, campgroundId, permissions) {
  if (!UUID.test(String(userId)) || !UUID.test(String(campgroundId)))
    throw new Error("Current staff and campground required.");
  const grant = await getCampgroundAuthorization(userId, campgroundId);
  if (!grant || !permissions.some((x) => grant.permissions.includes(x)))
    throw new Error("Current campground reservation grant required.");
  return grant;
}
async function scoped(userId, work) {
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

export async function listStaffWaitlist258({
  actorUserId,
  campgroundId,
  arrivalDate,
  departureDate,
}) {
  await allowed(actorUserId, campgroundId, [
    "reservation.read",
    "reservation.create",
    "reservation.modify",
  ]);
  const window = reviewBookingWindow({ arrivalDate, departureDate });
  if (!window.valid) throw new Error(window.code);
  const [rows, snapshot] = await Promise.all([
    scoped(actorUserId, (client) =>
      client.query(
        [
          "select w.id,w.accommodation_id,w.arrival_date,w.departure_date,",
          "w.created_at,w.state,a.code,a.display_name,",
          "r.action as latest_review,r.reviewed_at",
          "from public.icamp_waitlist_interest258 w",
          "join public.accommodations a",
          "on a.id=w.accommodation_id and a.campground_id=w.campground_id",
          "left join lateral (select action,reviewed_at",
          "from public.icamp_waitlist_review258 rr",
          "where rr.waitlist_id=w.id",
          "order by reviewed_at desc, id desc limit 1) r on true",
          "where w.campground_id=$1",
          "and daterange(w.arrival_date,w.departure_date,'[)')",
          "&& daterange($2::date,$3::date,'[)')",
          "order by w.created_at,w.id limit 100",
        ].join(" "),
        [campgroundId, arrivalDate, departureDate],
      ),
    ),
    getLiveAvailabilitySnapshot({
      userId: actorUserId,
      campgroundId,
      arrivalDate,
      departureDate,
    }),
  ]);
  const sites = snapshot.items.map((item) => ({
    accommodationId: item.accommodationId,
    code: item.code,
    displayName: item.displayName,
    available: item.available,
    blockers: item.blockers,
  }));
  const summary = summarizePublicInventory(
    snapshot.items.map((i) => ({
      tone: i.available
        ? "green"
        : i.blockers.includes("management_restriction")
          ? "red"
          : i.blockers.includes("turnover")
            ? "yellow"
            : "grey",
      selectable: i.available,
    })),
    window,
  );
  return {
    status: "LIVE_STAFF_AVAILABILITY_WAITLIST_REVIEW_ONLY",
    window,
    generatedAt: snapshot.generatedAt,
    sites,
    entries: rows.rows.map((x) => ({
      id: x.id,
      code: x.code,
      displayName: x.display_name,
      arrivalDate: x.arrival_date.toISOString().slice(0, 10),
      departureDate: x.departure_date.toISOString().slice(0, 10),
      queuedAt: x.created_at.toISOString(),
      state: x.latest_review ?? x.state,
    })),
    instrument: buildICampInstrumentSignal({
      sourceRevision: process.env.VERCEL_GIT_COMMIT_SHA,
      observedAt: snapshot.generatedAt,
      availability: summary,
      databaseStatus: "HEALTHY",
    }),
    bookingCreated: false,
    autoPromotion: false,
  };
}

/** This is a local STAFF note about unavailable inventory, not a guest
 * reservation or provider-facing waitlist offer. */
export async function createStaffWaitlistInterest258({
  actorUserId,
  campgroundId,
  accommodationId,
  arrivalDate,
  departureDate,
  requestKey,
}) {
  const grant = await allowed(actorUserId, campgroundId, [
    "reservation.create",
  ]);
  const snapshot = await getLiveAvailabilitySnapshot({
    userId: actorUserId,
    campgroundId,
    arrivalDate,
    departureDate,
  });
  const item = snapshot.items.find(
    (x) => x.accommodationId === accommodationId,
  );
  const checked = reviewWaitlistInterest({
    campgroundId,
    accommodationId,
    requestKey,
    arrivalDate,
    departureDate,
    availabilityBlockers: item?.blockers,
  });
  if (!checked.valid) throw new Error(checked.code);
  return scoped(actorUserId, async (client) => {
    const result = await client.query(
      [
        "insert into public.icamp_waitlist_interest258",
        "(organization_id,campground_id,accommodation_id,",
        "arrival_date,departure_date,request_key,created_by_user_id)",
        "values ($1,$2,$3,$4,$5,$6,$7)",
        "on conflict (campground_id,request_key) do nothing",
        "returning id",
      ].join(" "),
      [
        grant.organizationId,
        campgroundId,
        accommodationId,
        arrivalDate,
        departureDate,
        requestKey,
        actorUserId,
      ],
    );
    if (result.rowCount === 0) {
      const previous = await client.query(
        [
          "select accommodation_id,arrival_date,departure_date",
          "from public.icamp_waitlist_interest258",
          "where campground_id=$1 and request_key=$2",
        ].join(" "),
        [campgroundId, requestKey],
      );
      const row = previous.rows[0];
      if (
        !row ||
        row.accommodation_id !== accommodationId ||
        row.arrival_date.toISOString().slice(0, 10) !== arrivalDate ||
        row.departure_date.toISOString().slice(0, 10) !== departureDate
      )
        throw new Error("Reused waitlist key for a different request.");
      return { status: "EXISTING_STAFF_INTEREST", holdsCreated: 0 };
    }
    return {
      status: "STAFF_INTEREST_RECORDED_NO_OFFER",
      id: result.rows[0].id,
      holdsCreated: 0,
    };
  });
}

export async function recordStaffWaitlistReview258({
  actorUserId,
  campgroundId,
  waitlistId,
  action,
}) {
  const grant = await allowed(actorUserId, campgroundId, [
    "reservation.modify",
  ]);
  if (
    !UUID.test(String(waitlistId)) ||
    !["reviewed", "cancelled"].includes(action)
  )
    throw new Error("Original waitlist and valid review action required.");
  return scoped(actorUserId, async (client) => {
    const result = await client.query(
      [
        "insert into public.icamp_waitlist_review258",
        "(organization_id,campground_id,waitlist_id,",
        "action,performed_by_user_id)",
        "values ($1,$2,$3,$4,$5)",
        "on conflict (waitlist_id,action) do nothing",
        "returning id",
      ].join(" "),
      [grant.organizationId, campgroundId, waitlistId, action, actorUserId],
    );
    return {
      status: result.rowCount
        ? "STAFF_WAITLIST_REVIEW_RECORDED"
        : "STAFF_REVIEW_ALREADY_RECORDED",
      holdsCreated: 0,
      guestNotified: false,
    };
  });
}
