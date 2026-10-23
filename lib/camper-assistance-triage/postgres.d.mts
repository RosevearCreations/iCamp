export declare function closeAssistanceTriagePoolForTests(): Promise<void>;

export declare function listAssistanceQueue(
  userId: string,
  campgroundId: string,
): Promise<{
  cases: Array<Record<string, unknown> & {
    id: string;
    requestId: string;
    caseState: string;
    rowVersion: number;
    events: Array<Record<string, unknown>>;
    escalations: Array<Record<string, unknown>>;
  }>;
  staff: Array<{ userId: string; label: string; roleCodes: string[] }>;
}>;

export declare function triageAssistanceCase(input: Record<string, unknown>): Promise<Record<string, unknown>>;
export declare function addAssistanceStaffNote(input: Record<string, unknown>): Promise<{ id: string; occurredAt: string | null }>;
export declare function recordAssistanceGuestMessage(input: Record<string, unknown>): Promise<{ id: string; occurredAt: string | null }>;
export declare function escalateAssistanceCase(input: Record<string, unknown>): Promise<Record<string, unknown>>;
export declare function acknowledgeAssistanceEscalation(input: Record<string, unknown>): Promise<Record<string, unknown>>;
export declare function resolveAssistanceEscalation(input: Record<string, unknown>): Promise<Record<string, unknown>>;
export declare function closeAssistanceCase(input: Record<string, unknown>): Promise<Record<string, unknown>>;
export declare function listGuestAssistanceUpdates(input: {
  userId: string;
  reservationId: string;
}): Promise<Array<Record<string, unknown>>>;
