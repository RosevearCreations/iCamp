export function originalSchema267(): Promise<boolean>;
export function listSupportOwnership267(): Promise<{
  status: string;
  coverageCapped: boolean;
  cases: Array<{
    id: string; category: string; severity: string; status: string;
    createdAt: string; assignedUserId: string | null;
    escalationLevel: number; version: number;
  }>;
}>;
export function assignSupport267(input: {
  actorUserId: string; caseId: string; assigneeId: string;
  version: number; escalate: boolean;
}): Promise<{ version: number; escalationLevel: number; action: string }>;
export function verifyTelemetrySignature267(body: string, signature: string, key: string | undefined): boolean;
export function normalizeTelemetry267(value: Record<string, unknown>, now?: number): {
  campgroundId: string; sourceId: string; nonce: string; observedAt: string;
  requests: number; errors: number; latencyP95Ms: number;
};
export function receiveTelemetry267(body: string, signature: string | null): Promise<{accepted: boolean}>;
export function listTelemetryAggregate267(): Promise<{
  status: string; metrics: null | {
    samples: number; requests: string; errors: string; lastReceivedAt: string;
  };
}>;
