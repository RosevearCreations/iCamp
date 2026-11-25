export function openRecovery282(input: {
  actorId: string;
  ackId: string;
  reason: string;
}): Promise<void>;
export function recordDelivery282(input: {
  actorId: string;
  id: string;
  body: string;
  signature: string;
}): Promise<void>;
export function summary282(): Promise<{
  ready: boolean;
  reasons: string[];
  history: { id: string; digest: string }[];
  incidents: { id: string; reason: string; ackId: string; delivered: boolean }[];
}>;
