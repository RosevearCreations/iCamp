export type JobState = "queued" | "running" | "succeeded" | "dead_letter";

export interface BackgroundJob {
  id: string;
  queueName: string;
  jobType: string;
  idempotencyKey: string | null;
  scheduleId: string | null;
  organizationId: string | null;
  campgroundId: string | null;
  payload: Record<string, unknown>;
  priority: number;
  state: JobState;
  scheduledFor: string | null;
  availableAt: string | null;
  attemptCount: number;
  maxAttempts: number;
  retryBaseSeconds: number;
  leaseOwner: string | null;
  leaseExpiresAt: string | null;
  lastHeartbeatAt: string | null;
  lastErrorCode: string | null;
  lastErrorSummary: string | null;
  completedAt: string | null;
  deadLetteredAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface QueueHealthSnapshot {
  status: "operational" | "degraded";
  jobs: {
    queued: number;
    running: number;
    deadLetter: number;
    overdue: number;
    expiredLeases: number;
  };
  workers: {
    active: number;
    stalled: number;
    latestHeartbeatAt: string | null;
  };
  schedules: {
    active: number;
    overdue: number;
    nextDueAt: string | null;
    schedulerState: "standby" | "stalled" | "healthy";
  };
  scheduler: {
    schedulerId: string;
    heartbeatAt: string | null;
    lastTickCompletedAt: string | null;
    lastErrorCode: string | null;
  } | null;
}

export function retryDelaySeconds(
  attemptNumber: number,
  baseSeconds?: number,
): number;

export function enqueueJob(input: {
  queueName?: string;
  jobType: string;
  idempotencyKey?: string | null;
  scheduleId?: string | null;
  organizationId?: string | null;
  campgroundId?: string | null;
  payload?: Record<string, unknown>;
  priority?: number;
  scheduledFor?: string | Date | null;
  availableAt?: string | Date | null;
  maxAttempts?: number;
  retryBaseSeconds?: number;
}): Promise<BackgroundJob>;

export function registerSchedule(input: {
  scheduleKey: string;
  queueName?: string;
  jobType: string;
  organizationId?: string | null;
  campgroundId?: string | null;
  payload?: Record<string, unknown>;
  cadenceSeconds: number;
  nextRunAt: string | Date;
  maxAttempts?: number;
  retryBaseSeconds?: number;
  active?: boolean;
}): Promise<{
  id: string;
  scheduleKey: string;
  queueName: string;
  jobType: string;
  cadenceSeconds: number;
  nextRunAt: string | null;
  active: boolean;
}>;

export function runDueSchedules(input: {
  schedulerId: string;
  limit?: number;
}): Promise<{
  schedulerId: string;
  dueSchedulesFound: number;
  jobsEnqueued: number;
}>;

export function heartbeatWorker(input: {
  workerId: string;
  queueName?: string;
  metadata?: Record<string, unknown>;
}): Promise<{
  workerId: string;
  queueName: string;
  heartbeatAt: string | null;
  stoppedAt: string | null;
}>;

export function stopWorker(workerId: string): Promise<boolean>;

export function claimJob(input: {
  workerId: string;
  queueName?: string;
  leaseSeconds?: number;
}): Promise<BackgroundJob | null>;

export function heartbeatJob(input: {
  jobId: string;
  workerId: string;
  leaseSeconds?: number;
}): Promise<BackgroundJob | null>;

export function completeJob(input: {
  jobId: string;
  workerId: string;
}): Promise<BackgroundJob | null>;

export function failJob(input: {
  jobId: string;
  workerId: string;
  errorCode: string;
  errorSummary: string;
  retryDelaySeconds?: number | null;
}): Promise<BackgroundJob | null>;

export function listDeadLetterJobs(input?: {
  queueName?: string;
  limit?: number;
}): Promise<BackgroundJob[]>;

export function getOperationalQueueHealth(input?: {
  workerStaleSeconds?: number;
  overdueSeconds?: number;
}): Promise<QueueHealthSnapshot>;

export function closeJobPoolForTests(): Promise<void>;
