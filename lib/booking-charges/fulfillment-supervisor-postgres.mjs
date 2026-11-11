import pg from "pg";

import { appendAuditEvent } from "../audit/postgres.mjs";
import { hasCampgroundPermission } from "../authz/postgres.mjs";
import {
  validateSavedPriorityView,
  validateCaseOwnership,
  validateMobileFieldReport,
} from "./fulfillment-supervisor-core.mjs";

const { Pool } = pg;
let pool;

function getPool() {
  if (!pool) {
    if (!process.env.DATABASE_URL?.trim()) {
      throw new Error(
        "DATABASE_URL is required for campground fulfillment evidence.",
      );
    }
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 4,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
  }
  return pool;
}

async function assertPermission(userId, campgroundId, permission) {
  if (!(await hasCampgroundPermission(userId, campgroundId, permission))) {
    throw new Error("Campground fulfillment evidence is not authorized.");
  }
}

async function assertSupervisor(userId, campgroundId) {
  await Promise.all([
    assertPermission(userId, campgroundId, "staff.manage"),
    assertPermission(userId, campgroundId, "reservation.modify"),
  ]);
}

async function scoped(client, userId) {
  await client.query("begin");
  await client.query("set local role icamp_app");
  await client.query("select set_config('icamp.user_id', $1, true)", [userId]);
}

async function organizationFor(client, campgroundId) {
  const row = await client.query(
    "select organization_id from public.campgrounds where id = $1",
    [campgroundId],
  );
  if (row.rowCount !== 1) throw new Error("Campground is unavailable.");
  return row.rows[0].organization_id;
}

async function transaction(userId, work) {
  const client = await getPool().connect();
  try {
    await scoped(client, userId);
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

const iso = (value) =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();

/** Only source campground supervisors may inspect private worker reports and case ownership. */
export async function listFulfillmentSupervisorEvidence({
  userId,
  campgroundId,
}) {
  await assertSupervisor(userId, campgroundId);
  return transaction(userId, async (client) => {
    const [saved, owners, mobile] = await Promise.all([
      client.query(
        `select id, label, priority_filter, created_at
         from public.service_fulfillment_priority_saved_views
         where campground_id = $1 and owner_user_id = $2
         order by created_at desc, id desc limit 9`,
        [campgroundId, userId],
      ),
      client.query(
        `with ranked as (
           select e.*, row_number() over (
             partition by e.dispatch_id order by e.recorded_at desc, e.id desc
           ) as history_rank
           from public.service_fulfillment_case_owner_events e
           where e.campground_id = $1
         ) select * from ranked where history_rank = 1
         order by recorded_at desc, id desc limit 751`,
        [campgroundId],
      ),
      client.query(
        `with ranked as (
           select e.*, row_number() over (
             partition by e.dispatch_id order by e.reported_at desc, e.id desc
           ) as history_rank
           from public.service_fulfillment_mobile_field_reports e
           where e.campground_id = $1
         ) select * from ranked where history_rank = 1
         order by reported_at desc, id desc limit 751`,
        [campgroundId],
      ),
    ]);
    return {
      savedViews: saved.rows.slice(0, 8).map((row) => ({
        id: row.id,
        label: row.label,
        filter: row.priority_filter,
        createdAt: iso(row.created_at),
      })),
      ownership: owners.rows.slice(0, 750).map((row) => ({
        id: row.id,
        dispatchId: row.dispatch_id,
        previousEventId: row.previous_event_id,
        claimedByUserId: row.claimed_by_user_id,
        reason: row.reason,
        recordedAt: iso(row.recorded_at),
      })),
      mobile: mobile.rows.slice(0, 750).map((row) => ({
        id: row.id,
        dispatchId: row.dispatch_id,
        reportedByUserId: row.reported_by_user_id,
        deviceKind: row.device_kind,
        outcome: row.outcome,
        observation: row.observation,
        reportedAt: iso(row.reported_at),
      })),
      truncated:
        saved.rows.length > 8 ||
        owners.rows.length > 750 ||
        mobile.rows.length > 750,
    };
  });
}

export async function saveSupervisorPriorityView({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  label,
  filter,
}) {
  await assertSupervisor(actorUserId, campgroundId);
  const view = validateSavedPriorityView({ label, filter });
  return transaction(actorUserId, async (client) => {
    await client.query(
      "select pg_advisory_xact_lock(hashtext($1), hashtext($2))",
      [campgroundId, actorUserId],
    );
    const organizationId = await organizationFor(client, campgroundId);
    const number = await client.query(
      "select count(*)::integer as total from public.service_fulfillment_priority_saved_views where campground_id=$1 and owner_user_id=$2",
      [campgroundId, actorUserId],
    );
    if (number.rows[0].total >= 8)
      throw new Error("Remove a saved view before creating another.");
    const saved = await client.query(
      `insert into public.service_fulfillment_priority_saved_views
       (organization_id,campground_id,owner_user_id,label,priority_filter)
       values ($1,$2,$3,$4,$5) returning id`,
      [organizationId, campgroundId, actorUserId, view.label, view.filter],
    );
    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId,
      campgroundId,
      actionKey: "campground.fulfillment.priority_view_save",
      permissionKey: "staff.manage",
      subjectType: "service_fulfillment_priority_saved_views",
      subjectId: saved.rows[0].id,
      afterState: { label: view.label, filter: view.filter },
    });
    return { id: saved.rows[0].id };
  });
}

export async function removeSupervisorPriorityView({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  viewId,
}) {
  await assertSupervisor(actorUserId, campgroundId);
  if (!/^[0-9a-f-]{36}$/iu.test(String(viewId ?? "")))
    throw new Error("Invalid saved view.");
  return transaction(actorUserId, async (client) => {
    const removed = await client.query(
      `delete from public.service_fulfillment_priority_saved_views
       where id = $1 and campground_id = $2 and owner_user_id = $3
       returning id, organization_id, label`,
      [viewId, campgroundId, actorUserId],
    );
    if (removed.rowCount !== 1) throw new Error("Saved view changed. Refresh.");
    const row = removed.rows[0];
    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: row.organization_id,
      campgroundId,
      actionKey: "campground.fulfillment.priority_view_remove",
      permissionKey: "staff.manage",
      subjectType: "service_fulfillment_priority_saved_views",
      subjectId: row.id,
      afterState: { removed: true, label: row.label },
    });
    return { id: row.id };
  });
}

export async function recordSupervisorCaseOwnership({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  ...input
}) {
  await assertSupervisor(actorUserId, campgroundId);
  const ownership = validateCaseOwnership(input);
  return transaction(actorUserId, async (client) => {
    const dispatch = await client.query(
      "select organization_id from public.service_fulfillment_dispatches where campground_id=$1 and id=$2",
      [campgroundId, ownership.dispatchId],
    );
    if (dispatch.rowCount !== 1) throw new Error("Dispatch is unavailable.");
    const organizationId = dispatch.rows[0].organization_id;
    const assigned = ownership.intent === "claim" ? actorUserId : null;
    const saved = await client.query(
      `insert into public.service_fulfillment_case_owner_events
       (organization_id,campground_id,dispatch_id,previous_event_id,
        claimed_by_user_id,changed_by_user_id,reason)
       values ($1,$2,$3,$4,$5,$6,$7) returning id`,
      [
        organizationId,
        campgroundId,
        ownership.dispatchId,
        ownership.previousEventId,
        assigned,
        actorUserId,
        ownership.note,
      ],
    );
    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId,
      campgroundId,
      actionKey: "campground.fulfillment.case_owner_event",
      permissionKey: "staff.manage",
      subjectType: "service_fulfillment_case_owner_events",
      subjectId: saved.rows[0].id,
      afterState: {
        dispatchId: ownership.dispatchId,
        intent: ownership.intent,
        previousEventId: ownership.previousEventId,
      },
    });
    return { id: saved.rows[0].id };
  });
}

export async function recordWorkerMobileFieldReport({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  ...input
}) {
  await assertPermission(actorUserId, campgroundId, "reservation.modify");
  const report = validateMobileFieldReport(input);
  return transaction(actorUserId, async (client) => {
    const dispatch = await client.query(
      `select organization_id from public.service_fulfillment_dispatches
       where campground_id=$1 and id=$2 and assigned_user_id=$3`,
      [campgroundId, report.dispatchId, actorUserId],
    );
    if (dispatch.rowCount !== 1)
      throw new Error("This dispatch is not assigned to you.");
    const organizationId = dispatch.rows[0].organization_id;
    const saved = await client.query(
      `insert into public.service_fulfillment_mobile_field_reports
       (organization_id,campground_id,dispatch_id,reported_by_user_id,
        device_kind,outcome,observation)
       values ($1,$2,$3,$4,$5,$6,$7) returning id`,
      [
        organizationId,
        campgroundId,
        report.dispatchId,
        actorUserId,
        report.deviceKind,
        report.outcome,
        report.note,
      ],
    );
    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId,
      campgroundId,
      actionKey: "campground.fulfillment.worker_mobile_field_report",
      permissionKey: "reservation.modify",
      subjectType: "service_fulfillment_mobile_field_reports",
      subjectId: saved.rows[0].id,
      afterState: {
        dispatchId: report.dispatchId,
        deviceKind: report.deviceKind,
        outcome: report.outcome,
        hasObservation: true,
        acceptance: "UNVERIFIED_HOLD",
      },
    });
    return { id: saved.rows[0].id };
  });
}
