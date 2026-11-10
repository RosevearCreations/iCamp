import type { DispatchRecord } from "./fulfillment-dispatch-core.mjs";
export interface FulfillmentDispatchEvidence {
  dispatch: DispatchRecord;
  classification: {
    status: "current" | "superseded";
    acknowledgement: string;
    completion: string;
    canAcknowledge: boolean;
  } | null;
}
export function listCampgroundDispatchEvidence(input: {
  userId: string;
  campgroundId: string;
}): Promise<{ entries: FulfillmentDispatchEvidence[]; truncated: boolean }>;
export function dispatchCampgroundFulfillment(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  jobId: string;
  assignedUserId: string;
  expectedJobVersion: number;
  expectedAssignmentVersion: number;
  acknowledgementMinutes: string | number;
  completionTargetUtc: string;
}): Promise<{ id: string }>;
export function acknowledgeCampgroundDispatch(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  dispatchId: string;
  response: string;
  note: string;
}): Promise<{ id: string; response: string }>;
export function closeDispatchPoolForTests(): Promise<void>;
export interface FulfillmentAssignmentTransition {
  id: string;
  jobId: string;
  previousUserId: string | null;
  assignedUserId: string | null;
  assignmentVersion: number;
  reason: string | null;
  recordedAt: string;
}
export interface FulfillmentSlaFollowup {
  id: string;
  dispatchId: string;
  previousReviewId: string | null;
  state: string;
  note: string;
  signals: string[];
  reviewedAt: string;
}
export function listCampgroundSlaFollowups(input: {
  userId: string;
  campgroundId: string;
}): Promise<{
  transitions: FulfillmentAssignmentTransition[];
  followups: FulfillmentSlaFollowup[];
  truncated: boolean;
}>;
export function recordCampgroundSlaFollowup(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  dispatchId: string;
  previousReviewId?: string | null;
  reviewState: string;
  reviewNote: string;
}): Promise<{ id: string }>;
export interface FulfillmentWorkerInboxEntry extends FulfillmentDispatchEvidence {
  serviceName: string;
  quantity: number;
  serviceDate: string;
  serviceWindow: string;
  reservationReference: string;
}
export function listWorkerFulfillmentInbox(input: {
  userId: string;
  campgroundId: string;
  page?: number | string | null;
}): Promise<{
  page: number;
  hasNext: boolean;
  entries: FulfillmentWorkerInboxEntry[];
}>;
