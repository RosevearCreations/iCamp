import pg from "pg";

import { appendAuditEvent } from "../audit/postgres.mjs";
import { hasCampgroundPermission } from "../authz/postgres.mjs";
import {
  longTermPriceFromPlan,
  normalizeSeasonalAssignmentInput,
  normalizeSeasonalReason,
  normalizeSeasonalTransition,
  normalizeSourceChannel,
} from "./core.mjs";

const { Pool } = pg;
let pool;

function databaseUrl() {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) {
    throw new Error("DATABASE_URL is required for seasonal assignments.");
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

export async function closeSeasonalAssignmentPoolForTests() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

async function beginRls(client, userId) {
  await client.query("begin");
  await client.query("set local role icamp_app");
  await client.query("select set_config('icamp.user_id', $1, true)", [userId]);
}

async function mayRead(userId, campgroundId) {
  const [manage, reservations] = await Promise.all([
    hasCampgroundPermission(userId, campgroundId, "seasonal.manage"),
    hasCampgroundPermission(userId, campgroundId, "reservation.read"),
  ]);
  return manage || reservations;
}

async function assertManage(userId, campgroundId) {
  if (
    !(await hasCampgroundPermission(
      userId,
      campgroundId,
      "seasonal.manage",
    ))
  ) {
    throw new Error("Not authorized to manage seasonal assignments.");
  }
}

function mapRatePlan(row) {
  return {
    id: row.id,
    code: row.code,
    displayName: row.display_name,
    accommodationId: row.accommodation_id ?? null,
    accommodationKind: row.accommodation_kind ?? null,
    currencyCode: row.currency_code,
    seasonalCents:
      row.seasonal_cents == null ? null : Number(row.seasonal_cents),
    yearlyCents: row.yearly_cents == null ? null : Number(row.yearly_cents),
    startsOn: String(row.starts_on).slice(0, 10),
    endsOn: String(row.ends_on).slice(0, 10),
    priority: Number(row.priority),
  };
}

export async function listSeasonalAssignmentConsole({
  userId,
  campgroundId,
}) {
  if (!(await mayRead(userId, campgroundId))) {
    throw new Error("Not authorized to read seasonal assignments.");
  }

  const client = await getPool().connect();
  try {
    await beginRls(client, userId);

    const [scope, accommodations, ratePlans, assignments, events] =
      await Promise.all([
        client.query(
          `select id, organization_id, name
           from public.campgrounds
           where id = $1
             and lifecycle_state = 'active'
           limit 1`,
          [campgroundId],
        ),
        client.query(
          `select id, code, display_name, accommodation_kind
           from public.accommodations
           where campground_id = $1
             and lifecycle_state = 'active'
             and accommodation_kind in ('campsite','permanent_unit')
           order by code`,
          [campgroundId],
        ),
        client.query(
          `select
             id,
             code,
             display_name,
             accommodation_id,
             accommodation_kind,
             currency_code,
             seasonal_cents,
             yearly_cents,
             starts_on,
             ends_on,
             priority
           from public.rate_plans
           where campground_id = $1
             and is_active
             and archived_at is null
             and (seasonal_cents is not null or yearly_cents is not null)
           order by
             case when accommodation_id is not null then 0 else 1 end,
             priority,
             display_name,
             code`,
          [campgroundId],
        ),
        client.query(
          `select
             s.id,
             s.accommodation_id,
             s.starts_on,
             s.ends_on,
             s.assignment_state,
             s.assignment_kind,
             s.occupant_display_name,
             s.reference,
             s.winterization_required,
             s.source_channel,
             s.row_version,
             a.code as accommodation_code,
             a.display_name as accommodation_name,
             a.accommodation_kind,
             c.id as charge_id,
             c.rate_plan_id,
             c.rate_plan_code,
             c.charge_period,
             c.currency_code,
             c.amount_cents,
             c.due_on
           from public.seasonal_assignments s
           join public.accommodations a
             on a.id = s.accommodation_id
           left join public.seasonal_assignment_charges c
             on c.assignment_id = s.id
           where s.campground_id = $1
           order by
             case s.assignment_state when 'active' then 0 else 1 end,
             s.starts_on desc,
             a.code`,
          [campgroundId],
        ),
        client.query(
          `select
             e.id,
             e.assignment_id,
             e.event_kind,
             e.from_state,
             e.to_state,
             e.source_channel,
             e.reason,
             e.occurred_at
           from public.seasonal_assignment_events e
           where e.campground_id = $1
           order by e.occurred_at desc
           limit 100`,
          [campgroundId],
        ),
      ]);

    if (scope.rowCount !== 1) {
      throw new Error("Campground is unavailable.");
    }

    await client.query("commit");

    return {
      campground: {
        id: scope.rows[0].id,
        name: scope.rows[0].name,
      },
      accommodations: accommodations.rows.map((row) => ({
        id: row.id,
        code: row.code,
        displayName: row.display_name,
        accommodationKind: row.accommodation_kind,
      })),
      ratePlans: ratePlans.rows.map(mapRatePlan),
      assignments: assignments.rows.map((row) => ({
        id: row.id,
        accommodationId: row.accommodation_id,
        accommodationCode: row.accommodation_code,
        accommodationName: row.accommodation_name,
        accommodationKind: row.accommodation_kind,
        startsOn: String(row.starts_on).slice(0, 10),
        endsOn: String(row.ends_on).slice(0, 10),
        assignmentState: row.assignment_state,
        assignmentKind: row.assignment_kind,
        occupantDisplayName: row.occupant_display_name ?? null,
        reference: row.reference ?? null,
        winterizationRequired: row.winterization_required === true,
        sourceChannel: row.source_channel,
        rowVersion: Number(row.row_version),
        charge:
          row.charge_id == null
            ? null
            : {
                id: row.charge_id,
                ratePlanId: row.rate_plan_id,
                ratePlanCode: row.rate_plan_code,
                chargePeriod: row.charge_period,
                currencyCode: row.currency_code,
                amountCents: Number(row.amount_cents),
                dueOn: String(row.due_on).slice(0, 10),
              },
      })),
      events: events.rows.map((row) => ({
        id: row.id,
        assignmentId: row.assignment_id,
        eventKind: row.event_kind,
        fromState: row.from_state ?? null,
        toState: row.to_state,
        sourceChannel: row.source_channel,
        reason: row.reason,
        occurredAt: new Date(row.occurred_at).toISOString(),
      })),
    };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function createSeasonalAssignment({
  actorUserId,
  campgroundId,
  input,
  reason,
  sourceChannel = "web",
}) {
  await assertManage(actorUserId, campgroundId);
  const normalized = normalizeSeasonalAssignmentInput(input);
  const normalizedReason = normalizeSeasonalReason(reason);
  const channel = normalizeSourceChannel(sourceChannel);
  const client = await getPool().connect();

  try {
    await beginRls(client, actorUserId);
    await client.query(
      "select pg_advisory_xact_lock(hashtextextended($1, 0))",
      ["icamp-seasonal-assignment:" + normalized.accommodationId],
    );

    const scope = await client.query(
      `select id, organization_id, name
       from public.campgrounds
       where id = $1
         and lifecycle_state = 'active'
       limit 1`,
      [campgroundId],
    );
    if (scope.rowCount !== 1) {
      throw new Error("Campground is unavailable.");
    }

    const accommodationResult = await client.query(
      `select id, code, display_name, accommodation_kind
       from public.accommodations
       where id = $1
         and campground_id = $2
         and lifecycle_state = 'active'
         and accommodation_kind in ('campsite','permanent_unit')
       limit 1`,
      [normalized.accommodationId, campgroundId],
    );
    if (accommodationResult.rowCount !== 1) {
      throw new Error(
        "Seasonal/yearly assignments require an active campsite or permanent unit.",
      );
    }
    const accommodation = accommodationResult.rows[0];

    const ratePlanResult = await client.query(
      `select
         id,
         code,
         display_name,
         accommodation_id,
         accommodation_kind,
         currency_code,
         seasonal_cents,
         yearly_cents,
         starts_on,
         ends_on,
         priority
       from public.rate_plans
       where id = $1
         and campground_id = $2
         and is_active
         and archived_at is null
         and starts_on <= $5::date
         and ends_on >= $6::date
         and (
           accommodation_id = $3
           or (
             accommodation_id is null
             and accommodation_kind = $4
           )
         )
         and (
           ($7 = 'seasonal' and seasonal_cents is not null)
           or ($7 = 'yearly' and yearly_cents is not null)
         )
       limit 1`,
      [
        normalized.ratePlanId,
        campgroundId,
        accommodation.id,
        accommodation.accommodation_kind,
        normalized.startsOn,
        normalized.endsOn,
        normalized.assignmentKind,
      ],
    );
    if (ratePlanResult.rowCount !== 1) {
      throw new Error(
        "Selected rate plan does not cover this accommodation, term and assignment kind.",
      );
    }

    const ratePlan = mapRatePlan(ratePlanResult.rows[0]);
    const amountCents = longTermPriceFromPlan(
      ratePlan,
      normalized.assignmentKind,
    );

    const inserted = await client.query(
      `insert into public.seasonal_assignments (
         organization_id,
         campground_id,
         accommodation_id,
         starts_on,
         ends_on,
         assignment_state,
         assignment_kind,
         occupant_display_name,
         reference,
         winterization_required,
         source_channel,
         created_by_user_id,
         updated_by_user_id
       )
       values (
         $1,$2,$3,$4::date,$5::date,'active',$6,$7,$8,$9,$10,$11,$11
       )
       returning *`,
      [
        scope.rows[0].organization_id,
        campgroundId,
        accommodation.id,
        normalized.startsOn,
        normalized.endsOn,
        normalized.assignmentKind,
        normalized.occupantDisplayName,
        normalized.reference,
        normalized.winterizationRequired,
        channel,
        actorUserId,
      ],
    );
    const assignment = inserted.rows[0];

    const snapshot = {
      source: "build039_rate_plan",
      ratePlanId: ratePlan.id,
      ratePlanCode: ratePlan.code,
      assignmentKind: normalized.assignmentKind,
      amountCents,
      currencyCode: ratePlan.currencyCode,
      startsOn: normalized.startsOn,
      endsOn: normalized.endsOn,
    };

    const charge = await client.query(
      `insert into public.seasonal_assignment_charges (
         organization_id,
         campground_id,
         assignment_id,
         rate_plan_id,
         rate_plan_code,
         charge_period,
         currency_code,
         amount_cents,
         due_on,
         pricing_snapshot,
         created_by_user_id
       )
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9::date,$10::jsonb,$11)
       returning id`,
      [
        assignment.organization_id,
        campgroundId,
        assignment.id,
        ratePlan.id,
        ratePlan.code,
        normalized.assignmentKind,
        ratePlan.currencyCode,
        amountCents,
        normalized.startsOn,
        JSON.stringify(snapshot),
        actorUserId,
      ],
    );

    await client.query(
      `insert into public.seasonal_assignment_events (
         organization_id,
         campground_id,
         assignment_id,
         event_kind,
         from_state,
         to_state,
         source_channel,
         reason,
         recorded_by_user_id
       )
       values ($1,$2,$3,'created',null,'active',$4,$5,$6)`,
      [
        assignment.organization_id,
        campgroundId,
        assignment.id,
        channel,
        normalizedReason,
        actorUserId,
      ],
    );

    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      organizationId: assignment.organization_id,
      campgroundId,
      actionKey: "seasonal.assignment.create",
      permissionKey: "seasonal.manage",
      riskLevel: "elevated",
      reason: normalizedReason,
      subjectType: "seasonal_assignment",
      subjectId: assignment.id,
      beforeState: null,
      afterState: {
        accommodationId: accommodation.id,
        accommodationCode: accommodation.code,
        assignmentKind: normalized.assignmentKind,
        startsOn: normalized.startsOn,
        endsOn: normalized.endsOn,
        occupantDisplayName: normalized.occupantDisplayName,
        winterizationRequired: normalized.winterizationRequired,
        chargeId: charge.rows[0].id,
        ratePlanId: ratePlan.id,
        amountCents,
        currencyCode: ratePlan.currencyCode,
      },
      metadata: {
        sourceChannel: channel,
        availabilityEngine: "build035",
        priceSource: "build039",
      },
    });

    await client.query("commit");
    return {
      assignmentId: assignment.id,
      amountCents,
      currencyCode: ratePlan.currencyCode,
    };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function transitionSeasonalAssignment({
  actorUserId,
  campgroundId,
  assignmentId,
  expectedRowVersion,
  action,
  reason,
  sourceChannel = "web",
}) {
  await assertManage(actorUserId, campgroundId);
  const transition = normalizeSeasonalTransition(action);
  const normalizedReason = normalizeSeasonalReason(reason);
  const channel = normalizeSourceChannel(sourceChannel);
  const expected = Number(expectedRowVersion);
  if (!Number.isInteger(expected) || expected < 1) {
    throw new Error("Seasonal assignment row version is invalid.");
  }

  const targetState = transition === "end" ? "ended" : "cancelled";
  const client = await getPool().connect();

  try {
    await beginRls(client, actorUserId);
    await client.query(
      "select pg_advisory_xact_lock(hashtextextended($1, 0))",
      ["icamp-seasonal-assignment-record:" + assignmentId],
    );

    const result = await client.query(
      `select
         s.*,
         a.code as accommodation_code,
         a.display_name as accommodation_name
       from public.seasonal_assignments s
       join public.accommodations a on a.id = s.accommodation_id
       where s.id = $1
         and s.campground_id = $2
       for update of s`,
      [assignmentId, campgroundId],
    );
    if (result.rowCount !== 1) {
      throw new Error("Seasonal assignment was not found.");
    }

    const current = result.rows[0];
    if (current.assignment_state === targetState) {
      await client.query("commit");
      return { assignmentId, idempotent: true, assignmentState: targetState };
    }
    if (current.assignment_state !== "active") {
      throw new Error("Only active seasonal assignments can transition.");
    }
    if (Number(current.row_version) !== expected) {
      throw new Error(
        "Seasonal assignment changed since this page loaded. Refresh and try again.",
      );
    }

    const updated = await client.query(
      `update public.seasonal_assignments
       set assignment_state = $3,
           source_channel = $4,
           updated_by_user_id = $5
       where id = $1
         and campground_id = $2
         and row_version = $6
       returning row_version`,
      [
        assignmentId,
        campgroundId,
        targetState,
        channel,
        actorUserId,
        expected,
      ],
    );
    if (updated.rowCount !== 1) {
      throw new Error(
        "Seasonal assignment changed since this page loaded. Refresh and try again.",
      );
    }

    await client.query(
      `insert into public.seasonal_assignment_events (
         organization_id,
         campground_id,
         assignment_id,
         event_kind,
         from_state,
         to_state,
         source_channel,
         reason,
         recorded_by_user_id
       )
       values ($1,$2,$3,$4,'active',$5,$6,$7,$8)`,
      [
        current.organization_id,
        campgroundId,
        assignmentId,
        transition === "end" ? "ended" : "cancelled",
        targetState,
        channel,
        normalizedReason,
        actorUserId,
      ],
    );

    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      organizationId: current.organization_id,
      campgroundId,
      actionKey:
        transition === "end"
          ? "seasonal.assignment.end"
          : "seasonal.assignment.cancel",
      permissionKey: "seasonal.manage",
      riskLevel: "elevated",
      reason: normalizedReason,
      subjectType: "seasonal_assignment",
      subjectId: assignmentId,
      beforeState: {
        assignmentState: "active",
        rowVersion: Number(current.row_version),
      },
      afterState: {
        assignmentState: targetState,
        rowVersion: Number(updated.rows[0].row_version),
      },
      metadata: {
        sourceChannel: channel,
        availabilityReleased: true,
      },
    });

    await client.query("commit");
    return {
      assignmentId,
      idempotent: false,
      assignmentState: targetState,
    };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
