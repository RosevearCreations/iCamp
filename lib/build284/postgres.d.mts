export function runScheduler284(): Promise<{ status: string }>;
export function summary284(): Promise<{
  ready: boolean;
  latest: {
    sampled_at: Date;
    evidence_status: string;
    delivery_checked: number;
    delivery_verified: number;
  } | null;
  discoveries: { id: string; ack_id: string; reason: string; opened: boolean }[];
}>;
