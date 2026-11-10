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
