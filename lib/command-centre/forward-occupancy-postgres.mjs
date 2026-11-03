import pg from "pg";

import { hasCampgroundPermission } from "../authz/postgres.mjs";
import { SEGMENT_KINDS } from "./segment-comparison-core.mjs";

const { Pool } = pg;
let pool;

function getPool() {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString)
    throw new Error(
      "DATABASE_URL is required for forward occupancy analytics.",
    );
  if (!pool)
    pool = new Pool({
      connectionString,
      max: 3,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
  return pool;
}

export async function closeForwardOccupancyPoolForTests() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

export async function getCampgroundForwardOccupancySource({
  userId,
  campgroundId,
}) {
  const allowed = await Promise.all(
    ["reports.read", "reservation.read", "accommodation.read"].map(
      (permission) => hasCampgroundPermission(userId, campgroundId, permission),
    ),
  );
  if (!allowed.every(Boolean)) {
    throw new Error("Not authorized for forward occupancy analytics.");
  }

  const client = await getPool().connect();
  try {
    await client.query("begin read only");
    await client.query("set local role icamp_app");
    await client.query("set local statement_timeout = '12000ms'");
    await client.query("select set_config('icamp.user_id',$1,true)", [userId]);
    // Expand only actual booking/assignment ranges, not every site for every
    // historical day. Distinct site/day rows prevent seasonal/reservation overlap
    // from inflating occupancy, while current inventory defines a labeled proxy.
    const result = await client.query(
      `with property as (
         select id, timezone from public.campgrounds
         where id=$1 and lifecycle_state='active'
       ), anchor as (
         select (statement_timestamp() at time zone p.timezone)::date local_today,
           statement_timestamp() as source_at, p.timezone,
           (date_trunc('month', (statement_timestamp() at time zone p.timezone)::date)::date
             - interval '26 months')::date first_day
         from property p
       ), months as (
         select (a.first_day + interval '1 month' * gs.n)::date month_start
         from anchor a cross join generate_series(0,26) gs(n)
       ), kinds(kind) as (
         values ('campsite'::text),('rental_cottage'::text),('permanent_unit'::text)
       ), inventory as (
         select a.id,a.accommodation_kind,a.status_state
         from public.accommodations a
         where a.campground_id=$1 and a.lifecycle_state='active'
       ), inventory_counts as (
         select a.accommodation_kind,count(*)::bigint active_sites,
           count(*) filter (where a.status_state not in
             ('closed','maintenance','inspection','winterized'))::integer operating_sites
         from inventory a group by a.accommodation_kind
       ), booked_dates as (
         select r.accommodation_id,a.accommodation_kind,d.stay_date::date stay_date
         from public.reservations r
         join inventory a on a.id=r.accommodation_id
         cross join anchor b
         cross join lateral generate_series(
           greatest(r.arrival_date,b.first_day),
           least(r.departure_date - 1,b.local_today),
           interval '1 day'
         ) d(stay_date)
         where r.campground_id=$1
           and r.status in ('confirmed','checked_in','completed')
           and r.arrival_date<=b.local_today and r.departure_date>b.first_day
         union all
         select s.accommodation_id,a.accommodation_kind,d.stay_date::date stay_date
         from public.seasonal_assignments s
         join inventory a on a.id=s.accommodation_id
         cross join anchor b
         cross join lateral generate_series(
           greatest(s.starts_on,b.first_day),
           least(s.ends_on,b.local_today),
           interval '1 day'
         ) d(stay_date)
         where s.campground_id=$1
           and s.assignment_state in ('active','ended')
           and s.starts_on<=b.local_today and s.ends_on>=b.first_day
       ), booked_months as (
         select date_trunc('month',stay_date)::date month_start,accommodation_kind,
           count(*)::bigint booked_nights
         from (select distinct accommodation_id,accommodation_kind,stay_date
           from booked_dates) u
         group by date_trunc('month',stay_date)::date,accommodation_kind
       )
       select m.month_start::text as month,k.kind,
         coalesce(i.active_sites,0) *
           (least((m.month_start + interval '1 month - 1 day')::date,a.local_today)
             - m.month_start + 1)::bigint site_nights,
         coalesce(b.booked_nights,0)::bigint booked_nights,
         coalesce(i.operating_sites,0)::integer operating_sites,
         a.local_today::text local_today,a.source_at,a.timezone
       from months m cross join kinds k cross join anchor a
       left join inventory_counts i on i.accommodation_kind=k.kind
       left join booked_months b on b.month_start=m.month_start
         and b.accommodation_kind=k.kind
       order by m.month_start,k.kind`,
      [campgroundId],
    );
    await client.query("commit");
    if (result.rows.length !== 81)
      throw new Error("Forward occupancy source is incomplete.");
    const first = result.rows[0];
    const months = [...new Set(result.rows.map((row) => row.month))];
    const operatingSites = Object.fromEntries(
      SEGMENT_KINDS.map((kind) => [
        kind,
        Number(
          result.rows.find((row) => row.kind === kind)?.operating_sites ?? 0,
        ),
      ]),
    );
    const segments = SEGMENT_KINDS.map((kind) => ({
      kind,
      months: result.rows
        .filter((row) => row.kind === kind)
        .map((row) => ({
          month: row.month,
          siteNights: Number(row.site_nights),
          bookedNights: Number(row.booked_nights),
        })),
    }));
    return {
      generatedAt: new Date(first.source_at).toISOString(),
      asOfLocalDate: first.local_today,
      timezone: first.timezone,
      months,
      operatingSites,
      segments,
    };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
