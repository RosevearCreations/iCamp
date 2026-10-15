import pg from "pg";

import { hasCampgroundPermission } from "../authz/postgres.mjs";
import {
  assignmentStateForEvent,
  normalizeAssignmentTransition,
  normalizeLongTermAssignment,
  occupancyStateForEvent,
} from "./core.mjs";

const { Pool } = pg;
let pool;

function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL?.trim();
    if (!connectionString)\n      throw new Error("DATABASE_URL is required for long-term assignments.");
    pool = new Pool({\n      connectionString,\n      max: 5,\n      idleTimeoutMillis: 30000,\n      connectionTimeoutMillis: 5000,\n    });
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
  if (\n    !(await hasCampgroundPermission(\n      userId,\n      campgroundId,\n      "campground.operations.manage",\n    ))\n  ) {
    throw new Error("Not authorized to manage long-term assignments.");
  }
}

async function beginRls(client, userId) {
  await client.query("begin");
  await client.query("set local role icamp_app");
  await client.query("select set_config('icamp.user_id', $1, true)", [userId]);
}

export async function listLongTermAssignments({ userId, campgroundId }) {
  const mayRead =
    (await hasCampgroundPermission(userId, campgroundId, "reservation.read")) ||
    (await hasCampgroundPermission(\n      userId,\n      campgroundId,\n      "campground.operations.manage",\n    ));
  if (!mayRead)\n    throw new Error("Not authorized to read long-term assignments.");

  const client = await getPool().connect();
  try {
    await beginRls(client, userId);
    const result = await client.query(
      `select s.*, a.code accommodation_code, a.display_name accommodation_name
       from public.seasonal_assignments s
       join public.accommodations a on a.id=s.accommodation_id
       where s.campground_id=$1
       order by s.assignment_state='active' desc, s.starts_on desc, a.code`,
      [campgroundId],
    );
    await client.query("commit");
    return result.rows;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function createLongTermAssignment({\n  actorUserId,\n  campgroundId,\n  input,\n}) {
  await assertManage(actorUserId, campgroundId);
  const value = normalizeLongTermAssignment(input);
  const client = await getPool().connect();

  try {
    await beginRls(client, actorUserId);

    const scope = await client.query(
      `select a.organization_id, a.id, c.stay_profile
       from public.accommodations a
       join public.campsites c on c.accommodation_id=a.id
       where a.campground_id=$1 and a.id=$2 and a.lifecycle_state='active'
       limit 1`,
      [campgroundId, value.accommodationId],
    );
    if (scope.rowCount !== 1) throw new Error("Active campsite was not found.");
    if (scope.rows[0].stay_profile !== value.assignmentKind) {
      throw new Error("Campsite stay profile must match the long-term assignment kind.");
    }

    const plan = await client.query(
      `select id, seasonal_cents, yearly_cents, currency_code
       from public.rate_plans
       where campground_id=$1 and id=$2 and is_active
         and starts_on <= $3::date and ends_on >= $4::date
         and (accommodation_id=$5 or (accommodation_id is null and accommodation_kind='campsite'))
       limit 1`,
      [\n        campgroundId,\n        value.ratePlanId,\n        value.startsOn,\n        value.endsOn,\n        value.accommodationId,\n      ],
    );
    if (plan.rowCount !== 1)\n      throw new Error("Applicable active long-term rate plan was not found.");

    const canonicalAmount =
      value.assignmentKind === "seasonal"
        ? plan.rows[0].seasonal_cents
        : plan.rows[0].yearly_cents;
    if (canonicalAmount == null)\n      throw new Error("Selected rate plan has no matching long-term charge.");
    if (Number(canonicalAmount) !== value.chargeAmountCents) {
      throw new Error(\n        "Long-term charge does not match the selected Build 039 rate plan.",\n      );
    }
    if (plan.rows[0].currency_code !== value.currencyCode) {
      throw new Error(\n        "Long-term charge currency does not match the selected rate plan.",\n      );
    }

    const inserted = await client.query(
      `insert into public.seasonal_assignments (
         organization_id,campground_id,accommodation_id,starts_on,ends_on,
         assignment_state,reference,created_by_user_id,updated_by_user_id,
         assignment_kind,occupant_display_name,contact_email,occupancy_state,
         rate_plan_id,charge_amount_cents,currency_code,charge_due_on,notes
       ) values ($1,$2,$3,$4,$5,'active',$6,$7,$7,$8,$9,$10,'assigned',$11,$12,$13,$14,$15)
       returning *`,
      [
        scope.rows[0].organization_id,
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
        value.chargeAmountCents,
        value.currencyCode,
        value.chargeDueOn,
        value.notes,
      ],
    );

    await client.query(
      `insert into public.seasonal_assignment_events
       (organization_id,campground_id,assignment_id,event_kind,effective_on,note,actor_user_id)
       values ($1,$2,$3,'assigned',$4,$5,$6),($1,$2,$3,'charge_recorded',$7,$8,$6)`,
      [
        scope.rows[0].organization_id,
        campgroundId,
        inserted.rows[0].id,
        value.startsOn,
        value.notes,
        actorUserId,
        value.chargeDueOn,
        value.assignmentKind +\n          " charge snapshot " +\n          value.chargeAmountCents +\n          " " +\n          value.currencyCode,
      ],
    );

    await client.query("commit");
    return inserted.rows[0];
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function transitionLongTermAssignment({\n  actorUserId,\n  campgroundId,\n  input,\n}) {
  await assertManage(actorUserId, campgroundId);
  const value = normalizeAssignmentTransition(input);
  const client = await getPool().connect();

  try {
    await beginRls(client, actorUserId);
    const current = await client.query(
      `select * from public.seasonal_assignments
       where campground_id=$1 and id=$2
       for update`,
      [campgroundId, value.assignmentId],
    );
    if (current.rowCount !== 1)\n      throw new Error("Long-term assignment was not found.");
    if (current.rows[0].assignment_state !== "active") {
      throw new Error("Only an active long-term assignment can transition.");
    }

    const occupancyState = occupancyStateForEvent(value.eventKind);
    const assignmentState = assignmentStateForEvent(value.eventKind);
    const updated = await client.query(
      `update public.seasonal_assignments
       set occupancy_state=coalesce($3,occupancy_state),
           assignment_state=coalesce($4,assignment_state),
           updated_by_user_id=$5
       where campground_id=$1 and id=$2
       returning *`,
      [\n        campgroundId,\n        value.assignmentId,\n        occupancyState,\n        assignmentState,\n        actorUserId,\n      ],
    );

    await client.query(
      `insert into public.seasonal_assignment_events
       (organization_id,campground_id,assignment_id,event_kind,effective_on,note,actor_user_id)
       values ($1,$2,$3,$4,$5,$6,$7)`,
      [
        current.rows[0].organization_id,
        campgroundId,
        value.assignmentId,
        value.eventKind,
        value.effectiveOn,
        value.note,
        actorUserId,
      ],
    );
    await client.query("commit");
    return updated.rows[0];
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
