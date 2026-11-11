export interface SavedPriorityView {
  id: string;
  label: string;
  filter: string;
  createdAt: string;
}
export interface CaseOwnershipEvent {
  id: string;
  dispatchId: string;
  previousEventId: string | null;
  claimedByUserId: string | null;
  reason: string;
  recordedAt: string;
}
export interface WorkerMobileFieldReport {
  id: string;
  dispatchId: string;
  reportedByUserId: string;
  deviceKind: string;
  outcome: string;
  observation: string;
  reportedAt: string;
}
export function listFulfillmentSupervisorEvidence(input: {
  userId: string;
  campgroundId: string;
}): Promise<{
  savedViews: SavedPriorityView[];
  ownership: CaseOwnershipEvent[];
  mobile: WorkerMobileFieldReport[];
  truncated: boolean;
}>;
export function saveSupervisorPriorityView(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  label: string;
  filter: string;
}): Promise<{ id: string }>;
export function removeSupervisorPriorityView(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  viewId: string;
}): Promise<{ id: string }>;
export function recordSupervisorCaseOwnership(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  dispatchId: string;
  previousEventId: string;
  intent: string;
  note: string;
}): Promise<{ id: string }>;
export function recordWorkerMobileFieldReport(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  dispatchId: string;
  deviceKind: string;
  outcome: string;
  note: string;
}): Promise<{ id: string }>;
