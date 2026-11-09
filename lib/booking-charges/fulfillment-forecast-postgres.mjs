import pg from "pg";

import { appendAuditEvent } from "../audit/postgres.mjs";
import { hasCampgroundPermission } from "../authz/postgres.mjs";
import {
  classifyFulfillmentForecast,
  FULFILLMENT_FORECAST_HORIZON_DAYS,
  validateFulfillmentPlanningSettings,
} from "./fulfillment-forecast-core.mjs";

const { Pool } = pg;
let pool;

function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL?.trim();
    if (!connectionString)
      throw new Error("DATABASE_URL is required for fulfillment forecasts.");
    pool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
  }
  return pool;
}

export async function closeForecastPoolForTests() {
  if (pool) await pool.end();
  pool = undefined;
}

async function canForecast(userId, campgroundId) {
  const permissions = await Promise.all(
    ["reservation.modify", "staff.manage", "schedule.manage"].map(
      (permission) => hasCampgroundPermission(userId, campgroundId, permission),
    ),
  );
  return permissions.every(Boolean);
}

async function beginScoped(client, userId) {
  await client.query("begin");
  await client.query("set local role icamp_app");
  await client.query("select set_config('icamp.user_id', $1, true)", [userId]);
}

function dateText(value) {
  return value instanceof Date
    ? value.toISOString().slice(0, 10)
    : String(value).slice(0, 10);
}

function mapSettings(row) {
  if (!row?.row_version) return null;
  return {
    morningStart: String(row.morning_start).slice(0, 5),
    morningEnd: String(row.morning_end).slice(0, 5),
    afternoonStart: String(row.afternoon_start).slice(0, 5),
    afternoonEnd: String(row.afternoon_end).slice(0, 5),
    eveningStart: String(row.evening_start).slice(0, 5),
    eveningEnd: String(row.evening_end).slice(0, 5),
    maxUnitsPerStaffWindow:
      row.max_units_per_staff_window === null
        ? null
        : Number(row.max_units_per_staff_window),
    rowVersion: Number(row.row_version),
  };
}

export async function getCampgroundFulfillmentForecast({
  userId,
  campgroundId,
  activeStaffIds = [],
}) {
  if (!(await canForecast(userId, campgroundId))) {
    return {
      canForecast: false,
      timezone: null,
      settings: null,
      rows: [],
      truncated: false,
      horizonDays: FULFILLMENT_FORECAST_HORIZON_DAYS,
    };
  }
  const client = await getPool().connect();
  try {
    await beginScoped(client, userId);
    const campground = await client.query(
      `select c.timezone, p.* from public.campgrounds c
       left join public.service_fulfillment_planning_settings p
         on p.campground_id = c.id and p.organization_id = c.organization_id
       where c.id = $1 and c.lifecycle_state = 'active' limit 1`,
      [campgroundId],
    );
    if (campground.rowCount !== 1)
      throw new Error("Campground planning forecast is unavailable.");
    const settings = mapSettings(campground.rows[0]);
    // Read-only 30-day forecast. PostgreSQL resolves local service dates in the
    // actual campground IANA time zone (including DST), not server UTC.
    const result = await client.query(
      `with demand as (
         select j.service_date, j.service_window, a.assigned_user_id,
                sum(j.quantity)::bigint as units, count(*)::bigint as jobs
         from public.service_fulfillment_jobs j
         join public.reservations r on r.id = j.reservation_id
           and r.organization_id = j.organization_id and r.campground_id = j.campground_id
         join public.campgrounds c on c.id = j.campground_id
         left join public.service_fulfillment_assignments a on a.job_id = j.id
           and a.campground_id = j.campground_id
         where j.campground_id = $1 and j.job_state <> 'completed'
           and r.status in ('pending','confirmed','checked_in')
           and j.service_date >= (statement_timestamp() at time zone c.timezone)::date
           and j.service_date < (statement_timestamp() at time zone c.timezone)::date + 30
         group by j.service_date, j.service_window, a.assigned_user_id
       ), local_bounds as (
         select d.*,
           case d.service_window
             when 'morning' then p.morning_start
             when 'afternoon' then p.afternoon_start
             when 'evening' then p.evening_start
             else null end as local_start,
           case d.service_window
             when 'morning' then p.morning_end
             when 'afternoon' then p.afternoon_end
             when 'evening' then p.evening_end
             else null end as local_end,
           p.max_units_per_staff_window
         from demand d
         left join public.service_fulfillment_planning_settings p
           on p.campground_id = $1
       ), windows as (
         select b.*,
           (b.service_date + b.local_start) at time zone c.timezone as starts_at,
           (b.service_date + b.local_end) at time zone c.timezone as ends_at
         from local_bounds b
         join public.campgrounds c on c.id = $1
       )
       select w.*,
         exists (
           select 1 from icamp_private.staff_shift_assignments s
           where s.campground_id = $1 and s.staff_user_id = w.assigned_user_id
             and s.starts_at <= w.starts_at and s.ends_at >= w.ends_at
             and not exists (select 1 from icamp_private.staff_shift_events e
               where e.shift_id = s.id and e.kind = 'cancel')
         ) as has_covering_shift,
         exists (
           select 1 from icamp_private.staff_shift_assignments s
           where s.campground_id = $1 and s.staff_user_id = w.assigned_user_id
             and s.starts_at < w.ends_at and s.ends_at > w.starts_at
             and not exists (select 1 from icamp_private.staff_shift_events e
               where e.shift_id = s.id and e.kind = 'cancel')
         ) as has_overlapping_shift,
         exists (
           select 1 from icamp_private.staff_shift_availability a
           where a.campground_id = $1 and a.staff_user_id = w.assigned_user_id
             and a.kind = 'unavailable'
             and a.starts_at < w.ends_at and a.ends_at > w.starts_at
             and not exists (select 1 from icamp_private.staff_shift_availability clear
               where clear.clears_event_id = a.id)
         ) as declared_unavailable
       from windows w
       order by w.service_date, w.service_window, w.assigned_user_id nulls first
       limit 251`,
      [campgroundId],
    );
    await client.query("commit");
    const activeSet = new Set(activeStaffIds);
    return {
      canForecast: true,
      timezone: campground.rows[0].timezone,
      settings,
      rows: result.rows.slice(0, 250).map((row) => {
        const assignedUserId = row.assigned_user_id ?? null;
        const units = Number(row.units);
        const maxUnitsPerStaffWindow =
          row.max_units_per_staff_window === null
            ? null
            : Number(row.max_units_per_staff_window);
        return {
          serviceDate: dateText(row.service_date),
          serviceWindow: row.service_window,
          assignedUserId,
          units,
          jobs: Number(row.jobs),
          maxUnitsPerStaffWindow,
          status: classifyFulfillmentForecast({
            assignedUserId,
            activeStaff: activeSet.has(assignedUserId),
            serviceWindow: row.service_window,
            windowsConfigured: Boolean(settings),
            declaredUnavailable: row.declared_unavailable,
            hasCoveringShift: row.has_covering_shift,
            hasOverlappingShift: row.has_overlapping_shift,
            units,
            maxUnitsPerStaffWindow,
          }),
        };
      }),
      truncated: result.rows.length > 250,
      horizonDays: FULFILLMENT_FORECAST_HORIZON_DAYS,
    };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function updateCampgroundFulfillmentPlanningSettings({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  ...input
}) {
  if (!(await canForecast(actorUserId, campgroundId))) {
    throw new Error(
      "Only an authorized schedule supervisor can set capacity limits.",
    );
  }
  const settings = validateFulfillmentPlanningSettings(input);
  const client = await getPool().connect();
  try {
    await beginScoped(client, actorUserId);
    // A campground-scoped advisory lock serializes initial policy creation
    // without granting a schedule supervisor campground.configuration writes.
    await client.query(
      "select pg_advisory_xact_lock(hashtextextended('fulfillment-forecast:' || $1::text, 0))",
      [campgroundId],
    );
    const scope = await client.query(
      `select organization_id from public.campgrounds
       where id = $1 and lifecycle_state = 'active'`,
      [campgroundId],
    );
    if (scope.rowCount !== 1) throw new Error("Campground is unavailable.");
    const existing = await client.query(
      `select * from public.service_fulfillment_planning_settings
       where campground_id = $1 for update`,
      [campgroundId],
    );
    const old = mapSettings(existing.rows[0]);
    if ((old?.rowVersion ?? 0) !== settings.expectedRowVersion) {
      throw new Error("Planning settings changed. Refresh and retry.");
    }
    const values = [
      campgroundId,
      scope.rows[0].organization_id,
      settings.morningStart,
      settings.morningEnd,
      settings.afternoonStart,
      settings.afternoonEnd,
      settings.eveningStart,
      settings.eveningEnd,
      settings.maxUnitsPerStaffWindow,
      actorUserId,
    ];
    const saved = existing.rowCount
      ? await client.query(
          `update public.service_fulfillment_planning_settings
           set morning_start = $3::time, morning_end = $4::time,
               afternoon_start = $5::time, afternoon_end = $6::time,
               evening_start = $7::time, evening_end = $8::time,
               max_units_per_staff_window = $9, updated_by_user_id = $10
           where campground_id = $1 and organization_id = $2
             and row_version = $11 returning row_version`,
          [...values, settings.expectedRowVersion],
        )
      : await client.query(
          `insert into public.service_fulfillment_planning_settings
           (campground_id, organization_id, morning_start, morning_end,
            afternoon_start, afternoon_end, evening_start, evening_end,
            max_units_per_staff_window, updated_by_user_id)
           values ($1, $2, $3::time, $4::time, $5::time, $6::time,
             $7::time, $8::time, $9, $10) returning row_version`,
          values,
        );
    if (saved.rowCount !== 1)
      throw new Error("Planning settings changed. Refresh and retry.");
    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: scope.rows[0].organization_id,
      campgroundId,
      actionKey: "campground.service_fulfillment.forecast_settings",
      permissionKey: "schedule.manage",
      subjectType: "service_fulfillment_planning_settings",
      subjectId: campgroundId,
      beforeState: old,
      afterState: {
        ...settings,
        rowVersion: Number(saved.rows[0].row_version),
      },
    });
    await client.query("commit");
    return { rowVersion: Number(saved.rows[0].row_version) };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
