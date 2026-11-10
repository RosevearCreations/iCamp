import pg from "pg";

import { appendAuditEvent } from "../audit/postgres.mjs";
import { hasCampgroundPermission } from "../authz/postgres.mjs";
import {
  classifyFulfillmentDispatch,
  validateDispatchHandoff,
  validateWorkerDispatchAcknowledgement,
} from "./fulfillment-dispatch-core.mjs";

const { Pool } = pg;
let pool;

function getPool() {
  if (!pool) {
    if (!process.env.DATABASE_URL?.trim()) {
      throw new Error("DATABASE_URL is required for campground dispatch.");
    }
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
  }
  return pool;
}

export async function closeDispatchPoolForTests() {
  if (pool) await pool.end();
  pool = undefined;
}

async function assertPermission(userId, campgroundId, permission) {
  if (!(await hasCampgroundPermission(userId, campgroundId, permission))) {
    throw new Error("Campground dispatch access is not authorized.");
  }
}

async function beginScoped(client, userId) {
  await client.query("begin");
  await client.query("set local role icamp_app");
  await client.query("select set_config('icamp.user_id', $1, true)", [userId]);
}

function iso(value) {
  if (value === null || value === undefined) return null;
  return value instanceof Date
    ? value.toISOString()
    : new Date(value).toISOString();
}

function mapDispatch(row) {
  return {
    id: row.id,
    jobId: row.job_id,
    assignedUserId: row.assigned_user_id,
    assignmentVersion: Number(row.assignment_row_version),
    jobVersion: Number(row.job_row_version),
    dispatchedAt: iso(row.dispatched_at),
    acknowledgementDueAt: iso(row.acknowledgement_due_at),
    completionDueAt: iso(row.completion_due_at),
    response: row.response ?? null,
    responseNote: row.response_note ?? null,
    acknowledgedAt: iso(row.recorded_at),
    completedAt: iso(row.completed_at),
  };
}

/** Supervisors see campground handoffs; workers see only their own receipts.
 * RLS enforces this independently from this application permission check.
 */
export async function listCampgroundDispatchEvidence({ userId, campgroundId }) {
  await assertPermission(userId, campgroundId, "reservation.modify");
  const client = await getPool().connect();
  try {
    await beginScoped(client, userId);
    const result = await client.query(
      `with ranked as (
         select d.*,
           row_number() over (partition by d.job_id
             order by d.dispatched_at desc, d.id desc) as history_rank
         from public.service_fulfillment_dispatches d
         where d.campground_id = $1
       )
       select d.*, ack.response, ack.response_note, ack.recorded_at,
              j.job_state, j.row_version as current_job_version,
              j.completed_at, a.assigned_user_id as current_assigned_user_id,
              a.row_version as current_assignment_version,
              statement_timestamp() as observed_at
       from ranked d
       join public.service_fulfillment_jobs j on j.id = d.job_id
         and j.organization_id = d.organization_id and j.campground_id = d.campground_id
       left join public.service_fulfillment_assignments a on a.job_id = j.id
         and a.organization_id = j.organization_id and a.campground_id = j.campground_id
       left join public.service_fulfillment_dispatch_acknowledgements ack
         on ack.dispatch_id = d.id and ack.organization_id = d.organization_id
         and ack.campground_id = d.campground_id
       where d.history_rank <= 3
       order by d.dispatched_at desc, d.id desc
       limit 751`,
      [campgroundId],
    );
    await client.query("commit");
    return {
      truncated: result.rows.length > 750,
      entries: result.rows.slice(0, 750).map((row) => {
        const dispatch = mapDispatch(row);
        return {
          dispatch,
          classification: classifyFulfillmentDispatch({
            currentJobVersion: Number(row.current_job_version),
            currentAssignmentVersion: Number(
              row.current_assignment_version ?? 0,
            ),
            currentAssignedUserId: row.current_assigned_user_id ?? null,
            jobState: row.job_state,
            dispatch,
            isLatest: Number(row.history_rank) === 1,
            now: iso(row.observed_at),
          }),
        };
      }),
    };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function dispatchCampgroundFulfillment({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  ...input
}) {
  await Promise.all([
    assertPermission(actorUserId, campgroundId, "reservation.modify"),
    assertPermission(actorUserId, campgroundId, "staff.manage"),
  ]);
  const proposed = validateDispatchHandoff(input);
  const client = await getPool().connect();
  try {
    await beginScoped(client, actorUserId);
    const current = await client.query(
      `select j.organization_id, j.job_state, j.row_version as job_version,
              a.assigned_user_id, a.row_version as assignment_version
       from public.service_fulfillment_jobs j
       join public.reservations r on r.id = j.reservation_id
         and r.campground_id = j.campground_id and r.organization_id = j.organization_id
       join public.service_fulfillment_assignments a on a.job_id = j.id
         and a.organization_id = j.organization_id and a.campground_id = j.campground_id
       where j.id = $1 and j.campground_id = $2
         and r.status in ('pending','confirmed','checked_in')
       for share of j, a`,
      [proposed.jobId, campgroundId],
    );
    const row = current.rows[0];
    if (
      current.rowCount !== 1 ||
      !["scheduled", "in_progress"].includes(row.job_state) ||
      row.assigned_user_id !== proposed.assignedUserId ||
      Number(row.job_version) !== proposed.expectedJobVersion ||
      Number(row.assignment_version) !== proposed.expectedAssignmentVersion
    ) {
      throw new Error("Dispatch changed. Refresh current assigned work.");
    }
    const saved = await client.query(
      `insert into public.service_fulfillment_dispatches
       (organization_id, campground_id, job_id, assigned_user_id,
        assignment_row_version, job_row_version, dispatched_by_user_id,
        acknowledgement_minutes, acknowledgement_due_at, completion_due_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,statement_timestamp(),$9::timestamptz)
       returning id, dispatched_at, acknowledgement_due_at, completion_due_at`,
      [
        row.organization_id,
        campgroundId,
        proposed.jobId,
        proposed.assignedUserId,
        proposed.expectedAssignmentVersion,
        proposed.expectedJobVersion,
        actorUserId,
        proposed.acknowledgementMinutes,
        proposed.completionDueAt,
      ],
    );
    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: row.organization_id,
      campgroundId,
      actionKey: "campground.service_fulfillment.dispatch",
      permissionKey: "staff.manage",
      subjectType: "service_fulfillment_dispatches",
      subjectId: saved.rows[0].id,
      afterState: {
        jobId: proposed.jobId,
        assignmentVersion: proposed.expectedAssignmentVersion,
        jobVersion: proposed.expectedJobVersion,
        acknowledgementMinutes: proposed.acknowledgementMinutes,
        completionDueAt: iso(saved.rows[0].completion_due_at),
      },
    });
    await client.query("commit");
    return { id: saved.rows[0].id };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function acknowledgeCampgroundDispatch({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  ...input
}) {
  await assertPermission(actorUserId, campgroundId, "reservation.modify");
  const acknowledgement = validateWorkerDispatchAcknowledgement(input);
  const client = await getPool().connect();
  try {
    await beginScoped(client, actorUserId);
    const dispatch = await client.query(
      `select id, organization_id, job_id, assigned_user_id
       from public.service_fulfillment_dispatches
       where id = $1 and campground_id = $2 for share`,
      [acknowledgement.dispatchId, campgroundId],
    );
    if (
      dispatch.rowCount !== 1 ||
      dispatch.rows[0].assigned_user_id !== actorUserId
    ) {
      throw new Error("Only the assigned worker may acknowledge this handoff.");
    }
    const saved = await client.query(
      `insert into public.service_fulfillment_dispatch_acknowledgements
       (organization_id, campground_id, dispatch_id, acknowledged_by_user_id,
        response, response_note)
       values ($1,$2,$3,$4,$5,$6) returning id, recorded_at`,
      [
        dispatch.rows[0].organization_id,
        campgroundId,
        acknowledgement.dispatchId,
        actorUserId,
        acknowledgement.response,
        acknowledgement.note,
      ],
    );
    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: dispatch.rows[0].organization_id,
      campgroundId,
      actionKey: "campground.service_fulfillment.worker_acknowledge",
      permissionKey: "reservation.modify",
      subjectType: "service_fulfillment_dispatch_acknowledgements",
      subjectId: saved.rows[0].id,
      afterState: {
        dispatchId: acknowledgement.dispatchId,
        response: acknowledgement.response,
        recordedAt: iso(saved.rows[0].recorded_at),
      },
    });
    await client.query("commit");
    return { id: saved.rows[0].id, response: acknowledgement.response };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
