import pg from "pg";

const { Pool } = pg;

const DEFAULT_QUEUE = "default";
const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_RETRY_BASE_SECONDS = 30;
const MAX_RETRY_DELAY_SECONDS = 3600;

let pool;

function databaseUrl() {
  const value = process.env.DATABASE_URL?.trim();

  if (!value) {
    throw new Error("DATABASE_URL is required for background job operations.");
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

function assertIntegerInRange(value, name, minimum, maximum) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(name + " must be an integer between " + minimum + " and " + maximum + ".");
  }
}

function toIso(value) {
  return value ? new Date(value).toISOString() : null;
}

function normalizeJob(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    queueName: row.queue_name,
    jobType: row.job_type,
    idempotencyKey: row.idempotency_key,
    scheduleId: row.schedule_id,
    organizationId: row.organization_id,
    campgroundId: row.campground_id,
    payload: row.payload,
    priority: row.priority,
    state: row.state,
    scheduledFor: toIso(row.scheduled_for),
    availableAt: toIso(row.available_at),
    attemptCount: row.attempt_count,
    maxAttempts: row.max_attempts,
    retryBaseSeconds: row.retry_base_seconds,
    leaseOwner: row.lease_owner,
    leaseExpiresAt: toIso(row.lease_expires_at),
    lastHeartbeatAt: toIso(row.last_heartbeat_at),
    lastErrorCode: row.last_error_code,
    lastErrorSummary: row.last_error_summary,
    completedAt: toIso(row.completed_at),
    deadLetteredAt: toIso(row.dead_lettered_at),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

async function enqueueWithClient(client, {
  queueName = DEFAULT_QUEUE,
  jobType,
  idempotencyKey = null,
  scheduleId = null,
  organizationId = null,
  campgroundId = null,
  payload = {},
  priority = 0,
  scheduledFor = null,
  availableAt = null,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  retryBaseSeconds = DEFAULT_RETRY_BASE_SECONDS,
}) {
  assertIntegerInRange(maxAttempts, "maxAttempts", 1, 25);
  assertIntegerInRange(retryBaseSeconds, "retryBaseSeconds", 1, 86400);
  assertIntegerInRange(priority, "priority", -100, 100);

  const result = await client.query(
    `insert into icamp_private.job_queue (
       queue_name,
       job_type,
       idempotency_key,
       schedule_id,
       organization_id,
       campground_id,
       payload,
       priority,
       scheduled_for,
       available_at,
       max_attempts,
       retry_base_seconds
     )
     values (
       $1, $2, $3, $4, $5, $6, $7::jsonb, $8,
       coalesce($9::timestamptz, statement_timestamp()),
       coalesce($10::timestamptz, statement_timestamp()),
       $11, $12
     )
     on conflict (queue_name, idempotency_key)
       where idempotency_key is not null
     do update set
       idempotency_key = excluded.idempotency_key
     returning *`,
    [
      queueName,
      jobType,
      idempotencyKey,
      scheduleId,
      organizationId,
      campgroundId,
      JSON.stringify(payload),
      priority,
      scheduledFor,
      availableAt,
      maxAttempts,
      retryBaseSeconds,
    ],
  );

  return normalizeJob(result.rows[0]);
}

export function retryDelaySeconds(attemptNumber, baseSeconds = DEFAULT_RETRY_BASE_SECONDS) {
  assertIntegerInRange(attemptNumber, "attemptNumber", 1, 25);
  assertIntegerInRange(baseSeconds, "baseSeconds", 1, 86400);

  return Math.min(
    baseSeconds * 2 ** Math.max(attemptNumber - 1, 0),
    MAX_RETRY_DELAY_SECONDS,
  );
}

export async function closeJobPoolForTests() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

export async function enqueueJob(input) {
  return enqueueWithClient(getPool(), input);
}

export async function registerSchedule({
  scheduleKey,
  queueName = DEFAULT_QUEUE,
  jobType,
  organizationId = null,
  campgroundId = null,
  payload = {},
  cadenceSeconds,
  nextRunAt,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  retryBaseSeconds = DEFAULT_RETRY_BASE_SECONDS,
  active = true,
}) {
  assertIntegerInRange(cadenceSeconds, "cadenceSeconds", 60, 31536000);
  assertIntegerInRange(maxAttempts, "maxAttempts", 1, 25);
  assertIntegerInRange(retryBaseSeconds, "retryBaseSeconds", 1, 86400);

  const result = await getPool().query(
    `insert into icamp_private.job_schedules (
       schedule_key,
       queue_name,
       job_type,
       organization_id,
       campground_id,
       payload,
       cadence_seconds,
       next_run_at,
       max_attempts,
       retry_base_seconds,
       active
     )
     values ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11)
     on conflict (schedule_key)
     do update set
       queue_name = excluded.queue_name,
       job_type = excluded.job_type,
       organization_id = excluded.organization_id,
       campground_id = excluded.campground_id,
       payload = excluded.payload,
       cadence_seconds = excluded.cadence_seconds,
       next_run_at = excluded.next_run_at,
       max_attempts = excluded.max_attempts,
       retry_base_seconds = excluded.retry_base_seconds,
       active = excluded.active,
       updated_at = statement_timestamp()
     returning *`,
    [
      scheduleKey,
      queueName,
      jobType,
      organizationId,
      campgroundId,
      JSON.stringify(payload),
      cadenceSeconds,
      nextRunAt,
      maxAttempts,
      retryBaseSeconds,
      active,
    ],
  );

  const row = result.rows[0];

  return {
    id: row.id,
    scheduleKey: row.schedule_key,
    queueName: row.queue_name,
    jobType: row.job_type,
    cadenceSeconds: row.cadence_seconds,
    nextRunAt: toIso(row.next_run_at),
    active: row.active,
  };
}

export async function runDueSchedules({ schedulerId, limit = 25 } = {}) {
  if (!schedulerId?.trim()) {
    throw new Error("schedulerId is required.");
  }

  assertIntegerInRange(limit, "limit", 1, 100);

  const client = await getPool().connect();

  try {
    await client.query("begin");

    await client.query(
      `insert into icamp_private.scheduler_heartbeats (
         scheduler_id,
         heartbeat_at,
         last_tick_started_at,
         last_error_code
       )
       values ($1, statement_timestamp(), statement_timestamp(), null)
       on conflict (scheduler_id)
       do update set
         heartbeat_at = statement_timestamp(),
         last_tick_started_at = statement_timestamp(),
         last_error_code = null`,
      [schedulerId],
    );

    const due = await client.query(
      `select *
       from icamp_private.job_schedules
       where active = true
         and next_run_at <= statement_timestamp()
       order by next_run_at, schedule_key
       for update skip locked
       limit $1`,
      [limit],
    );

    let enqueued = 0;

    for (const schedule of due.rows) {
      const occurrence = new Date(schedule.next_run_at).toISOString();
      const idempotencyKey = "schedule:" + schedule.id + ":" + occurrence;

      await enqueueWithClient(client, {
        queueName: schedule.queue_name,
        jobType: schedule.job_type,
        idempotencyKey,
        scheduleId: schedule.id,
        organizationId: schedule.organization_id,
        campgroundId: schedule.campground_id,
        payload: schedule.payload,
        scheduledFor: occurrence,
        availableAt: occurrence,
        maxAttempts: schedule.max_attempts,
        retryBaseSeconds: schedule.retry_base_seconds,
      });

      await client.query(
        `update icamp_private.job_schedules
         set
           next_run_at = next_run_at + (cadence_seconds * interval '1 second'),
           last_enqueued_at = statement_timestamp(),
           updated_at = statement_timestamp()
         where id = $1`,
        [schedule.id],
      );

      enqueued += 1;
    }

    await client.query(
      `update icamp_private.scheduler_heartbeats
       set
         heartbeat_at = statement_timestamp(),
         last_tick_completed_at = statement_timestamp(),
         due_schedules_found = $2,
         jobs_enqueued = $3,
         last_error_code = null
       where scheduler_id = $1`,
      [schedulerId, due.rowCount, enqueued],
    );

    await client.query("commit");

    return {
      schedulerId,
      dueSchedulesFound: due.rowCount,
      jobsEnqueued: enqueued,
    };
  } catch (error) {
    await client.query("rollback");

    await getPool().query(
      `insert into icamp_private.scheduler_heartbeats (
         scheduler_id,
         heartbeat_at,
         last_tick_started_at,
         last_tick_completed_at,
         last_error_code
       )
       values ($1, statement_timestamp(), statement_timestamp(), statement_timestamp(), 'scheduler.tick_failed')
       on conflict (scheduler_id)
       do update set
         heartbeat_at = statement_timestamp(),
         last_tick_completed_at = statement_timestamp(),
         last_error_code = 'scheduler.tick_failed'`,
      [schedulerId],
    );

    throw error;
  } finally {
    client.release();
  }
}

export async function heartbeatWorker({
  workerId,
  queueName = DEFAULT_QUEUE,
  metadata = {},
}) {
  const result = await getPool().query(
    `insert into icamp_private.queue_workers (
       worker_id,
       queue_name,
       started_at,
       heartbeat_at,
       stopped_at,
       metadata
     )
     values ($1, $2, statement_timestamp(), statement_timestamp(), null, $3::jsonb)
     on conflict (worker_id)
     do update set
       queue_name = excluded.queue_name,
       heartbeat_at = statement_timestamp(),
       stopped_at = null,
       metadata = excluded.metadata
     returning worker_id, queue_name, heartbeat_at, stopped_at`,
    [workerId, queueName, JSON.stringify(metadata)],
  );

  const row = result.rows[0];

  return {
    workerId: row.worker_id,
    queueName: row.queue_name,
    heartbeatAt: toIso(row.heartbeat_at),
    stoppedAt: toIso(row.stopped_at),
  };
}

export async function stopWorker(workerId) {
  const result = await getPool().query(
    `update icamp_private.queue_workers
     set stopped_at = statement_timestamp()
     where worker_id = $1
       and stopped_at is null
     returning worker_id`,
    [workerId],
  );

  return result.rowCount === 1;
}

async function recoverExpiredLeases(client, queueName) {
  await client.query(
    `update icamp_private.job_queue
     set
       state = 'dead_letter',
       lease_owner = null,
       lease_expires_at = null,
       last_heartbeat_at = statement_timestamp(),
       last_error_code = coalesce(last_error_code, 'lease.expired'),
       last_error_summary = coalesce(
         last_error_summary,
         'Worker lease expired after the final permitted attempt.'
       ),
       dead_lettered_at = statement_timestamp(),
       updated_at = statement_timestamp()
     where queue_name = $1
       and state = 'running'
       and lease_expires_at <= statement_timestamp()
       and attempt_count >= max_attempts`,
    [queueName],
  );

  await client.query(
    `update icamp_private.job_queue
     set
       state = 'queued',
       lease_owner = null,
       lease_expires_at = null,
       last_heartbeat_at = statement_timestamp(),
       last_error_code = 'lease.expired',
       last_error_summary = 'Previous worker lease expired; job returned to the queue.',
       available_at = statement_timestamp(),
       updated_at = statement_timestamp()
     where queue_name = $1
       and state = 'running'
       and lease_expires_at <= statement_timestamp()
       and attempt_count < max_attempts`,
    [queueName],
  );
}

export async function claimJob({
  workerId,
  queueName = DEFAULT_QUEUE,
  leaseSeconds = 60,
}) {
  assertIntegerInRange(leaseSeconds, "leaseSeconds", 5, 3600);

  const client = await getPool().connect();

  try {
    await client.query("begin");
    await recoverExpiredLeases(client, queueName);

    const result = await client.query(
      `with candidate as (
         select id
         from icamp_private.job_queue
         where queue_name = $1
           and state = 'queued'
           and scheduled_for <= statement_timestamp()
           and available_at <= statement_timestamp()
           and attempt_count < max_attempts
         order by priority desc, available_at, created_at
         for update skip locked
         limit 1
       )
       update icamp_private.job_queue j
       set
         state = 'running',
         attempt_count = j.attempt_count + 1,
         lease_owner = $2,
         lease_expires_at = statement_timestamp() + ($3 * interval '1 second'),
         last_heartbeat_at = statement_timestamp(),
         updated_at = statement_timestamp()
       from candidate
       where j.id = candidate.id
       returning j.*`,
      [queueName, workerId, leaseSeconds],
    );

    await client.query("commit");
    return normalizeJob(result.rows[0]);
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function heartbeatJob({
  jobId,
  workerId,
  leaseSeconds = 60,
}) {
  assertIntegerInRange(leaseSeconds, "leaseSeconds", 5, 3600);

  const result = await getPool().query(
    `update icamp_private.job_queue
     set
       lease_expires_at = statement_timestamp() + ($3 * interval '1 second'),
       last_heartbeat_at = statement_timestamp(),
       updated_at = statement_timestamp()
     where id = $1
       and state = 'running'
       and lease_owner = $2
       and lease_expires_at > statement_timestamp()
     returning *`,
    [jobId, workerId, leaseSeconds],
  );

  return normalizeJob(result.rows[0]);
}

export async function completeJob({ jobId, workerId }) {
  const result = await getPool().query(
    `update icamp_private.job_queue
     set
       state = 'succeeded',
       lease_owner = null,
       lease_expires_at = null,
       last_heartbeat_at = statement_timestamp(),
       completed_at = statement_timestamp(),
       updated_at = statement_timestamp()
     where id = $1
       and state = 'running'
       and lease_owner = $2
       and lease_expires_at > statement_timestamp()
     returning *`,
    [jobId, workerId],
  );

  return normalizeJob(result.rows[0]);
}

export async function failJob({
  jobId,
  workerId,
  errorCode,
  errorSummary,
  retryDelaySeconds: requestedRetryDelaySeconds = null,
}) {
  const current = await getPool().query(
    `select attempt_count, max_attempts, retry_base_seconds
     from icamp_private.job_queue
     where id = $1
       and state = 'running'
       and lease_owner = $2
       and lease_expires_at > statement_timestamp()
     limit 1`,
    [jobId, workerId],
  );

  const row = current.rows[0];

  if (!row) {
    return null;
  }

  const terminal = row.attempt_count >= row.max_attempts;
  const retryDelay = terminal
    ? 0
    : requestedRetryDelaySeconds ??
      retryDelaySeconds(row.attempt_count, row.retry_base_seconds);

  if (!terminal) {
    assertIntegerInRange(retryDelay, "retryDelaySeconds", 1, 86400);
  }

  const result = await getPool().query(
    `update icamp_private.job_queue
     set
       state = case when attempt_count >= max_attempts then 'dead_letter' else 'queued' end,
       lease_owner = null,
       lease_expires_at = null,
       last_heartbeat_at = statement_timestamp(),
       available_at = case
         when attempt_count >= max_attempts then available_at
         else statement_timestamp() + ($5 * interval '1 second')
       end,
       last_error_code = $3,
       last_error_summary = $4,
       dead_lettered_at = case
         when attempt_count >= max_attempts then statement_timestamp()
         else null
       end,
       updated_at = statement_timestamp()
     where id = $1
       and state = 'running'
       and lease_owner = $2
       and lease_expires_at > statement_timestamp()
     returning *`,
    [jobId, workerId, errorCode, errorSummary, retryDelay],
  );

  return normalizeJob(result.rows[0]);
}

export async function listDeadLetterJobs({
  queueName = DEFAULT_QUEUE,
  limit = 50,
} = {}) {
  assertIntegerInRange(limit, "limit", 1, 200);

  const result = await getPool().query(
    `select *
     from icamp_private.job_queue
     where queue_name = $1
       and state = 'dead_letter'
     order by dead_lettered_at desc, created_at desc
     limit $2`,
    [queueName, limit],
  );

  return result.rows.map(normalizeJob);
}

export async function getOperationalQueueHealth({
  workerStaleSeconds = 120,
  overdueSeconds = 300,
} = {}) {
  assertIntegerInRange(workerStaleSeconds, "workerStaleSeconds", 30, 86400);
  assertIntegerInRange(overdueSeconds, "overdueSeconds", 30, 604800);

  const [jobs, workers, schedules, scheduler] = await Promise.all([
    getPool().query(
      `select
         count(*) filter (where state = 'queued')::integer as queued,
         count(*) filter (where state = 'running')::integer as running,
         count(*) filter (where state = 'dead_letter')::integer as dead_letter,
         count(*) filter (
           where state = 'queued'
             and available_at < statement_timestamp() - ($1 * interval '1 second')
         )::integer as overdue,
         count(*) filter (
           where state = 'running'
             and lease_expires_at < statement_timestamp()
         )::integer as expired_leases
       from icamp_private.job_queue`,
      [overdueSeconds],
    ),
    getPool().query(
      `select
         count(*) filter (where stopped_at is null)::integer as active,
         count(*) filter (
           where stopped_at is null
             and heartbeat_at < statement_timestamp() - ($1 * interval '1 second')
         )::integer as stalled,
         max(heartbeat_at) filter (where stopped_at is null) as latest_heartbeat
       from icamp_private.queue_workers`,
      [workerStaleSeconds],
    ),
    getPool().query(
      `select
         count(*) filter (where active = true)::integer as active,
         count(*) filter (
           where active = true
             and next_run_at < statement_timestamp() - ($1 * interval '1 second')
         )::integer as overdue,
         min(next_run_at) filter (where active = true) as next_due_at
       from icamp_private.job_schedules`,
      [overdueSeconds],
    ),
    getPool().query(
      `select scheduler_id, heartbeat_at, last_tick_completed_at, last_error_code
       from icamp_private.scheduler_heartbeats
       order by heartbeat_at desc
       limit 1`,
    ),
  ]);

  const jobCounts = jobs.rows[0];
  const workerCounts = workers.rows[0];
  const scheduleCounts = schedules.rows[0];
  const schedulerRow = scheduler.rows[0] ?? null;
  const activeSchedules = scheduleCounts.active ?? 0;
  const schedulerStale =
    activeSchedules > 0 &&
    (!schedulerRow ||
      new Date(schedulerRow.heartbeat_at).getTime() <
        Date.now() - workerStaleSeconds * 1000);

  const signalCount =
    (jobCounts.dead_letter ?? 0) +
    (jobCounts.overdue ?? 0) +
    (jobCounts.expired_leases ?? 0) +
    (workerCounts.stalled ?? 0) +
    (scheduleCounts.overdue ?? 0) +
    (schedulerStale ? 1 : 0) +
    (schedulerRow?.last_error_code ? 1 : 0);

  return {
    status: signalCount === 0 ? "operational" : "degraded",
    jobs: {
      queued: jobCounts.queued ?? 0,
      running: jobCounts.running ?? 0,
      deadLetter: jobCounts.dead_letter ?? 0,
      overdue: jobCounts.overdue ?? 0,
      expiredLeases: jobCounts.expired_leases ?? 0,
    },
    workers: {
      active: workerCounts.active ?? 0,
      stalled: workerCounts.stalled ?? 0,
      latestHeartbeatAt: toIso(workerCounts.latest_heartbeat),
    },
    schedules: {
      active: activeSchedules,
      overdue: scheduleCounts.overdue ?? 0,
      nextDueAt: toIso(scheduleCounts.next_due_at),
      schedulerState:
        activeSchedules === 0
          ? "standby"
          : schedulerStale
            ? "stalled"
            : "healthy",
    },
    scheduler: schedulerRow
      ? {
          schedulerId: schedulerRow.scheduler_id,
          heartbeatAt: toIso(schedulerRow.heartbeat_at),
          lastTickCompletedAt: toIso(schedulerRow.last_tick_completed_at),
          lastErrorCode: schedulerRow.last_error_code,
        }
      : null,
  };
}
