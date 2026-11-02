import pg from "pg";

import { hasCampgroundPermission } from "../authz/postgres.mjs";

const { Pool } = pg;
let pool;

function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL?.trim();
    if (!connectionString)
      throw new Error("Arrival planner storage unavailable.");
    pool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
  }
  return pool;
}

export async function closeArrivalPlannerPoolForTests() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

async function withRls(userId, work) {
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

function date(value) {
  return value instanceof Date
    ? value.toISOString().slice(0, 10)
    : String(value).slice(0, 10);
}
function iso(value) {
  return value == null ? null : new Date(value).toISOString();
}
function mapPlan(row) {
  if (!row) return null;
  return {
    id: row.id,
    reservationId: row.reservation_id,
    campgroundId: row.campground_id,
    userAccountId: row.user_account_id,
    state: row.plan_state,
    expectedArrivalTime: row.expected_arrival_time
      ? String(row.expected_arrival_time).slice(0, 5)
      : null,
    arrivalMode: row.arrival_mode,
    expectedVehicleCount:
      row.expected_vehicle_count == null
        ? null
        : Number(row.expected_vehicle_count),
    expectedVisitorCount:
      row.expected_visitor_count == null
        ? null
        : Number(row.expected_visitor_count),
    documentPreparation: row.document_preparation,
    rulesReviewed: row.rules_reviewed === true,
    assistanceRequested: row.assistance_requested === true,
    assistanceNote: row.assistance_note ?? null,
    sourceReservationVersion: Number(row.source_reservation_version),
    rowVersion: Number(row.row_version),
    submittedAt: iso(row.submitted_at),
    updatedAt: iso(row.updated_at),
  };
}
function mapReview(row) {
  if (!row) return null;
  return {
    id: row.id,
    outcome: row.review_outcome,
    note: row.review_note,
    reviewedPlanVersion: Number(row.reviewed_plan_version),
    reviewedReservationVersion: Number(row.reviewed_reservation_version),
    reviewedAt: iso(row.reviewed_at),
  };
}

export async function getOwnArrivalPlanBundle({ userId, reservationId }) {
  return withRls(userId, async (client) => {
    const [plan, review] = await Promise.all([
      client.query(
        `select * from public.guest_arrival_plans
         where reservation_id=$1 and user_account_id=$2 limit 1`,
        [reservationId, userId],
      ),
      client.query(
        `select * from public.guest_arrival_staff_reviews
         where reservation_id=$1 and user_account_id=$2 limit 1`,
        [reservationId, userId],
      ),
    ]);
    return {
      plan: mapPlan(plan.rows[0]),
      review: mapReview(review.rows[0]),
    };
  });
}

export async function saveOwnArrivalPlan({
  userId,
  reservationId,
  expectedReservationVersion,
  expectedPlanVersion,
  input,
}) {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const reservation = await client.query(
      `select r.organization_id,r.campground_id,r.status,r.row_version,
        r.departure_date,
        (statement_timestamp() at time zone c.timezone)::date as local_date
       from public.reservations r
       join public.campgrounds c on c.id=r.campground_id
       where r.id=$1 and r.guest_user_id=$2 for share of r`,
      [reservationId, userId],
    );
    if (reservation.rowCount !== 1) {
      throw new Error("Reservation ownership could not be verified.");
    }
    const r = reservation.rows[0];
    if (
      r.status !== "confirmed" ||
      date(r.departure_date) <= date(r.local_date)
    ) {
      throw new Error("Pre-registration is closed for this reservation.");
    }
    if (Number(r.row_version) !== expectedReservationVersion) {
      throw new Error("Reservation changed; review the latest details.");
    }
    const existing = await client.query(
      `select id,row_version,user_account_id from public.guest_arrival_plans
       where reservation_id=$1 for update`,
      [reservationId],
    );
    const previous = existing.rows[0];
    if (
      (previous && previous.user_account_id !== userId) ||
      Number(previous?.row_version ?? 0) !== expectedPlanVersion
    ) {
      throw new Error("Arrival plan changed; refresh before saving.");
    }
    await client.query("set local role icamp_app");
    await client.query("select set_config('icamp.user_id',$1,true)", [userId]);
    const fields = [
      input.expectedArrivalTime,
      input.arrivalMode,
      input.expectedVehicleCount,
      input.expectedVisitorCount,
      input.documentPreparation,
      input.rulesReviewed,
      input.assistanceRequested,
      input.assistanceNote,
      input.state,
      expectedReservationVersion,
    ];
    let result;
    if (!previous) {
      result = await client.query(
        `insert into public.guest_arrival_plans (
           organization_id,campground_id,reservation_id,user_account_id,
           expected_arrival_time,arrival_mode,expected_vehicle_count,
           expected_visitor_count,document_preparation,rules_reviewed,
           assistance_requested,assistance_note,plan_state,
           source_reservation_version,submitted_at
         ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,
           case when $13='submitted' then statement_timestamp() else null end)
         returning id`,
        [r.organization_id, r.campground_id, reservationId, userId, ...fields],
      );
    } else {
      result = await client.query(
        `update public.guest_arrival_plans set
          expected_arrival_time=$3,arrival_mode=$4,expected_vehicle_count=$5,
          expected_visitor_count=$6,document_preparation=$7,rules_reviewed=$8,
          assistance_requested=$9,assistance_note=$10,plan_state=$11,
          source_reservation_version=$12,
          submitted_at=case when $11='submitted' then statement_timestamp() else null end
         where id=$1 and user_account_id=$2 and row_version=$13 returning id`,
        [previous.id, userId, ...fields, expectedPlanVersion],
      );
    }
    if (result.rowCount !== 1) throw new Error("Arrival plan was not saved.");
    await client.query("commit");
    return result.rows[0].id;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function assertStaffRead(userId, campgroundId) {
  if (
    !(await hasCampgroundPermission(
      userId,
      campgroundId,
      "reservation.read",
    )) &&
    !(await hasCampgroundPermission(userId, campgroundId, "reservation.modify"))
  ) {
    throw new Error("Reservation access is required for arrival review.");
  }
}

export async function listStaffArrivalReadiness({ userId, campgroundId }) {
  await assertStaffRead(userId, campgroundId);
  const dateRow = await getPool().query(
    `select to_char(statement_timestamp() at time zone timezone,'YYYY-MM-DD') as today
     from public.campgrounds where id=$1`,
    [campgroundId],
  );
  if (dateRow.rowCount !== 1) return [];
  const today = dateRow.rows[0].today;
  const ids = await withRls(userId, async (client) => {
    const result = await client.query(
      `select r.id from public.reservations r
       where r.campground_id=$1 and r.status in ('confirmed','checked_in')
         and r.arrival_date between ($2::date - 1) and ($2::date + 14)
       order by r.arrival_date,r.id limit 150`,
      [campgroundId, today],
    );
    return result.rows.map((row) => row.id);
  });
  if (!ids.length) return [];
  const [details, scoped] = await Promise.all([
    getPool().query(
      `select r.id,r.status,r.arrival_date,r.departure_date,r.row_version,
         a.code as accommodation_code,
         coalesce(nullif(trim(concat(d.primary_first_name,' ',d.primary_last_name)),''),
           'Guest booking') as guest_name,
         d.vehicle_count,d.visitor_count,br.check_in_time,
         ci.id as check_in_id
       from public.reservations r
       join public.accommodations a on a.id=r.accommodation_id
       left join public.reservation_checkout_details d on d.reservation_id=r.id
       left join public.campground_booking_rules br on br.campground_id=r.campground_id
       left join public.reservation_check_ins ci on ci.reservation_id=r.id
       where r.campground_id=$1 and r.id=any($2::uuid[])`,
      [campgroundId, ids],
    ),
    withRls(userId, async (client) => {
      const [plans, reviews] = await Promise.all([
        client.query(
          `select * from public.guest_arrival_plans where reservation_id=any($1::uuid[])`,
          [ids],
        ),
        client.query(
          `select * from public.guest_arrival_staff_reviews where reservation_id=any($1::uuid[])`,
          [ids],
        ),
      ]);
      return { plans: plans.rows, reviews: reviews.rows };
    }),
  ]);
  const byPlan = new Map(
    scoped.plans.map((row) => [row.reservation_id, mapPlan(row)]),
  );
  const byReview = new Map(
    scoped.reviews.map((row) => [row.reservation_id, mapReview(row)]),
  );
  const byDetail = new Map(details.rows.map((row) => [row.id, row]));
  return ids.flatMap((id) => {
    const row = byDetail.get(id);
    if (!row) return [];
    const plan = byPlan.get(id) ?? null;
    const review = byReview.get(id) ?? null;
    return [
      {
        reservationId: id,
        campgroundId,
        status: row.status,
        arrivalDate: date(row.arrival_date),
        departureDate: date(row.departure_date),
        reservationVersion: Number(row.row_version),
        accommodationCode: row.accommodation_code,
        guestName: row.guest_name,
        bookedVehicleCount: Number(row.vehicle_count ?? 0),
        bookedVisitorCount: Number(row.visitor_count ?? 0),
        checkInTime: row.check_in_time
          ? String(row.check_in_time).slice(0, 5)
          : null,
        checkedIn: row.check_in_id != null,
        plan,
        review,
        reviewCurrent: Boolean(
          review &&
          plan &&
          plan.sourceReservationVersion === Number(row.row_version) &&
          review.reviewedPlanVersion === plan.rowVersion &&
          review.reviewedReservationVersion === Number(row.row_version),
        ),
      },
    ];
  });
}

export async function saveStaffArrivalReview({
  userId,
  campgroundId,
  reservationId,
  expectedPlanVersion,
  expectedReservationVersion,
  input,
}) {
  if (
    !(await hasCampgroundPermission(userId, campgroundId, "reservation.modify"))
  ) {
    throw new Error("Reservation modification permission is required.");
  }
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const result = await client.query(
      `select r.organization_id,r.row_version,r.status,
         r.departure_date,
         (statement_timestamp() at time zone c.timezone)::date as local_date,
         p.id as plan_id,p.user_account_id,p.plan_state,p.row_version as plan_version,
         p.source_reservation_version as plan_source_version
       from public.reservations r
       join public.campgrounds c on c.id=r.campground_id
       join public.guest_arrival_plans p on p.reservation_id=r.id
       where r.id=$1 and r.campground_id=$2 for share of r,p`,
      [reservationId, campgroundId],
    );
    if (result.rowCount !== 1)
      throw new Error("No current arrival plan found.");
    const row = result.rows[0];
    if (
      row.status !== "confirmed" ||
      date(row.departure_date) <= date(row.local_date) ||
      row.plan_state !== "submitted" ||
      Number(row.plan_source_version) !== expectedReservationVersion ||
      Number(row.row_version) !== expectedReservationVersion ||
      Number(row.plan_version) !== expectedPlanVersion
    ) {
      throw new Error("Arrival data changed; reload the staff checklist.");
    }
    await client.query("set local role icamp_app");
    await client.query("select set_config('icamp.user_id',$1,true)", [userId]);
    await client.query(
      `insert into public.guest_arrival_staff_reviews (
        organization_id,campground_id,reservation_id,arrival_plan_id,user_account_id,
        review_outcome,review_note,reviewed_plan_version,reviewed_reservation_version,
        reviewed_by_user_id,reviewed_at
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,statement_timestamp())
      on conflict (reservation_id) do update set
        review_outcome=excluded.review_outcome,
        review_note=excluded.review_note,
        reviewed_plan_version=excluded.reviewed_plan_version,
        reviewed_reservation_version=excluded.reviewed_reservation_version,
        reviewed_by_user_id=excluded.reviewed_by_user_id,
        reviewed_at=statement_timestamp()`,
      [
        row.organization_id,
        campgroundId,
        reservationId,
        row.plan_id,
        row.user_account_id,
        input.outcome,
        input.note,
        expectedPlanVersion,
        expectedReservationVersion,
        userId,
      ],
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
