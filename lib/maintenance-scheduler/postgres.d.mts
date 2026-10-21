import type { BackgroundJob } from "../jobs/postgres.mjs";

export interface RecurringMaintenanceSnapshot {
  campground: {
    id: string;
    organizationId: string;
    name: string;
    timezone: string;
  };
  generatedAt: string;
  categories: Array<{ id: string; code: string; name: string }>;
  priorities: Array<{ id: string; priorityKey: string }>;
  sections: Array<{ id: string; name: string }>;
  assets: Array<{ id: string; name: string }>;
  accommodations: Array<{ id: string; code: string; name: string }>;
  schedules: Array<{
    id: string;
    categoryId: string;
    categoryName: string;
    priorityPolicyId: string;
    priorityKey: string;
    sectionId: string | null;
    sectionName: string | null;
    assetId: string | null;
    assetName: string | null;
    accommodationId: string | null;
    accommodationName: string | null;
    locationDescription: string | null;
    title: string;
    description: string | null;
    recurrenceKind: string;
    intervalValue: number | null;
    weekday: number | null;
    monthDay: number | null;
    seasonMonth: number | null;
    seasonDay: number | null;
    firstOccurrenceLocal: string;
    nextOccurrenceAt: string;
    endsAt: string | null;
    missedAfterMinutes: number;
    catchUpMode: string;
    isActive: boolean;
    rowVersion: number;
    createdByUserId: string;
    createdAt: string;
    updatedAt: string;
  }>;
  occurrences: Array<{
    id: string;
    scheduleId: string;
    scheduleTitle: string;
    scheduledFor: string;
    state: string;
    workOrderId: string | null;
    reasonCode: string | null;
    processedAt: string;
    processedByUserId: string | null;
  }>;
}

export function closeMaintenanceSchedulerPoolForTests(): Promise<void>;

export function getRecurringMaintenanceSnapshot(
  userId: string,
  campgroundId: string,
): Promise<RecurringMaintenanceSnapshot>;

export function createMaintenanceSchedule(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  title: string;
  description?: string | null;
  categoryId: string;
  priorityPolicyId: string;
  sectionId?: string | null;
  assetId?: string | null;
  accommodationId?: string | null;
  locationDescription?: string | null;
  recurrenceKind: string;
  intervalValue?: string | number | null;
  weekday?: string | number | null;
  monthDay?: string | number | null;
  seasonMonth?: string | number | null;
  seasonDay?: string | number | null;
  firstOccurrenceLocal: string;
  missedAfterMinutes?: string | number;
  catchUpMode?: string;
}): Promise<string>;

export function setMaintenanceScheduleActive(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  scheduleId: string;
  isActive: boolean;
  expectedRowVersion: number;
}): Promise<void>;

export function materializeMaintenanceOccurrence(input: {
  scheduleId: string;
  scheduledFor: string | Date;
}): Promise<{
  occurrenceId: string;
  state: string;
  workOrderId: string | null;
  duplicate: boolean;
}>;

export function processMaintenanceScheduleJob(
  job: BackgroundJob,
): Promise<{
  occurrenceId: string;
  state: string;
  workOrderId: string | null;
  duplicate: boolean;
}>;

export function runMaintenanceSchedulerCycle(input: {
  schedulerId: string;
  workerId: string;
  scheduleLimit?: number;
  jobLimit?: number;
}): Promise<{
  schedulerId: string;
  workerId: string;
  dueSchedulesFound: number;
  jobsEnqueued: number;
  jobsClaimed: number;
  jobsCompleted: number;
  jobsFailed: number;
}>;
