import pg from "pg";

import { appendAuditEvent } from "../audit/postgres.mjs";
import { hasCampgroundPermission } from "../authz/postgres.mjs";
import { validateFulfillmentUpdate } from "./fulfillment-core.mjs";
import {
  validateExceptionReview,
  validateStaffAssignment,
} from "./fulfillment-staff-core.mjs";

const { Pool } = pg;
let pool;

function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL?.trim();
    if (!connectionString)
      throw new Error("DATABASE_URL is required for fulfillment.");
    pool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
  }
  return pool;
}

async function assertScheduler(userId, campgroundId) {
  if (
    !(await hasCampgroundPermission(userId, campgroundId, "reservation.modify"))
  ) {
    throw new Error(
      "Not authorized to schedule campground reservation services.",
    );
  }
}

async function assertSupervisor(userId, campgroundId) {
  await assertScheduler(userId, campgroundId);
  if (!(await hasCampgroundPermission(userId, campgroundId, "staff.manage"))) {
    throw new Error(
      "Only authorized campground supervisors may assign and review work.",
    );
  }
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

function mapJob(row) {
  return {
    id: row.id,
    reservationReference: String(row.reservation_id).slice(0, 8),
    displayName: row.display_name,
    serviceCode: row.code,
    quantity: Number(row.quantity),
    arrivalDate: dateText(row.arrival_date),
    departureDate: dateText(row.departure_date),
    serviceDate: dateText(row.service_date),
    serviceWindow: row.service_window,
    jobState: row.job_state,
    reservationStatus: row.reservation_status,
    staffNote: row.staff_note ?? "",
    dailyCapacity:
      row.daily_capacity === null ? null : Number(row.daily_capacity),
    rowVersion: Number(row.row_version),
    assignedUserId: row.assigned_user_id ?? null,
    assignmentNote: row.assignment_note ?? "",
    assignmentVersion: Number(row.assignment_version ?? 0),
    reviewHistory: Array.isArray(row.review_history) ? row.review_history : [],
    updatedAt:
      row.updated_at instanceof Date
        ? row.updated_at.toISOString()
        : String(row.updated_at),
  };
}

export async function closeFulfillmentPoolForTests() {
  if (pool) await pool.end();
  pool = undefined;
}

export async function listCampgroundFulfillment({ userId, campgroundId }) {
  await assertScheduler(userId, campgroundId);
  const canManageStaff = await hasCampgroundPermission(
    userId,
    campgroundId,
    "staff.manage",
  );
  const client = await getPool().connect();
  try {
    // Personnel data stays inside the authorized supervisor workspace. The
    // app-role queue query itself never receives private account-table access.
    const roster = canManageStaff
      ? await client.query(
          `select a.user_id, u.email_normalized
           from icamp_private.campground_assignments a
           join icamp_private.user_accounts u on u.id = a.user_id
           where a.campground_id = $1 and a.assignment_state = 'active'
             and a.starts_at <= statement_timestamp()
             and (a.ends_at is null or a.ends_at > statement_timestamp())
             and u.account_type = 'staff' and u.account_state = 'active'
             and exists (
               select 1 from icamp_private.campground_assignment_roles ar
               join icamp_private.roles role on role.id = ar.role_id
                 and role.lifecycle_state = 'active'
               join icamp_private.role_permissions rp on rp.role_id = role.id
               where ar.assignment_id = a.id and rp.permission_key = 'reservation.modify'
             )
           order by u.email_normalized
           limit 501`,
          [campgroundId],
        )
      : { rows: [], rowCount: 0 };
    await beginScoped(client, userId);
    const campground = await client.query(
      "select id, name from public.campgrounds where id = $1 and lifecycle_state = 'active' limit 1",
      [campgroundId],
    );
    if (campground.rowCount !== 1)
      throw new Error("Campground is unavailable.");
    const rows = await client.query(
      `select j.*, r.arrival_date, r.departure_date, r.status as reservation_status,
              l.display_name, l.code, c.daily_capacity,
              a.assigned_user_id, a.assignment_note, a.row_version as assignment_version,
              reviews.review_history
       from public.service_fulfillment_jobs j
       join public.reservations r on r.id = j.reservation_id
         and r.campground_id = j.campground_id
       join public.reservation_charge_lines l on l.id = j.charge_line_id
         and l.campground_id = j.campground_id
       join public.booking_charge_catalog c on c.id = j.charge_catalog_id
         and c.campground_id = j.campground_id
       left join public.service_fulfillment_assignments a on a.job_id = j.id
         and a.campground_id = j.campground_id
       left join lateral (
         select jsonb_agg(jsonb_build_object(
           'state', recent.review_state, 'note', recent.review_note,
           'reviewedAt', recent.reviewed_at
         ) order by recent.reviewed_at desc, recent.id desc) as review_history
         from (
           select er.id, er.review_state, er.review_note, er.reviewed_at
           from public.service_fulfillment_exception_reviews er
           where er.job_id = j.id and er.campground_id = j.campground_id
             and er.blocked_row_version = j.row_version
           order by er.reviewed_at desc, er.id desc limit 3
         ) recent
       ) reviews on j.job_state = 'blocked'
       where j.campground_id = $1
         and r.status in ('pending','confirmed','checked_in')
       order by (j.job_state = 'completed'),
                (j.job_state <> 'blocked'), j.service_date, j.created_at, j.id
       limit 251`,
      [campgroundId],
    );
    const loads = canManageStaff
      ? await client.query(
          `select a.assigned_user_id, count(*)::integer as active_jobs,
                  coalesce(sum(j.quantity), 0)::bigint as units,
                  count(*) filter (where j.job_state = 'blocked')::integer as blocked_jobs
           from public.service_fulfillment_jobs j
           join public.reservations r on r.id = j.reservation_id
             and r.campground_id = j.campground_id
           left join public.service_fulfillment_assignments a on a.job_id = j.id
             and a.campground_id = j.campground_id
           where j.campground_id = $1
             and j.job_state <> 'completed'
             and r.status in ('pending','confirmed','checked_in')
           group by a.assigned_user_id
           order by active_jobs desc, a.assigned_user_id nulls first
           limit 501`,
          [campgroundId],
        )
      : { rows: [] };
    await client.query("commit");
    const staff = roster.rows.slice(0, 500).map((row) => ({
      userId: row.user_id,
      label: row.email_normalized,
    }));
    const labels = new Map(
      staff.map((person) => [person.userId, person.label]),
    );
    return {
      campgroundName: campground.rows[0].name,
      jobs: rows.rows.slice(0, 250).map(mapJob),
      truncated: rows.rows.length > 250,
      canManageStaff,
      staff,
      staffTruncated: roster.rows.length > 500,
      loads: loads.rows.slice(0, 500).map((row) => ({
        assignedUserId: row.assigned_user_id,
        label: row.assigned_user_id
          ? (labels.get(row.assigned_user_id) ?? "Former or unavailable staff")
          : "Unassigned",
        activeJobs: Number(row.active_jobs),
        units: Number(row.units),
        blockedJobs: Number(row.blocked_jobs),
      })),
      loadsTruncated: loads.rows.length > 500,
    };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function assignCampgroundFulfillment({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  jobId,
  assignedUserId,
  assignmentNote,
  expectedAssignmentVersion,
  expectedJobVersion,
}) {
  await assertSupervisor(actorUserId, campgroundId);
  const update = validateStaffAssignment({
    assignedUserId,
    assignmentNote,
    expectedAssignmentVersion,
    expectedJobVersion,
  });
  const client = await getPool().connect();
  try {
    await beginScoped(client, actorUserId);
    const job = await client.query(
      `select j.organization_id, j.row_version, j.job_state,
              a.assigned_user_id, a.assignment_note, a.row_version as assignment_version
       from public.service_fulfillment_jobs j
       left join public.service_fulfillment_assignments a on a.job_id = j.id
       where j.campground_id = $1 and j.id = $2
       for update of j`,
      [campgroundId, jobId],
    );
    if (job.rowCount !== 1 || job.rows[0].job_state === "completed") {
      throw new Error("Only active campground work can be assigned.");
    }
    const before = job.rows[0];
    if (
      Number(before.row_version) !== update.expectedJobVersion ||
      Number(before.assignment_version ?? 0) !==
        update.expectedAssignmentVersion
    ) {
      throw new Error("Work assignment changed. Refresh and retry.");
    }
    if (!update.assignedUserId && !before.assignment_version) {
      throw new Error("This task is already unassigned.");
    }
    if (
      before.assigned_user_id &&
      before.assigned_user_id !== update.assignedUserId &&
      (!update.assignmentNote ||
        update.assignmentNote === (before.assignment_note ?? "").trim())
    ) {
      throw new Error(
        "A new reason is required to reassign or unassign a worker.",
      );
    }
    const saved = before.assignment_version
      ? await client.query(
          `update public.service_fulfillment_assignments
           set assigned_user_id = $3, assignment_note = $4, changed_by_user_id = $5
           where campground_id = $1 and job_id = $2 and row_version = $6
           returning row_version`,
          [
            campgroundId,
            jobId,
            update.assignedUserId,
            update.assignmentNote,
            actorUserId,
            update.expectedAssignmentVersion,
          ],
        )
      : await client.query(
          `insert into public.service_fulfillment_assignments
           (organization_id, campground_id, job_id, assigned_user_id,
            assignment_note, changed_by_user_id)
           values ($1, $2, $3, $4, $5, $6) returning row_version`,
          [
            before.organization_id,
            campgroundId,
            jobId,
            update.assignedUserId,
            update.assignmentNote,
            actorUserId,
          ],
        );
    if (saved.rowCount !== 1)
      throw new Error("Work assignment changed. Refresh and retry.");
    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: before.organization_id,
      campgroundId,
      actionKey: "campground.service_fulfillment.assign",
      permissionKey: "staff.manage",
      subjectType: "service_fulfillment_assignments",
      subjectId: jobId,
      beforeState: {
        assignedUserId: before.assigned_user_id ?? null,
        assignmentNote: before.assignment_note ?? null,
        assignmentVersion: Number(before.assignment_version ?? 0),
      },
      afterState: {
        assignedUserId: update.assignedUserId,
        assignmentNote: update.assignmentNote,
        assignmentVersion: Number(saved.rows[0].row_version),
      },
    });
    await client.query("commit");
    return { id: jobId, assignedUserId: update.assignedUserId };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function reviewCampgroundFulfillmentException({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  jobId,
  expectedJobVersion,
  reviewState,
  reviewNote,
}) {
  await assertSupervisor(actorUserId, campgroundId);
  const review = validateExceptionReview({
    expectedJobVersion,
    reviewState,
    reviewNote,
  });
  const client = await getPool().connect();
  try {
    await beginScoped(client, actorUserId);
    const job = await client.query(
      `select organization_id, row_version, job_state
       from public.service_fulfillment_jobs
       where campground_id = $1 and id = $2 for update`,
      [campgroundId, jobId],
    );
    if (
      job.rowCount !== 1 ||
      job.rows[0].job_state !== "blocked" ||
      Number(job.rows[0].row_version) !== review.expectedJobVersion
    ) {
      throw new Error("This blocker is no longer the current task version.");
    }
    const saved = await client.query(
      `insert into public.service_fulfillment_exception_reviews
       (organization_id, campground_id, job_id, blocked_row_version,
        review_state, review_note, reviewed_by_user_id)
       values ($1, $2, $3, $4, $5, $6, $7) returning id`,
      [
        job.rows[0].organization_id,
        campgroundId,
        jobId,
        review.expectedJobVersion,
        review.reviewState,
        review.reviewNote,
        actorUserId,
      ],
    );
    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: job.rows[0].organization_id,
      campgroundId,
      actionKey: "campground.service_fulfillment.exception_review",
      permissionKey: "staff.manage",
      subjectType: "service_fulfillment_exception_reviews",
      subjectId: saved.rows[0].id,
      afterState: { jobId, ...review },
    });
    await client.query("commit");
    return { id: saved.rows[0].id, state: review.reviewState };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function updateCampgroundFulfillment({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  jobId,
  expectedRowVersion,
  nextState,
  serviceDate,
  serviceWindow,
  staffNote,
}) {
  await assertScheduler(actorUserId, campgroundId);
  if (
    !Number.isSafeInteger(Number(expectedRowVersion)) ||
    Number(expectedRowVersion) < 1
  ) {
    throw new Error("Fulfillment row version is invalid.");
  }
  const client = await getPool().connect();
  try {
    await beginScoped(client, actorUserId);
    const result = await client.query(
      `select j.*, r.arrival_date, r.departure_date, r.status as reservation_status,
              l.display_name, l.code, c.daily_capacity
       from public.service_fulfillment_jobs j
       join public.reservations r on r.id = j.reservation_id
         and r.organization_id = j.organization_id and r.campground_id = j.campground_id
       join public.reservation_charge_lines l on l.id = j.charge_line_id
         and l.campground_id = j.campground_id
       join public.booking_charge_catalog c on c.id = j.charge_catalog_id
         and c.campground_id = j.campground_id
       where j.id = $1 and j.campground_id = $2
         and r.status in ('pending','confirmed','checked_in')
       for update of j`,
      [jobId, campgroundId],
    );
    if (result.rowCount !== 1)
      throw new Error("Fulfillment task is unavailable.");
    const before = mapJob(result.rows[0]);
    if (before.rowVersion !== Number(expectedRowVersion)) {
      throw new Error("Task changed since it was opened. Refresh and retry.");
    }
    const next = validateFulfillmentUpdate({
      currentState: before.jobState,
      nextState,
      serviceDate,
      arrivalDate: before.arrivalDate,
      departureDate: before.departureDate,
      serviceWindow,
      staffNote,
    });
    if (next.nextState === "blocked" && !next.staffNote) {
      throw new Error("Please explain why the service is blocked.");
    }
    const updated = await client.query(
      `update public.service_fulfillment_jobs
       set job_state = $3, service_date = $4::date, service_window = $5,
           staff_note = $6, updated_by_user_id = $7,
           completed_at = case when $3 = 'completed' then statement_timestamp() else null end
       where id = $1 and campground_id = $2 and row_version = $8
       returning *`,
      [
        jobId,
        campgroundId,
        next.nextState,
        next.serviceDate,
        next.serviceWindow,
        next.staffNote,
        actorUserId,
        before.rowVersion,
      ],
    );
    if (updated.rowCount !== 1)
      throw new Error("Task changed. Refresh and retry.");
    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: result.rows[0].organization_id,
      campgroundId,
      actionKey: "campground.service_fulfillment.update",
      permissionKey: "reservation.modify",
      riskLevel: "standard",
      subjectType: "service_fulfillment_jobs",
      subjectId: jobId,
      beforeState: before,
      afterState: {
        ...before,
        ...next,
        jobState: next.nextState,
        rowVersion: Number(updated.rows[0].row_version),
      },
    });
    await client.query("commit");
    return { state: next.nextState, id: jobId };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
