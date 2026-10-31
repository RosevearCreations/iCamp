import pg from "pg";

import { hasCampgroundPermission } from "../authz/postgres.mjs";
import { summarizeOccupancyRows } from "./occupancy-core.mjs";

const { Pool } = pg;
let pool;

function getPool() {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString)
    throw new Error("DATABASE_URL is required for capacity analytics.");
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

export async function closeOccupancyPoolForTests() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

export async function getCampgroundOccupancySummary({ userId, campgroundId }) {
  // Require explicit tenant permission to read the underlying reservation and
  // site records; reports.read by itself is not sufficient for those RLS tables.
  const keys = ["reports.read", "reservation.read", "accommodation.read"];
  const allowed = await Promise.all(
    keys.map((permission) =>
      hasCampgroundPermission(userId, campgroundId, permission),
    ),
  );
  if (!allowed.every(Boolean)) {
    throw new Error("Not authorized for campground occupancy analytics.");
  }

  const client = await getPool().connect();
  try {
    await client.query("begin");
    await client.query("set local role icamp_app");
    await client.query("select set_config('icamp.user_id',$1,true)", [userId]);
    const result = await client.query(
      `with property as (
         select id, timezone from public.campgrounds
         where id=$1 and lifecycle_state='active'
       ), days as (
         select ((statement_timestamp() at time zone p.timezone)::date + gs.offset_days)::date stay_date
         from property p cross join generate_series(0,13) gs(offset_days)
       ), inventory as (
         select a.id,a.status_state from public.accommodations a
         where a.campground_id=$1 and a.lifecycle_state='active'
       ), per_site as (
         select d.stay_date,a.id,a.status_state,
           exists (
             select 1 from public.reservations r
             where r.campground_id=$1 and r.accommodation_id=a.id
               and r.status in ('confirmed','checked_in')
               and r.arrival_date<=d.stay_date and r.departure_date>d.stay_date
           ) or exists (
             select 1 from public.seasonal_assignments s
             where s.campground_id=$1 and s.accommodation_id=a.id
               and s.assignment_state='active'
               and s.starts_on<=d.stay_date and s.ends_on>=d.stay_date
           ) booked,
           exists (
             select 1 from public.reservation_holds h
             where h.campground_id=$1 and h.accommodation_id=a.id
               and h.hold_state='active' and h.expires_at>statement_timestamp()
               and h.arrival_date<=d.stay_date and h.departure_date>d.stay_date
           ) held,
           exists (
             select 1 from public.reservations r
             where r.campground_id=$1 and r.accommodation_id=a.id
               and r.status='pending'
               and r.arrival_date<=d.stay_date and r.departure_date>d.stay_date
           ) pending
         from days d cross join inventory a
       )
       select d.stay_date::text date,
         count(s.id)::integer total_sites,
         count(s.id) filter (where s.status_state not in ('closed','maintenance','inspection','winterized'))::integer operating_sites,
         count(s.id) filter (where s.status_state in ('closed','maintenance','inspection','winterized'))::integer paused_sites,
         count(s.id) filter (where s.booked)::integer booked_sites,
         count(s.id) filter (where s.held)::integer held_sites,
         count(s.id) filter (where s.pending)::integer pending_sites
       from days d left join per_site s on s.stay_date=d.stay_date
       group by d.stay_date order by d.stay_date`,
      [campgroundId],
    );
    await client.query("commit");
    return summarizeOccupancyRows(
      result.rows.map((row) => ({
        date: row.date,
        totalSites: Number(row.total_sites),
        operatingSites: Number(row.operating_sites),
        pausedSites: Number(row.paused_sites),
        bookedSites: Number(row.booked_sites),
        heldSites: Number(row.held_sites),
        pendingSites: Number(row.pending_sites),
      })),
    );
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
