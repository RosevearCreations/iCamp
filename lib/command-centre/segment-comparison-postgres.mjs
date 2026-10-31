import pg from "pg";

import { hasCampgroundPermission } from "../authz/postgres.mjs";
import { summarizeSegmentComparisons } from "./segment-comparison-core.mjs";

const { Pool } = pg;
let pool;

function getPool() {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString)
    throw new Error("DATABASE_URL is required for segment analytics.");
  if (!pool) {
    pool = new Pool({
      connectionString,
      max: 3,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
  }
  return pool;
}

export async function getCampgroundSegmentComparison({ userId, campgroundId }) {
  const allowed = await Promise.all(
    ["reports.read", "reservation.read", "accommodation.read"].map(
      (permission) => hasCampgroundPermission(userId, campgroundId, permission),
    ),
  );
  if (!allowed.every(Boolean))
    throw new Error("Not authorized to compare campground segments.");
  const client = await getPool().connect();
  try {
    await client.query("begin read only");
    await client.query("set local role icamp_app");
    await client.query("select set_config('icamp.user_id',$1,true)", [userId]);
    const result = await client.query(
      `with property as (
        select id,timezone from public.campgrounds
        where id=$1 and lifecycle_state='active'
      ), bounds as (
        select (statement_timestamp() at time zone p.timezone)::date today
        from property p
      ), days as (
        select ((date_trunc('month',b.today)::date - interval '5 months')::date+gs.offset_day) stay_date
        from bounds b
        cross join lateral generate_series(0,b.today-(date_trunc('month',b.today)::date - interval '5 months')::date) gs(offset_day)
      ), kinds(kind) as (
        values ('campsite'::text),('rental_cottage'::text),('permanent_unit'::text)
      ), inventory as (
        select a.id,a.accommodation_kind
        from public.accommodations a
        where a.campground_id=$1 and a.lifecycle_state='active'
      ), nightly as (
        select d.stay_date,a.id,a.accommodation_kind,
          exists (select 1 from public.reservations r
            where r.campground_id=$1 and r.accommodation_id=a.id
              and r.status in ('confirmed','checked_in','completed')
              and r.arrival_date<=d.stay_date and r.departure_date>d.stay_date) reservation_booked,
          exists (select 1 from public.seasonal_assignments s
            where s.campground_id=$1 and s.accommodation_id=a.id
              and s.assignment_state in ('active','ended')
              and s.starts_on<=d.stay_date and s.ends_on>=d.stay_date) seasonal_booked
        from days d cross join inventory a
      )
      select date_trunc('month',d.stay_date)::date::text month,k.kind,
        count(n.id)::integer site_nights,
        count(n.id) filter (where n.reservation_booked or n.seasonal_booked)::integer booked_nights,
        count(n.id) filter (where n.seasonal_booked)::integer seasonal_nights,
        count(n.id) filter (where n.reservation_booked)::integer reservation_nights
      from days d cross join kinds k
      left join nightly n on n.stay_date=d.stay_date and n.accommodation_kind=k.kind
      group by date_trunc('month',d.stay_date),k.kind
      order by date_trunc('month',d.stay_date),k.kind`,
      [campgroundId],
    );
    await client.query("commit");
    return summarizeSegmentComparisons(
      result.rows.map((row) => ({
        month: row.month,
        kind: row.kind,
        siteNights: Number(row.site_nights),
        bookedNights: Number(row.booked_nights),
        seasonalNights: Number(row.seasonal_nights),
        reservationNights: Number(row.reservation_nights),
      })),
    );
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
