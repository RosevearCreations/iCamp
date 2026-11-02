export interface AssistanceCaseEvent {
  id: string;
  caseId: string;
  eventKind: string;
  actorUserId: string;
  actorLabel: string | null;
  sourceChannel: string;
  contactChannel: string | null;
  guestVisible: boolean;
  summary: string;
  metadata: Record<string, unknown>;
  occurredAt: string | null;
}

export interface AssistanceEscalation {
  id: string;
  caseId: string;
  escalationLevel: string;
  state: string;
  reason: string;
  raisedByUserId: string;
  raisedByLabel: string | null;
  raisedAt: string | null;
  acknowledgedByUserId: string | null;
  acknowledgedAt: string | null;
  resolutionNote: string | null;
  resolvedByUserId: string | null;
  resolvedAt: string | null;
  rowVersion: number;
}

export interface AssistanceQueueCase {
  id: string;
  organizationId: string;
  campgroundId: string;
  requestId: string;
  reservationId: string;
  accommodationId: string;
  accommodationCode: string;
  accommodationName: string;
  guestUserId: string;
  guestEmail: string;
  submittedCategory: string;
  submittedSeverity: string;
  category: string;
  severity: string;
  summary: string;
  details: string | null;
  contactPreference: string;
  submittedAt: string | null;
  caseState: string;
  assignedToUserId: string | null;
  assignedToLabel: string | null;
  escalationLevel: string;
  outcomeCode: string | null;
  outcomeSummary: string | null;
  closedAt: string | null;
  updatedAt: string | null;
  rowVersion: number;
  mediaCount: number;
  activeEscalationId: string | null;
  activeEscalationState: string | null;
  activeEscalationLevel: string | null;
  activeEscalationRowVersion: number | null;
  events: AssistanceCaseEvent[];
  escalations: AssistanceEscalation[];
}

export declare function closeAssistanceTriagePoolForTests(): Promise<void>;

export declare function listAssistanceQueue(
  userId: string,
  campgroundId: string,
): Promise<{
  cases: AssistanceQueueCase[];
  staff: Array<{ userId: string; label: string; roleCodes: string[] }>;
}>;

export declare function triageAssistanceCase(
  input: Record<string, unknown>,
): Promise<Record<string, unknown>>;
export declare function addAssistanceStaffNote(
  input: Record<string, unknown>,
): Promise<{ id: string; occurredAt: string | null }>;
export declare function recordAssistanceGuestMessage(
  input: Record<string, unknown>,
): Promise<{ id: string; occurredAt: string | null }>;
export declare function escalateAssistanceCase(
  input: Record<string, unknown>,
): Promise<Record<string, unknown>>;
export declare function acknowledgeAssistanceEscalation(
  input: Record<string, unknown>,
): Promise<Record<string, unknown>>;
export declare function resolveAssistanceEscalation(
  input: Record<string, unknown>,
): Promise<Record<string, unknown>>;
export declare function closeAssistanceCase(
  input: Record<string, unknown>,
): Promise<Record<string, unknown>>;

export interface GuestAssistanceUpdate {
  requestId: string;
  caseState: string;
  category: string;
  severity: string;
  outcomeCode: string | null;
  outcomeSummary: string | null;
  closedAt: string | null;
  assigned: boolean;
  escalationLevel: string;
  updatedAt: string | null;
  updates: Array<{
    id: string;
    eventKind: string;
    channel: string | null;
    summary: string;
    occurredAt: string | null;
  }>;
}

export declare function listGuestAssistanceUpdates(input: {
  userId: string;
  reservationId: string;
}): Promise<GuestAssistanceUpdate[]>;
