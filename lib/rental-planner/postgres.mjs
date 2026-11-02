import pg from "pg";

import { appendAuditEvent } from "../audit/postgres.mjs";
import { hasCampgroundPermission } from "../authz/postgres.mjs";
import {
  normalizeRentalOffer,
  normalizeRentalRequest,
  normalizeRentalWindow,
  rentalUuid,
} from "./core.mjs";

const { Pool } = pg;
let pool;
function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL?.trim();
    if (!connectionString)
      throw new Error("Rental planning database is unavailable.");
    pool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
  }
  return pool;
}
export async function closeRentalPlannerPoolForTests() {
  if (pool) await pool.end();
  pool = undefined;
}

async function transaction(work) {
  const client = await getPool().connect();
  try {
    await client.query("begin");
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
function date(value) {
  return value instanceof Date
    ? value.toISOString().slice(0, 10)
    : String(value).slice(0, 10);
}

async function requireRentalManager(userId, campgroundId) {
  rentalUuid(campgroundId, "Campground ID");
  if (!(await hasCampgroundPermission(userId, campgroundId, "rental.manage")))
    throw new Error(
      "Rental management permission is required for this campground.",
    );
}
async function requireGuest(userId) {
  const result = await getPool().query(
    `select 1 from icamp_private.user_accounts where id=$1 and account_type='guest' and account_state='active'`,
    [userId],
  );
  if (result.rowCount !== 1)
    throw new Error("An active guest account is required.");
}

const SOURCE_READY = `(a.lifecycle_state='active' and a.operating_state='operational'
  and c.lifecycle_state='active' and (
    (a.asset_class='equipment' and eq.equipment_type in ('watercraft','cart','other'))
    or (a.asset_class='facility' and f.facility_type in ('sports_field','hall','other'))
  ))`;
const OFFER_SELECT = `select o.*,a.code asset_code,a.display_name asset_name,a.asset_class,
    coalesce(eq.equipment_type,f.facility_type) item_type,
    c.name campground_name,c.slug campground_slug,c.timezone,
    (statement_timestamp() at time zone c.timezone)::date local_date,
    ${SOURCE_READY} source_ready,
    case when $3::date is null or $4::date is null then null
      else not exists (
        select 1 from icamp_private.rental_planning_requests rr
        where rr.offer_id=o.id and rr.status in ('pending','reviewed')
          and rr.start_date <= $4::date and rr.end_date >= $3::date
      ) end available
    from icamp_private.rental_planning_offers o
    join public.operational_assets a on a.id=o.asset_id
    join public.campgrounds c on c.id=o.campground_id
    left join public.operational_equipment eq on eq.asset_id=a.id
    left join public.operational_facilities f on f.asset_id=a.id`;

function mapOffer(row) {
  return {
    id: row.id,
    campgroundId: row.campground_id,
    campgroundName: row.campground_name,
    campgroundSlug: row.campground_slug,
    timezone: row.timezone,
    localDate: date(row.local_date),
    assetId: row.asset_id,
    assetCode: row.asset_code,
    assetName: row.asset_name,
    assetClass: row.asset_class,
    itemType: row.item_type,
    sourceReady: row.source_ready === true,
    description: row.description,
    accessibilityNote: row.accessibility_note,
    returnGuidance: row.return_guidance,
    maxDays: Number(row.max_days),
    isPublished: row.is_published,
    acceptingRequests: row.accepting_requests,
    available: row.available == null ? null : row.available === true,
    rowVersion: Number(row.row_version),
  };
}

export async function listRentalCampgrounds() {
  const result = await getPool().query(
    `select id,name,slug from public.campgrounds where lifecycle_state='active' order by name,id limit 200`,
  );
  return result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
  }));
}
export async function listPublicRentalOffers({
  campgroundSlug = "",
  kind = "",
  startDate = "",
  endDate = "",
} = {}) {
  const window = normalizeRentalWindow({ startDate, endDate });
  const requestedKind = ["equipment", "facility"].includes(kind) ? kind : "";
  const result = await getPool().query(
    `${OFFER_SELECT} where o.is_published=true and c.lifecycle_state='active'
       and ($1::text='' or c.slug=$1) and ($2::text='' or a.asset_class=$2)
     order by c.name,a.display_name,o.id limit 150`,
    [
      String(campgroundSlug).slice(0, 100),
      requestedKind,
      window?.startDate ?? null,
      window?.endDate ?? null,
    ],
  );
  return result.rows.map(mapOffer);
}
export async function listManagedRentalOffers({ userId, campgroundId }) {
  await requireRentalManager(userId, campgroundId);
  const result = await getPool().query(
    `${OFFER_SELECT} where o.campground_id=$1 order by o.created_at desc,o.id limit 150`,
    [campgroundId, "", null, null],
  );
  return result.rows.map(mapOffer);
}
export async function listRentalAssetCandidates({ userId, campgroundId }) {
  await requireRentalManager(userId, campgroundId);
  const result = await getPool().query(
    `select a.id,a.display_name,a.code,a.asset_class,a.operating_state,a.lifecycle_state,
      coalesce(eq.equipment_type,f.facility_type) item_type,
      (o.id is not null) already_listed
    from public.operational_assets a
    left join public.operational_equipment eq on eq.asset_id=a.id
    left join public.operational_facilities f on f.asset_id=a.id
    left join icamp_private.rental_planning_offers o on o.asset_id=a.id
    where a.campground_id=$1 and a.lifecycle_state<>'archived'
      and ((a.asset_class='equipment' and eq.equipment_type in ('watercraft','cart','other'))
        or (a.asset_class='facility' and f.facility_type in ('sports_field','hall','other')))
    order by a.display_name,a.id limit 200`,
    [campgroundId],
  );
  return result.rows.map((row) => ({
    id: row.id,
    name: row.display_name,
    code: row.code,
    kind: row.asset_class,
    type: row.item_type,
    operatingState: row.operating_state,
    lifecycleState: row.lifecycle_state,
    alreadyListed: row.already_listed,
  }));
}
export async function listManagedRentalRequests({ userId, campgroundId }) {
  await requireRentalManager(userId, campgroundId);
  const result = await getPool().query(
    `select rr.id,rr.offer_id,rr.reservation_id,rr.start_date,rr.end_date,
      rr.guest_note,rr.status,rr.created_at,a.display_name asset_name
     from icamp_private.rental_planning_requests rr
     join icamp_private.rental_planning_offers o on o.id=rr.offer_id
     join public.operational_assets a on a.id=o.asset_id
     where rr.campground_id=$1 order by rr.created_at desc,rr.id limit 200`,
    [campgroundId],
  );
  return result.rows.map((row) => ({
    id: row.id,
    offerId: row.offer_id,
    reservationId: row.reservation_id,
    assetName: row.asset_name,
    startDate: date(row.start_date),
    endDate: date(row.end_date),
    guestNote: row.guest_note,
    status: row.status,
    createdAt: new Date(row.created_at).toISOString(),
  }));
}

export async function saveRentalOffer({
  actorUserId,
  actorSessionId,
  campgroundId,
  offerId,
  assetId,
  expectedRowVersion,
  input,
}) {
  await requireRentalManager(actorUserId, campgroundId);
  rentalUuid(assetId, "Asset ID");
  if (offerId) rentalUuid(offerId, "Offer ID");
  if (!Number.isSafeInteger(expectedRowVersion) || expectedRowVersion < 0)
    throw new Error("Offer version is invalid.");
  const normalized = normalizeRentalOffer(input);
  return transaction(async (client) => {
    const asset = await client.query(
      `select organization_id,campground_id from public.operational_assets
       where id=$1 and campground_id=$2 for share`,
      [assetId, campgroundId],
    );
    if (asset.rowCount !== 1)
      throw new Error("Source asset was not found in this campground.");
    const organizationId = asset.rows[0].organization_id;
    const existing = offerId
      ? await client.query(
          `select * from icamp_private.rental_planning_offers where id=$1 and campground_id=$2 for update`,
          [offerId, campgroundId],
        )
      : null;
    const before = existing?.rows[0] ?? null;
    if (
      (before ? Number(before.row_version) : 0) !== expectedRowVersion ||
      (offerId && !before)
    )
      throw new Error("Rental offer changed; refresh before saving.");
    if (before && before.asset_id !== assetId)
      throw new Error(
        "An offer cannot be reassigned to a different physical asset.",
      );
    if (before) {
      const occupied = await client.query(
        `select coalesce(max(end_date-start_date+1),0)::integer longest
         from icamp_private.rental_planning_requests
         where offer_id=$1 and status in ('pending','reviewed')`,
        [offerId],
      );
      if (Number(occupied.rows[0].longest) > normalized.maxDays) {
        throw new Error(
          "Maximum rental planning days cannot fall below existing active plans.",
        );
      }
    }
    const fields = [
      organizationId,
      campgroundId,
      assetId,
      normalized.description,
      normalized.accessibilityNote,
      normalized.returnGuidance,
      normalized.maxDays,
      normalized.isPublished,
      normalized.acceptingRequests,
      actorUserId,
    ];
    const saved = before
      ? await client.query(
          `update icamp_private.rental_planning_offers set description=$4,
        accessibility_note=$5,return_guidance=$6,max_days=$7,
        is_published=$8,accepting_requests=$9,updated_by_user_id=$10,
        reviewed_by_user_id=case when $8 then $10 else reviewed_by_user_id end,
        reviewed_at=case when $8 then statement_timestamp() else reviewed_at end
       where id=$11 and campground_id=$2 returning *`,
          [...fields, offerId],
        )
      : await client.query(
          `insert into icamp_private.rental_planning_offers (
        organization_id,campground_id,asset_id,description,accessibility_note,
        return_guidance,max_days,is_published,accepting_requests,
        created_by_user_id,updated_by_user_id,reviewed_by_user_id,reviewed_at
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10,
        case when $8 then $10 else null end,
        case when $8 then statement_timestamp() else null end) returning *`,
          fields,
        );
    const row = saved.rows[0];
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId,
      campgroundId,
      actionKey: before ? "rental.offer.update" : "rental.offer.create",
      permissionKey: "rental.manage",
      subjectType: "rental.offer",
      subjectId: row.id,
      beforeState: before
        ? {
            isPublished: before.is_published,
            acceptingRequests: before.accepting_requests,
            rowVersion: Number(before.row_version),
          }
        : null,
      afterState: {
        assetId,
        isPublished: row.is_published,
        acceptingRequests: row.accepting_requests,
        maxDays: Number(row.max_days),
        rowVersion: Number(row.row_version),
      },
    });
    return row.id;
  });
}

export async function listOwnRentalRequests({ userId }) {
  await requireGuest(userId);
  const result = await getPool().query(
    `select rr.id,rr.offer_id,rr.reservation_id,rr.start_date,rr.end_date,
      rr.status,rr.created_at,a.display_name asset_name,c.name campground_name
     from icamp_private.rental_planning_requests rr
     join icamp_private.rental_planning_offers o on o.id=rr.offer_id
     join public.operational_assets a on a.id=o.asset_id
     join public.campgrounds c on c.id=rr.campground_id
     where rr.guest_user_id=$1 order by rr.created_at desc,rr.id limit 100`,
    [userId],
  );
  return result.rows.map((row) => ({
    id: row.id,
    offerId: row.offer_id,
    reservationId: row.reservation_id,
    assetName: row.asset_name,
    campgroundName: row.campground_name,
    startDate: date(row.start_date),
    endDate: date(row.end_date),
    status: row.status,
    createdAt: new Date(row.created_at).toISOString(),
  }));
}

export async function submitRentalPlanningRequest({
  userId,
  actorSessionId,
  offerId,
  reservationId,
  input,
}) {
  rentalUuid(offerId, "Offer ID");
  rentalUuid(reservationId, "Reservation ID");
  const normalized = normalizeRentalRequest(input);
  await requireGuest(userId);
  return transaction(async (client) => {
    const offer = await client.query(
      `select o.*,a.lifecycle_state,a.operating_state,a.asset_class,
        eq.equipment_type,f.facility_type,c.lifecycle_state campground_state,
        (statement_timestamp() at time zone c.timezone)::date local_date
       from icamp_private.rental_planning_offers o
       join public.operational_assets a on a.id=o.asset_id
       join public.campgrounds c on c.id=o.campground_id
       left join public.operational_equipment eq on eq.asset_id=a.id
       left join public.operational_facilities f on f.asset_id=a.id
       where o.id=$1 for update of o`,
      [offerId],
    );
    if (offer.rowCount !== 1)
      throw new Error("Rental planning offer is unavailable.");
    const o = offer.rows[0];
    const previous = await client.query(
      `select id,guest_user_id,reservation_id,start_date,end_date from icamp_private.rental_planning_requests
       where offer_id=$1 and client_request_id=$2`,
      [offerId, normalized.clientRequestId],
    );
    if (previous.rowCount) {
      const prior = previous.rows[0];
      if (
        prior.guest_user_id !== userId ||
        prior.reservation_id !== reservationId ||
        date(prior.start_date) !== normalized.startDate ||
        date(prior.end_date) !== normalized.endDate
      )
        throw new Error("Request identifier belongs to another submission.");
      return prior.id;
    }
    const eligibleAsset =
      (o.asset_class === "equipment" &&
        ["watercraft", "cart", "other"].includes(o.equipment_type)) ||
      (o.asset_class === "facility" &&
        ["sports_field", "hall", "other"].includes(o.facility_type));
    if (
      !o.is_published ||
      !o.accepting_requests ||
      o.lifecycle_state !== "active" ||
      o.operating_state !== "operational" ||
      o.campground_state !== "active" ||
      !eligibleAsset ||
      normalized.startDate < date(o.local_date) ||
      normalized.days > o.max_days
    )
      throw new Error(
        "This physical asset is not open for the selected dates.",
      );
    const stay = await client.query(
      `select id from public.reservations where id=$1 and guest_user_id=$2
        and organization_id=$3 and campground_id=$4 and status in ('confirmed','checked_in')
        and arrival_date<=$5::date and departure_date>=$6::date for share`,
      [
        reservationId,
        userId,
        o.organization_id,
        o.campground_id,
        normalized.startDate,
        normalized.endDate,
      ],
    );
    if (stay.rowCount !== 1)
      throw new Error(
        "An eligible guest-owned reservation covering these dates is required.",
      );
    const overlapping = await client.query(
      `select 1 from icamp_private.rental_planning_requests
       where offer_id=$1 and status in ('pending','reviewed')
         and start_date<=$3::date and end_date>=$2::date limit 1`,
      [offerId, normalized.startDate, normalized.endDate],
    );
    if (overlapping.rowCount)
      throw new Error(
        "This rental planning slot is already requested for these dates.",
      );
    const saved = await client.query(
      `insert into icamp_private.rental_planning_requests (
        organization_id,campground_id,offer_id,reservation_id,guest_user_id,
        client_request_id,start_date,end_date,guest_note
       ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id`,
      [
        o.organization_id,
        o.campground_id,
        offerId,
        reservationId,
        userId,
        normalized.clientRequestId,
        normalized.startDate,
        normalized.endDate,
        normalized.guestNote,
      ],
    );
    await appendAuditEvent(client, {
      actorUserId: userId,
      actorSessionId,
      organizationId: o.organization_id,
      campgroundId: o.campground_id,
      actionKey: "rental.request.submit",
      subjectType: "rental.request",
      subjectId: saved.rows[0].id,
      afterState: {
        offerId,
        reservationId,
        startDate: normalized.startDate,
        endDate: normalized.endDate,
        status: "pending",
      },
    });
    return saved.rows[0].id;
  });
}

export async function withdrawRentalPlanningRequest({
  userId,
  actorSessionId,
  requestId,
}) {
  rentalUuid(requestId, "Request ID");
  await requireGuest(userId);
  return transaction(async (client) => {
    const result = await client.query(
      `select * from icamp_private.rental_planning_requests where id=$1 and guest_user_id=$2 for update`,
      [requestId, userId],
    );
    if (result.rowCount !== 1)
      throw new Error("Your planning request was not found.");
    const before = result.rows[0];
    if (!["pending", "reviewed"].includes(before.status))
      throw new Error("This planning request cannot be withdrawn.");
    await client.query(
      `update icamp_private.rental_planning_requests set status='withdrawn',
       reviewed_at=null,reviewed_by_user_id=null where id=$1`,
      [requestId],
    );
    await appendAuditEvent(client, {
      actorUserId: userId,
      actorSessionId,
      organizationId: before.organization_id,
      campgroundId: before.campground_id,
      actionKey: "rental.request.withdraw",
      subjectType: "rental.request",
      subjectId: requestId,
      beforeState: { status: before.status },
      afterState: { status: "withdrawn" },
    });
  });
}

export async function reviewRentalPlanningRequest({
  actorUserId,
  actorSessionId,
  campgroundId,
  requestId,
  decision,
}) {
  await requireRentalManager(actorUserId, campgroundId);
  rentalUuid(requestId, "Request ID");
  if (!["reviewed", "declined"].includes(decision))
    throw new Error("Decision must be reviewed or declined.");
  return transaction(async (client) => {
    const result = await client.query(
      `select * from icamp_private.rental_planning_requests where id=$1 and campground_id=$2 for update`,
      [requestId, campgroundId],
    );
    if (result.rowCount !== 1)
      throw new Error("Planning request was not found at this campground.");
    const before = result.rows[0];
    if (
      before.status !== "pending" &&
      !(before.status === "reviewed" && decision === "declined")
    )
      throw new Error(
        "This request cannot transition to the selected review state.",
      );
    await client.query(
      `update icamp_private.rental_planning_requests set status=$2,
        reviewed_by_user_id=$3,reviewed_at=statement_timestamp() where id=$1`,
      [requestId, decision, actorUserId],
    );
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: before.organization_id,
      campgroundId,
      actionKey: "rental.request.review",
      permissionKey: "rental.manage",
      subjectType: "rental.request",
      subjectId: requestId,
      beforeState: { status: before.status },
      afterState: { status: decision },
    });
  });
}
