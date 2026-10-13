import pg from "pg";

import { appendAuditEvent } from "../audit/postgres.mjs";
import { hasCampgroundPermission } from "../authz/postgres.mjs";
import {
  defaultBookingRulePolicy,
  evaluateBookingDateRules,
  validateBookingPolicyInput,
  validateCalendarPeriodInput,
} from "./core.mjs";

const { Pool } = pg;
let pool;

function databaseUrl() {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) {
    throw new Error("DATABASE_URL is required for booking date rules.");
  }
  return value;
}

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: databaseUrl(),
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
  }
  return pool;
}

export async function closeBookingRulesPoolForTests() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

async function allowed(userId, campgroundId, permission) {
  return hasCampgroundPermission(userId, campgroundId, permission);
}

async function assertCanRead(userId, campgroundId) {
  const results = await Promise.all(
    [
      "campground.configuration",
      "reservation.read",
      "reservation.create",
      "reservation.modify",
      "reservation.override",
    ].map((permission) => allowed(userId, campgroundId, permission)),
  );
  if (!results.some(Boolean)) {
    throw new Error("Not authorized to read campground booking rules.");
  }
}

async function assertCanManage(userId, campgroundId) {
  if (!(await allowed(userId, campgroundId, "campground.configuration"))) {
    throw new Error("Not authorized to manage campground booking rules.");
  }
}

async function beginRls(client, userId) {
  await client.query("begin");
  await client.query("set local role icamp_app");
  await client.query("select set_config('icamp.user_id', $1, true)", [userId]);
}

function shortTime(value) {
  return String(value ?? "").slice(0, 5);
}

function mapPolicy(row) {
  if (!row) {
    return {
      ...defaultBookingRulePolicy,
      weekendIsoDays: [...defaultBookingRulePolicy.weekendIsoDays],
      rowVersion: 0,
      persisted: false,
    };
  }
  return {
    checkInTime: shortTime(row.check_in_time),
    checkOutTime: shortTime(row.check_out_time),
    minimumBookingLeadDays: Number(row.minimum_booking_lead_days),
    maximumBookingLeadDays: Number(row.maximum_booking_lead_days),
    minimumStayNights: Number(row.minimum_stay_nights),
    maximumStayNights: Number(row.maximum_stay_nights),
    weekendIsoDays: (row.weekend_iso_days ?? []).map(Number),
    rowVersion: Number(row.row_version),
    persisted: true,
  };
}

function mapPeriod(row) {
  return {
    id: row.id,
    periodKind: row.period_kind,
    code: row.code,
    displayName: row.display_name,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    minimumStayNights:
      row.minimum_stay_nights === null
        ? null
        : Number(row.minimum_stay_nights),
    maximumStayNights:
      row.maximum_stay_nights === null
        ? null
        : Number(row.maximum_stay_nights),
    notes: row.notes ?? null,
    isActive: row.is_active,
    rowVersion: Number(row.row_version),
    createdAt: row.created_at,
    archivedAt: row.archived_at,
  };
}

async function campgroundScope(client, campgroundId) {
  const result = await client.query(
    "select organization_id, id, name, timezone from public.campgrounds where id = $1 and lifecycle_state <> 'archived' limit 1",
    [campgroundId],
  );
  if (result.rowCount !== 1) {
    throw new Error("Campground is unavailable.");
  }
  return result.rows[0];
}

export async function getBookingRuleSnapshot(userId, campgroundId) {
  await assertCanRead(userId, campgroundId);
  const client = await getPool().connect();
  try {
    await beginRls(client, userId);
    const campground = await campgroundScope(client, campgroundId);
    const [policyResult, periodsResult] = await Promise.all([
      client.query(
        "select * from public.campground_booking_rules where campground_id = $1 limit 1",
        [campgroundId],
      ),
      client.query(
        "select * from public.booking_calendar_periods where campground_id = $1 order by is_active desc, starts_on, period_kind, display_name",
        [campgroundId],
      ),
    ]);
    await client.query("commit");

    return {
      campground: {
        id: campground.id,
        organizationId: campground.organization_id,
        name: campground.name,
        timezone: campground.timezone,
      },
      policy: mapPolicy(policyResult.rows[0]),
      periods: periodsResult.rows.map(mapPeriod),
    };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function saveBookingRulePolicy({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  expectedRowVersion,
  ...input
}) {
  await assertCanManage(actorUserId, campgroundId);
  const policy = validateBookingPolicyInput(input);
  const expected = Number(expectedRowVersion);
  if (!Number.isInteger(expected) || expected < 0) {
    throw new Error("Booking rule row version is invalid.");
  }

  const client = await getPool().connect();
  try {
    await beginRls(client, actorUserId);
    const campground = await campgroundScope(client, campgroundId);
    const existingResult = await client.query(
      "select * from public.campground_booking_rules where campground_id = $1 limit 1 for update",
      [campgroundId],
    );
    const before = existingResult.rows[0] ?? null;
    let saved;

    if (before) {
      if (Number(before.row_version) !== expected) {
        throw new Error(
          "Booking rules changed since this page loaded. Refresh and try again.",
        );
      }
      const updated = await client.query(
        "update public.campground_booking_rules set check_in_time = $3::time, check_out_time = $4::time, minimum_booking_lead_days = $5, maximum_booking_lead_days = $6, minimum_stay_nights = $7, maximum_stay_nights = $8, weekend_iso_days = $9::smallint[], updated_by_user_id = $10 where campground_id = $1 and organization_id = $2 and row_version = $11 returning *",
        [
          campgroundId,
          campground.organization_id,
          policy.checkInTime,
          policy.checkOutTime,
          policy.minimumBookingLeadDays,
          policy.maximumBookingLeadDays,
          policy.minimumStayNights,
          policy.maximumStayNights,
          policy.weekendIsoDays,
          actorUserId,
          expected,
        ],
      );
      if (updated.rowCount !== 1) {
        throw new Error(
          "Booking rules changed since this page loaded. Refresh and try again.",
        );
      }
      saved = updated.rows[0];
    } else {
      if (expected !== 0) {
        throw new Error(
          "Booking rules changed since this page loaded. Refresh and try again.",
        );
      }
      const inserted = await client.query(
        "insert into public.campground_booking_rules (organization_id, campground_id, check_in_time, check_out_time, minimum_booking_lead_days, maximum_booking_lead_days, minimum_stay_nights, maximum_stay_nights, weekend_iso_days, updated_by_user_id) values ($1,$2,$3::time,$4::time,$5,$6,$7,$8,$9::smallint[],$10) returning *",
        [
          campground.organization_id,
          campgroundId,
          policy.checkInTime,
          policy.checkOutTime,
          policy.minimumBookingLeadDays,
          policy.maximumBookingLeadDays,
          policy.minimumStayNights,
          policy.maximumStayNights,
          policy.weekendIsoDays,
          actorUserId,
        ],
      );
      saved = inserted.rows[0];
    }

    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: campground.organization_id,
      campgroundId,
      actionKey: "campground.booking_rules.save",
      permissionKey: "campground.configuration",
      riskLevel: "standard",
      subjectType: "campground.booking_rules",
      subjectId: campgroundId,
      beforeState: before ? mapPolicy(before) : null,
      afterState: mapPolicy(saved),
    });

    await client.query("commit");
    return mapPolicy(saved);
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function createBookingCalendarPeriod({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  ...input
}) {
  await assertCanManage(actorUserId, campgroundId);
  const period = validateCalendarPeriodInput(input);
  const client = await getPool().connect();

  try {
    await beginRls(client, actorUserId);
    const campground = await campgroundScope(client, campgroundId);
    const inserted = await client.query(
      "insert into public.booking_calendar_periods (organization_id, campground_id, period_kind, code, display_name, starts_on, ends_on, minimum_stay_nights, maximum_stay_nights, notes, created_by_user_id, updated_by_user_id) values ($1,$2,$3,$4,$5,$6::date,$7::date,$8,$9,$10,$11,$11) returning *",
      [
        campground.organization_id,
        campgroundId,
        period.periodKind,
        period.code,
        period.displayName,
        period.startsOn,
        period.endsOn,
        period.minimumStayNights,
        period.maximumStayNights,
        period.notes,
        actorUserId,
      ],
    );
    const saved = inserted.rows[0];

    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: campground.organization_id,
      campgroundId,
      actionKey: "campground.booking_calendar_period.create",
      permissionKey: "campground.configuration",
      riskLevel: "standard",
      subjectType: "campground.booking_calendar_period",
      subjectId: saved.id,
      beforeState: null,
      afterState: mapPeriod(saved),
    });

    await client.query("commit");
    return mapPeriod(saved);
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    if (error?.code === "23505") {
      throw new Error(
        "A booking calendar period already uses that type, code and start date.",
      );
    }
    if (String(error?.message ?? "").includes("cannot overlap")) {
      throw new Error(
        "That season overlaps another active season. Archive the old season or adjust the dates.",
      );
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function archiveBookingCalendarPeriod({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  periodId,
  expectedRowVersion,
}) {
  await assertCanManage(actorUserId, campgroundId);
  const expected = Number(expectedRowVersion);
  if (!Number.isInteger(expected) || expected < 1) {
    throw new Error("Calendar period row version is invalid.");
  }

  const client = await getPool().connect();
  try {
    await beginRls(client, actorUserId);
    const campground = await campgroundScope(client, campgroundId);
    const beforeResult = await client.query(
      "select * from public.booking_calendar_periods where id = $1 and campground_id = $2 limit 1 for update",
      [periodId, campgroundId],
    );
    if (beforeResult.rowCount !== 1) {
      throw new Error("Booking calendar period is unavailable.");
    }
    const before = beforeResult.rows[0];
    if (!before.is_active) {
      throw new Error("Booking calendar period is already archived.");
    }

    const updated = await client.query(
      "update public.booking_calendar_periods set is_active = false, archived_at = statement_timestamp(), updated_by_user_id = $4 where id = $1 and campground_id = $2 and row_version = $3 returning *",
      [periodId, campgroundId, expected, actorUserId],
    );
    if (updated.rowCount !== 1) {
      throw new Error(
        "Booking calendar period changed since this page loaded. Refresh and try again.",
      );
    }
    const saved = updated.rows[0];

    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: campground.organization_id,
      campgroundId,
      actionKey: "campground.booking_calendar_period.archive",
      permissionKey: "campground.configuration",
      riskLevel: "standard",
      subjectType: "campground.booking_calendar_period",
      subjectId: periodId,
      beforeState: mapPeriod(before),
      afterState: mapPeriod(saved),
    });

    await client.query("commit");
    return mapPeriod(saved);
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function evaluateCampgroundBookingDates({
  userId,
  campgroundId,
  arrivalDate,
  departureDate,
  bookingDate,
}) {
  const snapshot = await getBookingRuleSnapshot(userId, campgroundId);
  return evaluateBookingDateRules({
    policy: snapshot.policy,
    periods: snapshot.periods,
    arrivalDate,
    departureDate,
    bookingDate,
  });
}
