export function runMonitor283(): Promise<{ status: string }>;
export function closeRecovery283(input: {
  actorId: string;
  id: string;
}): Promise<void>;
export function summary283(): Promise<{
  ready: boolean;
  latest: { sampled_at: Date; evidence_status: string } | null;
  incidents: {
    id: string;
    reason: string;
    receipt_present: boolean;
    closure_recorded: boolean;
    attempts: number;
  }[];
}>;
