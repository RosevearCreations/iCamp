import assert from "node:assert/strict";
import pg from "pg";

import {
  claimJob,
  closeJobPoolForTests,
  completeJob,
  enqueueJob,
  failJob,
  getOperationalQueueHealth,
  heartbeatJob,
  heartbeatWorker,
  listDeadLetterJobs,
  registerSchedule,
  retryDelaySeconds,
  runDueSchedules,
  stopWorker,
} from "../lib/jobs/postgres.mjs";

const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL?.trim();

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for queue lifecycle verification.");
}

const verificationPool = new Pool({ connectionString: databaseUrl, max: 2 });
const suffix = Date.now().toString(36);
const queueName = "build007_verify_" + suffix;
const workerId = "build007-worker-" + suffix;
const schedulerId = "build007-scheduler-" + suffix;
const scheduleKey = "build007.verify_" + suffix;

try {
  assert.equal(retryDelaySeconds(1, 2), 2);
  assert.equal(retryDelaySeconds(2, 2), 4);

  const schedule = await registerSchedule({
    scheduleKey,
    queueName,
    jobType: "build007.scheduled_verify",
    payload: { fixture: "scheduled" },
    cadenceSeconds: 60,
    nextRunAt: new Date(Date.now() - 1_000),
    maxAttempts: 3,
    retryBaseSeconds: 2,
  });

  const firstTick = await runDueSchedules({ schedulerId, limit: 10 });
  assert.equal(firstTick.dueSchedulesFound, 1);
  assert.equal(firstTick.jobsEnqueued, 1);

  const secondTick = await runDueSchedules({ schedulerId, limit: 10 });
  assert.equal(secondTick.dueSchedulesFound, 0);
  assert.equal(secondTick.jobsEnqueued, 0);

  const scheduledRows = await verificationPool.query(
    `select count(*)::integer as count
     from icamp_private.job_queue
     where schedule_id = $1`,
    [schedule.id],
  );
  assert.equal(scheduledRows.rows[0].count, 1);

  const firstEnqueue = await enqueueJob({
    queueName,
    jobType: "build007.retry_verify",
    idempotencyKey: "retry-" + suffix,
    payload: { fixture: "retry" },
    priority: 50,
    maxAttempts: 2,
    retryBaseSeconds: 1,
  });

  const duplicateEnqueue = await enqueueJob({
    queueName,
    jobType: "build007.retry_verify",
    idempotencyKey: "retry-" + suffix,
    payload: { fixture: "should-not-duplicate" },
    priority: 50,
    maxAttempts: 2,
    retryBaseSeconds: 1,
  });

  assert.equal(duplicateEnqueue.id, firstEnqueue.id);

  const duplicateCount = await verificationPool.query(
    `select count(*)::integer as count
     from icamp_private.job_queue
     where queue_name = $1
       and idempotency_key = $2`,
    [queueName, "retry-" + suffix],
  );
  assert.equal(duplicateCount.rows[0].count, 1);

  const worker = await heartbeatWorker({
    workerId,
    queueName,
    metadata: { fixture: "build007" },
  });
  assert.equal(worker.workerId, workerId);

  const claimedRetry = await claimJob({
    workerId,
    queueName,
    leaseSeconds: 30,
  });
  assert.equal(claimedRetry?.id, firstEnqueue.id);
  assert.equal(claimedRetry?.attemptCount, 1);
  assert.equal(claimedRetry?.state, "running");

  const heartbeat = await heartbeatJob({
    jobId: claimedRetry.id,
    workerId,
    leaseSeconds: 45,
  });
  assert.equal(heartbeat?.state, "running");

  const retrying = await failJob({
    jobId: claimedRetry.id,
    workerId,
    errorCode: "fixture.retry",
    errorSummary: "Synthetic retry verification.",
    retryDelaySeconds: 1,
  });
  assert.equal(retrying?.state, "queued");
  assert.equal(retrying?.attemptCount, 1);

  await verificationPool.query(
    `update icamp_private.job_queue
     set available_at = statement_timestamp() - interval '1 second'
     where id = $1`,
    [firstEnqueue.id],
  );

  const secondAttempt = await claimJob({
    workerId,
    queueName,
    leaseSeconds: 30,
  });
  assert.equal(secondAttempt?.id, firstEnqueue.id);
  assert.equal(secondAttempt?.attemptCount, 2);

  const deadLetter = await failJob({
    jobId: secondAttempt.id,
    workerId,
    errorCode: "fixture.exhausted",
    errorSummary: "Synthetic final-attempt verification.",
  });
  assert.equal(deadLetter?.state, "dead_letter");
  assert.ok(deadLetter?.deadLetteredAt);

  const scheduledJob = await claimJob({
    workerId,
    queueName,
    leaseSeconds: 30,
  });
  assert.equal(scheduledJob?.jobType, "build007.scheduled_verify");

  const completed = await completeJob({
    jobId: scheduledJob.id,
    workerId,
  });
  assert.equal(completed?.state, "succeeded");
  assert.ok(completed?.completedAt);

  const leaseExpiryFixture = await enqueueJob({
    queueName,
    jobType: "build007.lease_verify",
    idempotencyKey: "lease-" + suffix,
    priority: 90,
    maxAttempts: 1,
  });

  const leased = await claimJob({
    workerId,
    queueName,
    leaseSeconds: 5,
  });
  assert.equal(leased?.id, leaseExpiryFixture.id);

  await verificationPool.query(
    `update icamp_private.job_queue
     set lease_expires_at = statement_timestamp() - interval '1 second'
     where id = $1`,
    [leaseExpiryFixture.id],
  );

  const afterExpiredLease = await claimJob({
    workerId,
    queueName,
    leaseSeconds: 5,
  });
  assert.equal(afterExpiredLease, null);

  const deadLetters = await listDeadLetterJobs({ queueName, limit: 10 });
  assert.equal(deadLetters.length, 2);
  assert.ok(deadLetters.some((job) => job.id === firstEnqueue.id));
  assert.ok(deadLetters.some((job) => job.id === leaseExpiryFixture.id));

  const health = await getOperationalQueueHealth({
    workerStaleSeconds: 120,
    overdueSeconds: 300,
  });

  assert.equal(health.status, "degraded");
  assert.ok(health.jobs.deadLetter >= 2);
  assert.equal(health.jobs.expiredLeases, 0);
  assert.ok(health.workers.active >= 1);
  assert.equal(health.workers.stalled, 0);
  assert.equal(health.schedules.schedulerState, "healthy");
  assert.ok(health.scheduler?.heartbeatAt);

  assert.equal(await stopWorker(workerId), true);

  process.stdout.write(
    "Build 007 queue lifecycle verified: schedule, idempotency, retry, lease recovery, dead-letter visibility and health signals.\n",
  );
} finally {
  await verificationPool.end();
  await closeJobPoolForTests();
}
