export interface DispatchHandoffInput {
  jobId: string;
  assignedUserId: string;
  expectedJobVersion: number;
  expectedAssignmentVersion: number;
  acknowledgementMinutes: string | number;
  completionTargetUtc: string;
}
export function validateDispatchHandoff(input: DispatchHandoffInput): {
  jobId: string;
  assignedUserId: string;
  expectedJobVersion: number;
  expectedAssignmentVersion: number;
  acknowledgementMinutes: number;
  completionDueAt: string | null;
};
export function validateWorkerDispatchAcknowledgement(input: {
  dispatchId: string;
  response: string;
  note: string;
}): { dispatchId: string; response: string; note: string | null };
export interface DispatchRecord {
  id: string;
  jobId: string;
  assignedUserId: string;
  assignmentVersion: number;
  jobVersion: number;
  dispatchedAt: string;
  acknowledgementDueAt: string;
  completionDueAt: string | null;
  response: string | null;
  responseNote: string | null;
  acknowledgedAt: string | null;
  completedAt: string | null;
}
export function classifyFulfillmentDispatch(input: {
  currentJobVersion: number;
  currentAssignmentVersion: number;
  currentAssignedUserId: string | null;
  jobState: string;
  dispatch: DispatchRecord | null;
  isLatest?: boolean;
  now?: string;
}): {
  status: "superseded" | "current";
  acknowledgement: string;
  completion: string;
  canAcknowledge: boolean;
} | null;
export const DISPATCH_ACK_LABELS: Readonly<Record<string, string>>;
export const DISPATCH_COMPLETION_LABELS: Readonly<Record<string, string>>;
