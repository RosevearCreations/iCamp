import pg from "pg";

import { appendAuditEvent } from "../audit/postgres.mjs";
import { hasCampgroundPermission } from "../authz/postgres.mjs";
import {
  assignmentStateForEvent,
  normalizeAssignmentTransition,
  normalizeLongTermAssignment,
  normalizeSourceChannel,
  occupancyStateForEvent,
} from "./core.mjs";

const { Pool } = pg;
let pool;

function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL?.trim();
    if (!connectionString) {
      throw new Error("DATABASE_URL is required for long-term assignments.");
    }
    pool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }
  return pool;
}

export async function closeLongTermAssignmentPoolForTests() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

async function assertManage(userId, campgroundId) {
  if (
    !(await hasCampgroundPermission(userId, campgroundId, "seasonal.manage"))
  ) {
    throw new Error("Not authorized to manage long-term assignments.");
  }
}

async function mayRead(userId, campgroundId) {
  const [manage, reservationRead] = await Promise.all([
    hasCampgroundPermission(userId, campgroundId, "seasonal.manage"),
    hasCampgroundPermission(userId, campgroundId, "reservation.read"),
  ]);
  return manage || reservationRead;
}

async function beginRls(client, userId) {
  await client.query("begin");
  await client.query("set local role icamp_app");
  await client.query("select set_config('icamp.user_id', $1, true)", [userId]);
}

function iso(value) {
  return String(value).slice(0, 10);
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
    startsOn: iso(row.starts_on),
    endsOn: iso(row.ends_on),
  };
}

export async function listLongTermAssignmentOptions({ userId, campgroundId }) {
  await assertManage(userId, campgroundId);
  const client = await getPool().connect();
  try {
    await beginRls(client, userId);
    const [accommodations, plans] = await Promise.all([
      client.query(
        `select
           a.id,
           a.code,
           a.display_name,
           a.accommodation_kind,
           c.stay_profile
         from public.accommodations a
         left join public.campsites c on c.accommodation_id = a.id
         where a.campground_id = $1
           and a.lifecycle_state = 'active'
           and a.accommodation_kind in ('campsite','permanent_unit')
           and (
             a.accommodation_kind = 'permanent_unit'
             or c.stay_profile in ('seasonal','yearly')
           )
         order by a.code`,
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
           ends_on
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
    ]);
    await client.query("commit");

    return {
      accommodations: accommodations.rows.map((row) => ({
        id: row.id,
        code: row.code,
        displayName: row.display_name,
        accommodationKind: row.accommodation_kind,
        stayProfile: row.stay_profile ?? null,
      })),
      ratePlans: plans.rows.map(mapRatePlan),
    };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function listLongTermAssignments({ userId, campgroundId }) {
  if (!(await mayRead(userId, campgroundId))) {
    throw new Error("Not authorized to read long-term assignments.");
  }

  const client = await getPool().connect();
  try {
    await beginRls(client, userId);
    const result = await client.query(
      `select
         s.*,
         a.code accommodation_code,
         a.display_name accommodation_name,
         a.accommodation_kind
       from public.seasonal_assignments s
       join public.accommodations a on a.id = s.accommodation_id
       where s.campground_id = $1
       order by s.assignment_state = 'active' desc, s.starts_on desc, a.code`,
      [campgroundId],
    );
    await client.query("commit");
    return result.rows.map((row) => ({
      id: row.id,
      organizationId: row.organization_id,
      campgroundId: row.campground_id,
      accommodationId: row.accommodation_id,
      accommodationCode: row.accommodation_code,
      accommodationName: row.accommodation_name,
      accommodationKind: row.accommodation_kind,
      assignmentKind: row.assignment_kind,
      assignmentState: row.assignment_state,
      occupancyState: row.occupancy_state,
      occupantDisplayName: row.occupant_display_name,
      contactEmail: row.contact_email ?? null,
      startsOn: iso(row.starts_on),
      endsOn: iso(row.ends_on),
      ratePlanId: row.rate_plan_id ?? null,
      chargeAmountCents:
        row.charge_amount_cents == null
          ? null
          : Number(row.charge_amount_cents),
      currencyCode: row.currency_code,
      chargeDueOn: row.charge_due_on == null ? null : iso(row.charge_due_on),
      reference: row.reference ?? null,
      notes: row.notes ?? null,
      winterizationRequired: row.winterization_required === true,
      rowVersion: Number(row.row_version),
    }));
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function createLongTermAssignment({
  actorUserId,
  campgroundId,
  input,
  sourceChannel = "web",
}) {
  await assertManage(actorUserId, campgroundId);
  const value = normalizeLongTermAssignment(input);
  const channel = normalizeSourceChannel(sourceChannel);
  const client = await getPool().connect();

  try {
    await beginRls(client, actorUserId);
    await client.query(
      "select pg_advisory_xact_lock(hashtextextended($1, 0))",
      ["icamp-long-term-assignment:" + value.accommodationId],
    );

    const scope = await client.query(
      `select
         a.organization_id,
         a.id,
         a.code,
         a.display_name,
         a.accommodation_kind,
         c.stay_profile
       from public.accommodations a
       left join public.campsites c on c.accommodation_id = a.id
       where a.campground_id = $1
         and a.id = $2
         and a.lifecycle_state = 'active'
         and a.accommodation_kind in ('campsite','permanent_unit')
       limit 1`,
      [campgroundId, value.accommodationId],
    );
    if (scope.rowCount !== 1) {
      throw new Error("Active long-term accommodation was not found.");
    }

    const accommodation = scope.rows[0];
    if (
      accommodation.accommodation_kind === "campsite" &&
      accommodation.stay_profile !== value.assignmentKind
    ) {
      throw new Error(
        "Campsite stay profile must match the long-term assignment kind.",
      );
    }

    const plan = await client.query(
      `select
         id,
         code,
         display_name,
         seasonal_cents,
         yearly_cents,
         currency_code
       from public.rate_plans
       where campground_id = $1
         and id = $2
         and is_active
         and archived_at is null
         and starts_on <= $3::date
         and ends_on >= $4::date
         and (
           accommodation_id = $5
           or (
             accommodation_id is null
             and accommodation_kind = $6
           )
         )
       limit 1`,
      [
        campgroundId,
        value.ratePlanId,
        value.startsOn,
        value.endsOn,
        value.accommodationId,
        accommodation.accommodation_kind,
      ],
    );
    if (plan.rowCount !== 1) {
      throw new Error("Applicable active long-term rate plan was not found.");
    }

    const canonicalAmount = Number(
      value.assignmentKind === "seasonal"
        ? plan.rows[0].seasonal_cents
        : plan.rows[0].yearly_cents,
    );
    if (!Number.isInteger(canonicalAmount) || canonicalAmount < 0) {
      throw new Error("Selected rate plan has no matching long-term charge.");
    }

    const canonicalCurrency = String(plan.rows[0].currency_code);
    if (
      value.chargeAmountCents != null &&
      canonicalAmount !== value.chargeAmountCents
    ) {
      throw new Error(
        "Long-term charge does not match the selected Build 039 rate plan.",
      );
    }
    if (
      value.currencyCode != null &&
      canonicalCurrency !== value.currencyCode
    ) {
      throw new Error(
        "Long-term charge currency does not match the selected rate plan.",
      );
    }

    const inserted = await client.query(
      `insert into public.seasonal_assignments (
         organization_id,
         campground_id,
         accommodation_id,
         starts_on,
         ends_on,
         assignment_state,
         reference,
         created_by_user_id,
         updated_by_user_id,
         assignment_kind,
         occupant_display_name,
         contact_email,
         occupancy_state,
         rate_plan_id,
         charge_amount_cents,
         currency_code,
         charge_due_on,
         notes,
         winterization_required
       )
       values (
         $1,$2,$3,$4,$5,'active',$6,$7,$7,$8,$9,$10,'assigned',
         $11,$12,$13,$14,$15,$16
       )
       returning *`,
      [
        accommodation.organization_id,
        campgroundId,
        value.accommodationId,
        value.startsOn,
        value.endsOn,
        value.reference,
        actorUserId,
        value.assignmentKind,
        value.occupantDisplayName,
        value.contactEmail,
        value.ratePlanId,
        canonicalAmount,
        canonicalCurrency,
        value.chargeDueOn,
        value.notes,
        value.winterizationRequired,
      ],
    );

    await client.query(
      `insert into public.seasonal_assignment_events (
         organization_id,
         campground_id,
         assignment_id,
         event_kind,
         effective_on,
         note,
         actor_user_id,
         source_channel
       )
       values
         ($1,$2,$3,'assigned',$4,$5,$6,$7),
         ($1,$2,$3,'charge_recorded',$8,$9,$6,$7)`,
      [
        accommodation.organization_id,
        campgroundId,
        inserted.rows[0].id,
        value.startsOn,
        value.notes,
        actorUserId,
        channel,
        value.chargeDueOn,
        value.assignmentKind +
          " charge snapshot " +
          canonicalAmount +
          " " +
          canonicalCurrency,
      ],
    );

    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      organizationId: accommodation.organization_id,
      campgroundId,
      actionKey: "seasonal.assignment.create",
      permissionKey: "seasonal.manage",
      riskLevel: "elevated",
      reason: value.notes ?? "Create long-term assignment.",
      subjectType: "seasonal_assignment",
      subjectId: inserted.rows[0].id,
      beforeState: null,
      afterState: {
        accommodationId: value.accommodationId,
        accommodationKind: accommodation.accommodation_kind,
        assignmentKind: value.assignmentKind,
        startsOn: value.startsOn,
        endsOn: value.endsOn,
        ratePlanId: value.ratePlanId,
        chargeAmountCents: canonicalAmount,
        currencyCode: canonicalCurrency,
        winterizationRequired: value.winterizationRequired,
      },
      metadata: {
        sourceChannel: channel,
        availabilityEngine: "build035",
        priceSource: "build039",
      },
    });

    await client.query("commit");
    return {
      ...inserted.rows[0],
      canonicalChargeAmountCents: canonicalAmount,
      canonicalCurrencyCode: canonicalCurrency,
    };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function transitionLongTermAssignment({
  actorUserId,
  campgroundId,
  input,
  sourceChannel = "web",
}) {
  await assertManage(actorUserId, campgroundId);
  const value = normalizeAssignmentTransition(input);
  const channel = normalizeSourceChannel(sourceChannel);
  const client = await getPool().connect();

  try {
    await beginRls(client, actorUserId);
    await client.query(
      "select pg_advisory_xact_lock(hashtextextended($1, 0))",
      ["icamp-long-term-assignment-record:" + value.assignmentId],
    );

    const current = await client.query(
      `select * from public.seasonal_assignments
       where campground_id = $1 and id = $2
       for update`,
      [campgroundId, value.assignmentId],
    );
    if (current.rowCount !== 1) {
      throw new Error("Long-term assignment was not found.");
    }

    const row = current.rows[0];
    if (row.assignment_state !== "active") {
      throw new Error("Only an active long-term assignment can transition.");
    }
    if (
      value.expectedRowVersion != null &&
      Number(row.row_version) !== value.expectedRowVersion
    ) {
      throw new Error(
        "Long-term assignment changed since this page loaded. Refresh and try again.",
      );
    }
    if (
      value.eventKind === "winter_closed" &&
      row.occupancy_state === "winter_closed"
    ) {
      throw new Error("Long-term assignment is already winter closed.");
    }
    if (
      value.eventKind === "reopened" &&
      row.occupancy_state !== "winter_closed"
    ) {
      throw new Error("Only a winter-closed assignment can be reopened.");
    }

    const occupancyState = occupancyStateForEvent(value.eventKind);
    const assignmentState = assignmentStateForEvent(value.eventKind);
    const updated = await client.query(
      `update public.seasonal_assignments
       set occupancy_state = coalesce($3, occupancy_state),
           assignment_state = coalesce($4, assignment_state),
           updated_by_user_id = $5
       where campground_id = $1
         and id = $2
         and ($6::bigint is null or row_version = $6)
       returning *`,
      [
        campgroundId,
        value.assignmentId,
        occupancyState,
        assignmentState,
        actorUserId,
        value.expectedRowVersion,
      ],
    );
    if (updated.rowCount !== 1) {
      throw new Error(
        "Long-term assignment changed since this page loaded. Refresh and try again.",
      );
    }

    await client.query(
      `insert into public.seasonal_assignment_events (
         organization_id,
         campground_id,
         assignment_id,
         event_kind,
         effective_on,
         note,
         actor_user_id,
         source_channel
       )
       values ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        row.organization_id,
        campgroundId,
        value.assignmentId,
        value.eventKind,
        value.effectiveOn,
        value.note,
        actorUserId,
        channel,
      ],
    );

    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      organizationId: row.organization_id,
      campgroundId,
      actionKey: "seasonal.assignment." + value.eventKind,
      permissionKey: "seasonal.manage",
      riskLevel: "elevated",
      reason: value.note ?? "Update long-term assignment lifecycle.",
      subjectType: "seasonal_assignment",
      subjectId: value.assignmentId,
      beforeState: {
        assignmentState: row.assignment_state,
        occupancyState: row.occupancy_state,
        rowVersion: Number(row.row_version),
      },
      afterState: {
        assignmentState: updated.rows[0].assignment_state,
        occupancyState: updated.rows[0].occupancy_state,
        rowVersion: Number(updated.rows[0].row_version),
      },
      metadata: {
        sourceChannel: channel,
        availabilityStillBlocked: updated.rows[0].assignment_state === "active",
      },
    });

    await client.query("commit");
    return updated.rows[0];
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
