import pg from "pg";

import { appendAuditEvent } from "../audit/postgres.mjs";
import { hasCampgroundPermission } from "../authz/postgres.mjs";
import {
  classifyFulfillmentDispatch,
  validateDispatchHandoff,
  validateWorkerDispatchAcknowledgement,
} from "./fulfillment-dispatch-core.mjs";
import {
  validateInboxPage,
  validateSlaFollowup,
} from "./fulfillment-followup-core.mjs";

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

/** Campground supervisors alone can inspect assignment-change history and
 * SLA review notes. Neither appears in the Master Shell or worker inbox.
 */
export async function listCampgroundSlaFollowups({ userId, campgroundId }) {
  await Promise.all([
    assertPermission(userId, campgroundId, "reservation.modify"),
    assertPermission(userId, campgroundId, "staff.manage"),
  ]);
  const client = await getPool().connect();
  try {
    await beginScoped(client, userId);
    const transitions = await client.query(
      `with ranked as (
         select e.*,
           row_number() over (partition by e.job_id
             order by e.recorded_at desc, e.id desc) as history_rank
         from public.service_fulfillment_assignment_transitions e
         where e.campground_id = $1
       )
       select * from ranked where history_rank <= 5
       order by recorded_at desc, id desc limit 751`,
      [campgroundId],
    );
    const followups = await client.query(
      `with ranked as (
         select f.*,
           row_number() over (partition by f.dispatch_id
             order by f.reviewed_at desc, f.id desc) as history_rank
         from public.service_fulfillment_sla_followups f
         where f.campground_id = $1
       )
       select * from ranked where history_rank <= 5
       order by reviewed_at desc, id desc limit 751`,
      [campgroundId],
    );
    await client.query("commit");
    return {
      truncated: transitions.rows.length > 750 || followups.rows.length > 750,
      transitions: transitions.rows.slice(0, 750).map((row) => ({
        id: row.id,
        jobId: row.job_id,
        previousUserId: row.previous_user_id,
        assignedUserId: row.assigned_user_id,
        assignmentVersion: Number(row.assignment_row_version),
        reason: row.transition_reason,
        recordedAt: iso(row.recorded_at),
      })),
      followups: followups.rows.slice(0, 750).map((row) => ({
        id: row.id,
        dispatchId: row.dispatch_id,
        previousReviewId: row.previous_review_id,
        state: row.review_state,
        note: row.review_note,
        signals: row.exception_signals,
        reviewedAt: iso(row.reviewed_at),
      })),
    };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function recordCampgroundSlaFollowup({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  ...input
}) {
  await Promise.all([
    assertPermission(actorUserId, campgroundId, "reservation.modify"),
    assertPermission(actorUserId, campgroundId, "staff.manage"),
  ]);
  const review = validateSlaFollowup(input);
  const client = await getPool().connect();
  try {
    await beginScoped(client, actorUserId);
    const dispatch = await client.query(
      `select organization_id from public.service_fulfillment_dispatches
       where campground_id = $1 and id = $2`,
      [campgroundId, review.dispatchId],
    );
    if (dispatch.rowCount !== 1)
      throw new Error("Campground dispatch is not available.");
    const saved = await client.query(
      `insert into public.service_fulfillment_sla_followups
       (organization_id, campground_id, dispatch_id, previous_review_id,
        review_state, review_note, reviewed_by_user_id)
       values ($1,$2,$3,$4,$5,$6,$7)
       returning id, reviewed_at, exception_signals`,
      [
        dispatch.rows[0].organization_id,
        campgroundId,
        review.dispatchId,
        review.previousReviewId,
        review.reviewState,
        review.reviewNote,
        actorUserId,
      ],
    );
    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: dispatch.rows[0].organization_id,
      campgroundId,
      actionKey: "campground.service_fulfillment.sla_followup",
      permissionKey: "staff.manage",
      subjectType: "service_fulfillment_sla_followups",
      subjectId: saved.rows[0].id,
      afterState: {
        dispatchId: review.dispatchId,
        previousReviewId: review.previousReviewId,
        state: review.reviewState,
        signals: saved.rows[0].exception_signals,
        reviewedAt: iso(saved.rows[0].reviewed_at),
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

/** A private, paginated dispatch read model: no guest PII, no other workers'
 * assignments and no ability to mutate work just by loading the inbox.
 */
export async function listWorkerFulfillmentInbox({
  userId,
  campgroundId,
  page,
}) {
  await assertPermission(userId, campgroundId, "reservation.modify");
  const selectedPage = validateInboxPage(page);
  const client = await getPool().connect();
  try {
    await beginScoped(client, userId);
    const rows = await client.query(
      `with worker_dispatches as (
         select d.*,
           row_number() over (partition by d.job_id
             order by d.dispatched_at desc, d.id desc) as history_rank
         from public.service_fulfillment_dispatches d
         where d.campground_id = $1 and d.assigned_user_id = $2
       )
       select d.*, ack.response, ack.response_note, ack.recorded_at,
              j.job_state, j.row_version as current_job_version,
              j.completed_at, j.service_date, j.service_window,
              r.id as reservation_id, r.status as reservation_status,
              l.display_name, l.quantity,
              a.assigned_user_id as current_assigned_user_id,
              a.row_version as current_assignment_version,
              statement_timestamp() as observed_at
       from worker_dispatches d
       join public.service_fulfillment_jobs j on j.id = d.job_id
         and j.organization_id = d.organization_id and j.campground_id = d.campground_id
       join public.reservations r on r.id = j.reservation_id
         and r.organization_id = j.organization_id and r.campground_id = j.campground_id
       join public.reservation_charge_lines l on l.id = j.charge_line_id
         and l.organization_id = j.organization_id and l.campground_id = j.campground_id
       left join public.service_fulfillment_assignments a on a.job_id = j.id
         and a.organization_id = j.organization_id and a.campground_id = j.campground_id
       left join public.service_fulfillment_dispatch_acknowledgements ack
         on ack.dispatch_id = d.id and ack.organization_id = d.organization_id
         and ack.campground_id = d.campground_id
       where r.status in ('pending','confirmed','checked_in')
       order by (j.job_state = 'completed'),
                (a.assigned_user_id is distinct from d.assigned_user_id
                  or a.row_version is distinct from d.assignment_row_version
                  or j.row_version is distinct from d.job_row_version),
                (ack.response is not null),
                d.acknowledgement_due_at, d.dispatched_at desc, d.id desc
       limit 21 offset $3`,
      [campgroundId, userId, (selectedPage - 1) * 20],
    );
    await client.query("commit");
    return {
      page: selectedPage,
      hasNext: rows.rows.length > 20,
      entries: rows.rows.slice(0, 20).map((row) => {
        const dispatch = mapDispatch(row);
        return {
          dispatch,
          serviceName: row.display_name,
          quantity: Number(row.quantity),
          serviceDate:
            row.service_date instanceof Date
              ? row.service_date.toISOString().slice(0, 10)
              : String(row.service_date).slice(0, 10),
          serviceWindow: row.service_window,
          reservationReference: String(row.reservation_id).slice(0, 8),
          classification: classifyFulfillmentDispatch({
            currentJobVersion: Number(row.current_job_version),
            currentAssignmentVersion: Number(
              row.current_assignment_version ?? 0,
            ),
            currentAssignedUserId: row.current_assigned_user_id,
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
