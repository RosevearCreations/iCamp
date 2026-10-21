import pg from "pg";

import { appendAuditEvent } from "../audit/postgres.mjs";
import { hasCampgroundPermission } from "../authz/postgres.mjs";
import {
  claimJob,
  completeJob,
  failJob,
  heartbeatWorker,
  runDueSchedules,
  stopWorker,
} from "../jobs/postgres.mjs";
import { validateMaintenanceScheduleInput } from "./core.mjs";

const { Pool } = pg;
let pool;

function databaseUrl() {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) {
    throw new Error(
      "DATABASE_URL is required for recurring maintenance operations.",
    );
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

export async function closeMaintenanceSchedulerPoolForTests() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

async function assertPermission(userId, campgroundId, permission) {
  if (!(await hasCampgroundPermission(userId, campgroundId, permission))) {
    throw new Error(`Not authorized for ${permission}.`);
  }
}

async function assertCanRead(userId, campgroundId) {
  const allowed = await Promise.all(
    ["maintenance.read", "maintenance.schedule"].map((permission) =>
      hasCampgroundPermission(userId, campgroundId, permission),
    ),
  );
  if (!allowed.some(Boolean)) {
    throw new Error("Not authorized to read recurring maintenance schedules.");
  }
}

async function campgroundScope(client, campgroundId) {
  const result = await client.query(
    `select organization_id,id,name,timezone
     from public.campgrounds
     where id=$1 and lifecycle_state <> 'archived'
     limit 1`,
    [campgroundId],
  );
  if (result.rowCount !== 1) {
    throw new Error("Campground is unavailable.");
  }
  return result.rows[0];
}

async function beginRls(client, userId) {
  await client.query("set local role icamp_app");
  await client.query("select set_config('icamp.user_id',$1,true)", [userId]);
}

async function validateTarget(client, campgroundId, table, id) {
  if (!id) return;
  const tables = new Map([
    ["section", "public.campground_sections"],
    ["asset", "public.operational_assets"],
    ["accommodation", "public.accommodations"],
  ]);
  const relation = tables.get(table);
  if (!relation) {
    throw new Error("Unsupported recurring-maintenance target type.");
  }
  const result = await client.query(
    `select 1
     from ${relation}
     where id=$1
       and campground_id=$2
       and lifecycle_state <> 'archived'
     limit 1`,
    [id, campgroundId],
  );
  if (result.rowCount !== 1) {
    throw new Error(`Selected maintenance ${table} is unavailable.`);
  }
}

function mapSchedule(row) {
  return {
    id: row.id,
    categoryId: row.category_id,
    categoryName: row.category_name,
    priorityPolicyId: row.priority_policy_id,
    priorityKey: row.priority_key,
    sectionId: row.section_id ?? null,
    sectionName: row.section_name ?? null,
    assetId: row.asset_id ?? null,
    assetName: row.asset_name ?? null,
    accommodationId: row.accommodation_id ?? null,
    accommodationName: row.accommodation_name ?? null,
    locationDescription: row.location_description ?? null,
    title: row.title,
    description: row.description ?? null,
    recurrenceKind: row.recurrence_kind,
    intervalValue:
      row.interval_value == null ? null : Number(row.interval_value),
    weekday: row.weekday == null ? null : Number(row.weekday),
    monthDay: row.month_day == null ? null : Number(row.month_day),
    seasonMonth: row.season_month == null ? null : Number(row.season_month),
    seasonDay: row.season_day == null ? null : Number(row.season_day),
    firstOccurrenceLocal: row.first_occurrence_local,
    nextOccurrenceAt: row.next_occurrence_at,
    endsAt: row.ends_at ?? null,
    missedAfterMinutes: Number(row.missed_after_minutes),
    catchUpMode: row.catch_up_mode,
    isActive: row.is_active === true,
    rowVersion: Number(row.row_version),
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapOccurrence(row) {
  return {
    id: row.id,
    scheduleId: row.schedule_id,
    scheduleTitle: row.schedule_title,
    scheduledFor: row.scheduled_for,
    state: row.state,
    workOrderId: row.work_order_id ?? null,
    reasonCode: row.reason_code ?? null,
    processedAt: row.processed_at,
    processedByUserId: row.processed_by_user_id ?? null,
  };
}

export async function getRecurringMaintenanceSnapshot(userId, campgroundId) {
  await assertCanRead(userId, campgroundId);
  const client = await getPool().connect();

  try {
    await client.query("begin");
    const campground = await campgroundScope(client, campgroundId);
    const [
      categoryResult,
      priorityResult,
      sectionResult,
      assetResult,
      accommodationResult,
    ] = await Promise.all([
      client.query(
        `select id,category_code,display_name
           from public.maintenance_categories
           where campground_id=$1 and is_active
           order by is_standard desc,display_name`,
        [campgroundId],
      ),
      client.query(
        `select id,priority_key
           from public.maintenance_priority_policies
           where campground_id=$1
           order by priority_key`,
        [campgroundId],
      ),
      client.query(
        `select id,name
           from public.campground_sections
           where campground_id=$1 and lifecycle_state <> 'archived'
           order by sort_order,name`,
        [campgroundId],
      ),
      client.query(
        `select id,display_name
           from public.operational_assets
           where campground_id=$1 and lifecycle_state <> 'archived'
           order by display_name`,
        [campgroundId],
      ),
      client.query(
        `select id,code,display_name
           from public.accommodations
           where campground_id=$1 and lifecycle_state <> 'archived'
           order by code,display_name`,
        [campgroundId],
      ),
    ]);

    await beginRls(client, userId);
    const [scheduleResult, occurrenceResult] = await Promise.all([
      client.query(
        `select
           s.*,
           c.display_name as category_name,
           p.priority_key,
           sec.name as section_name,
           a.display_name as asset_name,
           ac.display_name as accommodation_name
         from public.maintenance_schedules s
         join public.maintenance_categories c on c.id=s.category_id
         join public.maintenance_priority_policies p on p.id=s.priority_policy_id
         left join public.campground_sections sec on sec.id=s.section_id
         left join public.operational_assets a on a.id=s.asset_id
         left join public.accommodations ac on ac.id=s.accommodation_id
         where s.campground_id=$1
         order by s.is_active desc,s.next_occurrence_at,s.title`,
        [campgroundId],
      ),
      client.query(
        `select
           o.*,
           s.title as schedule_title
         from public.maintenance_schedule_occurrences o
         join public.maintenance_schedules s on s.id=o.schedule_id
         where o.campground_id=$1
         order by o.scheduled_for desc
         limit 100`,
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
      generatedAt: new Date().toISOString(),
      categories: categoryResult.rows.map((row) => ({
        id: row.id,
        code: row.category_code,
        name: row.display_name,
      })),
      priorities: priorityResult.rows.map((row) => ({
        id: row.id,
        priorityKey: row.priority_key,
      })),
      sections: sectionResult.rows.map((row) => ({
        id: row.id,
        name: row.name,
      })),
      assets: assetResult.rows.map((row) => ({
        id: row.id,
        name: row.display_name,
      })),
      accommodations: accommodationResult.rows.map((row) => ({
        id: row.id,
        code: row.code,
        name: row.display_name,
      })),
      schedules: scheduleResult.rows.map(mapSchedule),
      occurrences: occurrenceResult.rows.map(mapOccurrence),
    };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function firstOccurrence(client, campground, schedule) {
  const result = await client.query(
    `select
       ($1::timestamp at time zone $2) as first_at,
       extract(dow from $1::timestamp)::integer as dow,
       extract(day from $1::timestamp)::integer as month_day,
       extract(month from $1::timestamp)::integer as month_number`,
    [schedule.firstOccurrenceLocal, campground.timezone],
  );
  const row = result.rows[0];

  if (schedule.recurrenceKind === "weekly" && row.dow !== schedule.weekday) {
    throw new Error(
      "The first occurrence weekday must match the selected weekly weekday.",
    );
  }
  if (
    schedule.recurrenceKind === "monthly" &&
    row.month_day !== schedule.monthDay
  ) {
    throw new Error(
      "The first occurrence day must match the selected monthly day.",
    );
  }
  if (
    schedule.recurrenceKind === "seasonal" &&
    (row.month_number !== schedule.seasonMonth ||
      row.month_day !== schedule.seasonDay)
  ) {
    throw new Error(
      "The first occurrence date must match the selected seasonal month/day.",
    );
  }

  return row.first_at;
}

export async function createMaintenanceSchedule({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  ...input
}) {
  await assertPermission(actorUserId, campgroundId, "maintenance.schedule");
  await assertPermission(actorUserId, campgroundId, "maintenance.create");
  const schedule = validateMaintenanceScheduleInput(input);
  const client = await getPool().connect();

  try {
    await client.query("begin");
    const campground = await campgroundScope(client, campgroundId);
    const [categoryResult, priorityResult] = await Promise.all([
      client.query(
        `select id
         from public.maintenance_categories
         where id=$1 and campground_id=$2 and is_active
         limit 1`,
        [schedule.categoryId, campgroundId],
      ),
      client.query(
        `select id
         from public.maintenance_priority_policies
         where id=$1 and campground_id=$2
         limit 1`,
        [schedule.priorityPolicyId, campgroundId],
      ),
      validateTarget(client, campgroundId, "section", schedule.sectionId),
      validateTarget(client, campgroundId, "asset", schedule.assetId),
      validateTarget(
        client,
        campgroundId,
        "accommodation",
        schedule.accommodationId,
      ),
    ]);
    if (categoryResult.rowCount !== 1) {
      throw new Error("Selected maintenance category is unavailable.");
    }
    if (priorityResult.rowCount !== 1) {
      throw new Error("Selected maintenance priority is unavailable.");
    }

    const firstAt = await firstOccurrence(client, campground, schedule);
    await beginRls(client, actorUserId);
    const inserted = await client.query(
      `insert into public.maintenance_schedules (
         organization_id,campground_id,category_id,priority_policy_id,
         section_id,asset_id,accommodation_id,location_description,
         title,description,recurrence_kind,interval_value,weekday,month_day,
         season_month,season_day,first_occurrence_local,next_occurrence_at,
         missed_after_minutes,catch_up_mode,is_active,
         created_by_user_id,updated_by_user_id
       )
       values (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,
         $17::timestamp,$18,$19,$20,true,$21,$21
       )
       returning *`,
      [
        campground.organization_id,
        campgroundId,
        schedule.categoryId,
        schedule.priorityPolicyId,
        schedule.sectionId,
        schedule.assetId,
        schedule.accommodationId,
        schedule.locationDescription,
        schedule.title,
        schedule.description,
        schedule.recurrenceKind,
        schedule.intervalValue,
        schedule.weekday,
        schedule.monthDay,
        schedule.seasonMonth,
        schedule.seasonDay,
        schedule.firstOccurrenceLocal,
        firstAt,
        schedule.missedAfterMinutes,
        schedule.catchUpMode,
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
      actionKey: "maintenance.schedule.create",
      permissionKey: "maintenance.schedule",
      riskLevel: "elevated",
      subjectType: "maintenance.schedule",
      subjectId: saved.id,
      afterState: {
        recurrenceKind: saved.recurrence_kind,
        nextOccurrenceAt: saved.next_occurrence_at,
        catchUpMode: saved.catch_up_mode,
        missedAfterMinutes: Number(saved.missed_after_minutes),
      },
    });
    await client.query("commit");
    return saved.id;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function setMaintenanceScheduleActive({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  scheduleId,
  isActive,
  expectedRowVersion,
}) {
  await assertPermission(actorUserId, campgroundId, "maintenance.schedule");
  const expected = Number(expectedRowVersion);
  if (!Number.isInteger(expected) || expected < 1) {
    throw new Error("Maintenance schedule row version is invalid.");
  }
  const client = await getPool().connect();

  try {
    await client.query("begin");
    await beginRls(client, actorUserId);
    const beforeResult = await client.query(
      `select *
       from public.maintenance_schedules
       where id=$1 and campground_id=$2
       limit 1
       for update`,
      [scheduleId, campgroundId],
    );
    if (beforeResult.rowCount !== 1) {
      throw new Error("Maintenance schedule is unavailable.");
    }
    const before = beforeResult.rows[0];
    const updated = await client.query(
      `update public.maintenance_schedules
       set is_active=$4,updated_by_user_id=$5
       where id=$1 and campground_id=$2 and row_version=$3
       returning *`,
      [scheduleId, campgroundId, expected, Boolean(isActive), actorUserId],
    );
    if (updated.rowCount !== 1) {
      throw new Error(
        "Maintenance schedule changed since this page loaded. Refresh and try again.",
      );
    }
    const saved = updated.rows[0];

    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: saved.organization_id,
      campgroundId,
      actionKey: isActive
        ? "maintenance.schedule.activate"
        : "maintenance.schedule.deactivate",
      permissionKey: "maintenance.schedule",
      riskLevel: "elevated",
      subjectType: "maintenance.schedule",
      subjectId: scheduleId,
      beforeState: {
        active: before.is_active,
        rowVersion: Number(before.row_version),
      },
      afterState: {
        active: saved.is_active,
        rowVersion: Number(saved.row_version),
      },
    });
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function existingOccurrence(client, scheduleId, scheduledFor) {
  const result = await client.query(
    `select id,state,work_order_id,reason_code,scheduled_for
     from public.maintenance_schedule_occurrences
     where schedule_id=$1 and scheduled_for=$2
     limit 1`,
    [scheduleId, scheduledFor],
  );
  return result.rows[0] ?? null;
}

export async function materializeMaintenanceOccurrence({
  scheduleId,
  scheduledFor,
}) {
  const client = await getPool().connect();

  try {
    await client.query("begin");
    const scheduleResult = await client.query(
      `select
         s.*,
         p.target_response_minutes,
         p.target_completion_minutes
       from public.maintenance_schedules s
       join public.maintenance_priority_policies p
         on p.id=s.priority_policy_id
        and p.campground_id=s.campground_id
       where s.id=$1
       limit 1
       for update of s`,
      [scheduleId],
    );
    if (scheduleResult.rowCount !== 1) {
      throw new Error("Maintenance schedule is unavailable.");
    }
    const schedule = scheduleResult.rows[0];
    const occurrenceTime = new Date(scheduledFor);
    if (Number.isNaN(occurrenceTime.getTime())) {
      throw new Error("Maintenance occurrence timestamp is invalid.");
    }

    const duplicate = await existingOccurrence(
      client,
      scheduleId,
      scheduledFor,
    );
    if (duplicate) {
      await client.query("commit");
      return {
        occurrenceId: duplicate.id,
        state: duplicate.state,
        workOrderId: duplicate.work_order_id ?? null,
        duplicate: true,
      };
    }

    const maySchedule = await hasCampgroundPermission(
      schedule.created_by_user_id,
      schedule.campground_id,
      "maintenance.schedule",
    );
    const mayCreate = await hasCampgroundPermission(
      schedule.created_by_user_id,
      schedule.campground_id,
      "maintenance.create",
    );
    if (!maySchedule || !mayCreate) {
      throw new Error(
        "Recurring-maintenance owner no longer has required maintenance authority.",
      );
    }

    await beginRls(client, schedule.created_by_user_id);
    await client.query(
      "select set_config('icamp.maintenance_scheduler','1',true)",
    );

    const expectedOccurrenceTime = new Date(
      schedule.next_occurrence_at,
    ).getTime();
    const actualOccurrenceTime = occurrenceTime.getTime();
    const stale = actualOccurrenceTime < expectedOccurrenceTime;
    if (actualOccurrenceTime > expectedOccurrenceTime) {
      throw new Error(
        "An earlier recurring-maintenance occurrence is still pending.",
      );
    }
    const isLateResult = await client.query(
      `select statement_timestamp() >
         $1::timestamptz + make_interval(mins => $2::int) as late`,
      [scheduledFor, Number(schedule.missed_after_minutes)],
    );
    const isLate = isLateResult.rows[0]?.late === true;

    let state;
    let reasonCode = null;
    let workOrderId = null;

    if (!schedule.is_active || stale) {
      state = "skipped";
      reasonCode = schedule.is_active
        ? "schedule.stale_occurrence"
        : "schedule.inactive";
    } else if (isLate && schedule.catch_up_mode === "mark_missed") {
      state = "missed";
      reasonCode = "schedule.missed_window";
    } else {
      state = "materialized";
      const insertedWorkOrder = await client.query(
        `insert into public.maintenance_work_orders (
           organization_id,campground_id,category_id,priority_policy_id,
           section_id,asset_id,accommodation_id,location_description,
           title,description,status,response_due_at,completion_due_at,
           created_by_user_id,updated_by_user_id
         )
         values (
           $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'open',
           $11::timestamptz + make_interval(mins => $12::int),
           $11::timestamptz + make_interval(mins => $13::int),
           $14,$14
         )
         returning id`,
        [
          schedule.organization_id,
          schedule.campground_id,
          schedule.category_id,
          schedule.priority_policy_id,
          schedule.section_id,
          schedule.asset_id,
          schedule.accommodation_id,
          schedule.location_description,
          schedule.title,
          schedule.description,
          scheduledFor,
          Number(schedule.target_response_minutes),
          Number(schedule.target_completion_minutes),
          schedule.created_by_user_id,
        ],
      );
      workOrderId = insertedWorkOrder.rows[0].id;
      await client.query(
        `insert into public.maintenance_work_order_status_events (
           organization_id,campground_id,work_order_id,from_status,to_status,
           actor_user_id,note
         )
         values ($1,$2,$3,null,'open',$4,$5)`,
        [
          schedule.organization_id,
          schedule.campground_id,
          workOrderId,
          schedule.created_by_user_id,
          "Recurring maintenance occurrence materialized",
        ],
      );
    }

    const occurrenceResult = await client.query(
      `insert into public.maintenance_schedule_occurrences (
         organization_id,campground_id,schedule_id,scheduled_for,state,
         work_order_id,reason_code,processed_by_user_id
       )
       values ($1,$2,$3,$4,$5,$6,$7,$8)
       returning id`,
      [
        schedule.organization_id,
        schedule.campground_id,
        schedule.id,
        scheduledFor,
        state,
        workOrderId,
        reasonCode,
        schedule.created_by_user_id,
      ],
    );

    if (!stale) {
      const nextResult = await client.query(
        `select icamp_private.next_maintenance_occurrence($1,$2) as next_at`,
        [schedule.id, scheduledFor],
      );
      const nextAt = nextResult.rows[0].next_at;
      const shouldRemainActive =
        schedule.ends_at == null ||
        new Date(nextAt).getTime() <= new Date(schedule.ends_at).getTime();

      await client.query(
        `update public.maintenance_schedules
         set
           next_occurrence_at=$3,
           is_active=$4,
           updated_by_user_id=$5
         where id=$1 and campground_id=$2`,
        [
          schedule.id,
          schedule.campground_id,
          nextAt,
          shouldRemainActive,
          schedule.created_by_user_id,
        ],
      );
    }

    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId: schedule.created_by_user_id,
      organizationId: schedule.organization_id,
      campgroundId: schedule.campground_id,
      actionKey:
        state === "materialized"
          ? "maintenance.schedule.occurrence.materialize"
          : state === "missed"
            ? "maintenance.schedule.occurrence.missed"
            : "maintenance.schedule.occurrence.skip",
      permissionKey: "maintenance.schedule",
      riskLevel: "standard",
      subjectType: "maintenance.schedule",
      subjectId: schedule.id,
      metadata: {
        occurrenceId: occurrenceResult.rows[0].id,
        scheduledFor,
        state,
        workOrderId,
        reasonCode,
      },
    });
    await client.query("commit");

    return {
      occurrenceId: occurrenceResult.rows[0].id,
      state,
      workOrderId,
      duplicate: false,
    };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function processMaintenanceScheduleJob(job) {
  if (job?.jobType !== "maintenance.schedule.materialize") {
    throw new Error("Unsupported recurring-maintenance job type.");
  }
  const scheduleId = String(job?.payload?.maintenanceScheduleId ?? "").trim();
  if (!scheduleId) {
    throw new Error("Recurring-maintenance job is missing its schedule ID.");
  }
  if (!job?.scheduledFor) {
    throw new Error(
      "Recurring-maintenance job is missing its scheduled occurrence timestamp.",
    );
  }
  return materializeMaintenanceOccurrence({
    scheduleId,
    scheduledFor: job.scheduledFor,
  });
}

export async function runMaintenanceSchedulerCycle({
  schedulerId,
  workerId,
  scheduleLimit = 25,
  jobLimit = 25,
} = {}) {
  if (!schedulerId?.trim()) {
    throw new Error("schedulerId is required.");
  }
  if (!workerId?.trim()) {
    throw new Error("workerId is required.");
  }
  if (!Number.isInteger(jobLimit) || jobLimit < 1 || jobLimit > 100) {
    throw new Error("jobLimit must be an integer between 1 and 100.");
  }

  const tick = await runDueSchedules({
    schedulerId,
    limit: scheduleLimit,
  });
  await heartbeatWorker({
    workerId,
    queueName: "maintenance",
    metadata: { handler: "maintenance.schedule.materialize" },
  });

  let claimed = 0;
  let completed = 0;
  let failed = 0;

  try {
    while (claimed < jobLimit) {
      const job = await claimJob({
        workerId,
        queueName: "maintenance",
        leaseSeconds: 60,
      });
      if (!job) break;
      claimed += 1;

      try {
        await processMaintenanceScheduleJob(job);
        const saved = await completeJob({ jobId: job.id, workerId });
        if (!saved) {
          throw new Error("Maintenance job lease expired before completion.");
        }
        completed += 1;
      } catch {
        await failJob({
          jobId: job.id,
          workerId,
          errorCode: "maintenance.schedule.materialize_failed",
          errorSummary: "Recurring maintenance handler failed.",
        });
        failed += 1;
      }
    }
  } finally {
    await stopWorker(workerId);
  }

  return {
    schedulerId,
    workerId,
    dueSchedulesFound: tick.dueSchedulesFound,
    jobsEnqueued: tick.jobsEnqueued,
    jobsClaimed: claimed,
    jobsCompleted: completed,
    jobsFailed: failed,
  };
}
