import pg from "pg";

import { hasCampgroundPermission } from "../authz/postgres.mjs";
import { sourceCoverage } from "./core.mjs";

const { Pool } = pg;
let pool;
const LIMITS = Object.freeze({
  reservations: 300,
  holds: 120,
  visitors: 300,
  maintenance: 500,
  turnovers: 500,
});

function getPool() {
  if (!pool) {
    if (!process.env.DATABASE_URL?.trim())
      throw new Error("Front desk workboard database unavailable.");
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
  }
  return pool;
}

export async function closeFrontDeskWorkboardPoolForTests() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

const date = (value) => String(value).slice(0, 10);
const iso = (value) => (value == null ? null : new Date(value).toISOString());

function coverage(result) {
  return sourceCoverage(
    result.rows.length,
    Number(result.rows[0]?.source_total ?? 0),
  );
}

export async function listFrontDeskWorkboard({ userId, campgroundId }) {
  const keys = [
    "reservation.read",
    "reservation.modify",
    "payment.read",
    "visitor.read",
    "visitor.register",
    "maintenance.read",
    "maintenance.create",
    "maintenance.assign",
    "maintenance.complete",
    "accommodation.read",
    "accommodation.manage",
    "reservation.create",
  ];
  const checks = await Promise.all(
    keys.map((key) => hasCampgroundPermission(userId, campgroundId, key)),
  );
  const allowed = new Set(keys.filter((_, index) => checks[index]));
  if (!allowed.has("reservation.read") && !allowed.has("reservation.modify")) {
    throw new Error(
      "Reservation read/modify permission required for the front desk workboard.",
    );
  }
  const permissions = {
    finance: allowed.has("payment.read"),
    visitors: allowed.has("visitor.read") || allowed.has("visitor.register"),
    maintenance: [
      "maintenance.read",
      "maintenance.create",
      "maintenance.assign",
      "maintenance.complete",
    ].some((key) => allowed.has(key)),
    housekeeping:
      allowed.has("accommodation.read") || allowed.has("accommodation.manage"),
    holds: allowed.has("reservation.read") || allowed.has("reservation.create"),
  };

  const client = await getPool().connect();
  try {
    await client.query(
      "begin transaction isolation level repeatable read read only",
    );
    await client.query("set local role icamp_app");
    await client.query("select set_config('icamp.user_id',$1,true)", [userId]);
    const scope = await client.query(
      `select id,name,timezone,
         to_char(transaction_timestamp() at time zone timezone,'YYYY-MM-DD') as local_date
       from public.campgrounds where id=$1 limit 1`,
      [campgroundId],
    );
    if (scope.rowCount !== 1)
      throw new Error("Campground is not available to this desk.");

    // The predicate mirrors the canonical check-in and check-out source windows.
    // COUNT(*) OVER() observes the *full* eligible source before display limits.
    const reservationResult = await client.query(
      `select r.id,r.campground_id,r.accommodation_id,r.status,r.arrival_date,r.departure_date,r.row_version,
         a.code as accommodation_code,a.display_name as accommodation_name,
         coalesce(m.guest_display_name,
           nullif(trim(concat(d.primary_first_name,' ',d.primary_last_name)),''),
           nullif(trim(concat(g.first_name,' ',g.last_name)),''),'Front desk guest') as guest_display_name,
         co.checked_out_at,
         (r.status in ('pending','confirmed','checked_in')
           and r.departure_date >= ((transaction_timestamp() at time zone c.timezone)::date-1)
           and r.arrival_date <= ((transaction_timestamp() at time zone c.timezone)::date+14)) as in_arrival_window,
         (r.status='checked_in' or (r.status='completed' and co.checked_out_at >= transaction_timestamp()-interval '14 days')) as in_departure_window,
         p.plan_state,p.row_version as plan_version,p.source_reservation_version,
         p.assistance_requested,
         rev.review_outcome,rev.reviewed_plan_version,rev.reviewed_reservation_version,
         count(*) over()::integer as source_total
       from public.reservations r
       join public.campgrounds c on c.id=r.campground_id
       left join public.accommodations a on a.id=r.accommodation_id and a.campground_id=r.campground_id
       left join public.reservation_checkout_details d on d.reservation_id=r.id
       left join public.reservation_management_state m on m.reservation_id=r.id
       left join public.guest_profiles g on g.id=r.guest_profile_id and g.campground_id=r.campground_id
       left join public.reservation_check_outs co on co.reservation_id=r.id
       left join public.guest_arrival_plans p on p.reservation_id=r.id
       left join public.guest_arrival_staff_reviews rev on rev.reservation_id=r.id
       where r.campground_id=$1
         and ((r.status in ('pending','confirmed','checked_in')
           and r.departure_date >= ((transaction_timestamp() at time zone c.timezone)::date-1)
           and r.arrival_date <= ((transaction_timestamp() at time zone c.timezone)::date+14))
           or r.status='checked_in'
           or (r.status='completed' and co.checked_out_at >= transaction_timestamp()-interval '14 days'))
       order by case when r.status='checked_in' then 0 when r.status='confirmed' then 1 when r.status='pending' then 2 else 3 end,
         r.arrival_date,r.id
       limit ${LIMITS.reservations}`,
      [campgroundId],
    );
    const reservations = reservationResult.rows.map((row) => ({
      id: row.id,
      campgroundId: row.campground_id,
      accommodationId: row.accommodation_id,
      status: row.status,
      arrivalDate: date(row.arrival_date),
      departureDate: date(row.departure_date),
      accommodationCode: row.accommodation_code ?? "Restricted accommodation",
      accommodationName: row.accommodation_name ?? "See canonical reservation",
      guestDisplayName: row.guest_display_name,
      inArrivalWindow: row.in_arrival_window === true,
      inDepartureWindow: row.in_departure_window === true,
      checkedOutAt: iso(row.checked_out_at),
      plan: row.plan_state
        ? {
            state: row.plan_state,
            assistanceRequested: row.assistance_requested === true,
            reviewOutcome: row.review_outcome,
            reviewCurrent:
              row.source_reservation_version === row.row_version &&
              row.reviewed_plan_version === row.plan_version &&
              row.reviewed_reservation_version === row.row_version,
          }
        : null,
      finance: null,
    }));
    if (permissions.finance && reservations.length) {
      const finance = await client.query(
        `select r.id,coalesce(m.current_total_cents,d.quoted_total_cents,0) as total_cents,
           ps.total_payable_cents,coalesce(m.financial_review_required,false) as financial_review_required,
           coalesce((select sum(pay.amount_cents) from public.reservation_payments pay
             where pay.reservation_id=r.id and pay.payment_state='captured'),0)::bigint as captured_cents,
           coalesce(m.currency_code,d.currency_code,'CAD') as currency_code
         from public.reservations r
         left join public.reservation_management_state m on m.reservation_id=r.id
         left join public.reservation_checkout_details d on d.reservation_id=r.id
         left join public.reservation_payment_schedules ps on ps.reservation_id=r.id
         where r.campground_id=$1 and r.id=any($2::uuid[])`,
        [campgroundId, reservations.map((row) => row.id)],
      );
      const byId = new Map(
        finance.rows.map((row) => [
          row.id,
          {
            outstandingBalanceCents: Math.max(
              0,
              Math.max(
                Number(row.total_cents),
                Number(row.total_payable_cents ?? row.total_cents),
              ) - Number(row.captured_cents),
            ),
            financialReviewRequired: row.financial_review_required === true,
            currencyCode: row.currency_code,
          },
        ]),
      );
      for (const row of reservations) row.finance = byId.get(row.id) ?? null;
    }
    const empty = { rows: [] };
    const holdResult = permissions.holds
      ? await client.query(
          `select h.id,h.campground_id,h.accommodation_id,h.arrival_date,h.departure_date,h.expires_at,
         a.code as accommodation_code,a.display_name as accommodation_name,
         count(*) over()::integer as source_total
       from public.reservation_holds h
       left join public.accommodations a on a.id=h.accommodation_id and a.campground_id=h.campground_id
       where h.campground_id=$1 and h.hold_state='active' and h.expires_at>transaction_timestamp()
         and h.departure_date>((transaction_timestamp() at time zone $2)::date-1)
         and h.arrival_date<=((transaction_timestamp() at time zone $2)::date+14)
       order by h.expires_at,h.id limit ${LIMITS.holds}`,
          [campgroundId, scope.rows[0].timezone],
        )
      : empty;
    const visitorResult = permissions.visitors
      ? await client.query(
          `select v.reservation_id,count(*)::integer as issue_count,
         count(*) filter(where v.registration_status='pending_payment')::integer as pending_count,
         count(*) over()::integer as source_total
       from public.visitor_registrations v where v.campground_id=$1
         and v.valid_until>transaction_timestamp()
         and v.valid_from<transaction_timestamp()+interval '15 days'
         and (v.registration_status='pending_payment' or (v.registration_status='active' and v.payment_state='unpaid'))
       group by v.reservation_id order by issue_count desc,v.reservation_id
       limit ${LIMITS.visitors}`,
          [campgroundId],
        )
      : empty;
    const maintenanceResult = permissions.maintenance
      ? await client.query(
          `select accommodation_id,count(*)::integer as open_count,
         count(*) filter(where status='blocked')::integer as blocked_count,
         count(*) over()::integer as source_total
       from public.maintenance_work_orders
       where campground_id=$1 and status in ('open','assigned','in_progress','blocked')
       group by accommodation_id order by blocked_count desc,open_count desc,accommodation_id nulls first
       limit ${LIMITS.maintenance}`,
          [campgroundId],
        )
      : empty;
    const turnoverResult = permissions.housekeeping
      ? await client.query(
          `select accommodation_id,count(*)::integer as open_count,
         count(*) filter(where status='blocked')::integer as blocked_count,
         count(*) over()::integer as source_total
       from public.cottage_turnovers
       where campground_id=$1 and status in ('scheduled','in_progress','inspection','blocked')
       group by accommodation_id order by blocked_count desc,open_count desc,accommodation_id
       limit ${LIMITS.turnovers}`,
          [campgroundId],
        )
      : empty;
    await client.query("commit");
    return {
      campground: {
        id: campgroundId,
        name: scope.rows[0].name,
        timezone: scope.rows[0].timezone,
        localDate: scope.rows[0].local_date,
      },
      permissions,
      reservations,
      holds: holdResult.rows.map((row) => ({
        id: row.id,
        campgroundId: row.campground_id,
        accommodationId: row.accommodation_id,
        arrivalDate: date(row.arrival_date),
        departureDate: date(row.departure_date),
        accommodationCode: row.accommodation_code ?? "Restricted accommodation",
        accommodationName: row.accommodation_name ?? "See holds desk",
        expiresAt: iso(row.expires_at),
      })),
      visitors: visitorResult.rows.map((row) => ({
        reservationId: row.reservation_id,
        issueCount: Number(row.issue_count),
        pendingCount: Number(row.pending_count),
      })),
      maintenance: maintenanceResult.rows.map((row) => ({
        accommodationId: row.accommodation_id,
        openCount: Number(row.open_count),
        blockedCount: Number(row.blocked_count),
      })),
      turnovers: turnoverResult.rows.map((row) => ({
        accommodationId: row.accommodation_id,
        openCount: Number(row.open_count),
        blockedCount: Number(row.blocked_count),
      })),
      coverage: {
        reservations: coverage(reservationResult),
        holds: permissions.holds ? coverage(holdResult) : null,
        visitors: permissions.visitors ? coverage(visitorResult) : null,
        maintenance: permissions.maintenance
          ? coverage(maintenanceResult)
          : null,
        turnovers: permissions.housekeeping ? coverage(turnoverResult) : null,
      },
    };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
