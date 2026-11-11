export interface ShiftEvent {
  id: string;
  dispatchId: string;
  requestId: string | null;
  eventKind: string;
  ownerEventId: string;
  outgoingUserId: string;
  incomingUserId: string;
  recordedByUserId: string;
  note: string;
  recordedAt: string;
}
export interface TrendBucket {
  date: string;
  followupsResolved: number;
  escalations: number;
  deviceBlockers: number;
  handoffRequests: number;
  handoffAccepted: number;
  handoffDeclined: number;
}
export interface RecoveryTrend {
  schema: string;
  asOf: string;
  days: number;
  buckets: TrendBucket[];
  totals: Omit<TrendBucket, "date">;
  truncated: boolean;
  source: string;
  independentAcceptance: string;
}
export function validateShiftHandoffRequest(input: {
  dispatchId: string;
  ownerEventId: string;
  targetUserId: string;
  note: string;
}): {
  dispatchId: string;
  ownerEventId: string;
  targetUserId: string;
  note: string;
};
export function validateShiftHandoffDecision(input: {
  requestId: string;
  decision: string;
  note: string;
}): { requestId: string; decision: string; note: string };
export function buildRecoveryTrendAnalytics(input: {
  reviews: Array<{ reviewedAt: string; reviewKind: string; decision: string }>;
  handoffs: Array<{ recordedAt: string; eventKind: string }>;
  asOf: string;
  days?: number;
  truncated?: boolean;
}): RecoveryTrend;
export function buildAuthorizedSourceReviewExport(input: {
  campgroundId: string;
  sourceRevision: string | null;
  generatedAt: string;
  format: string;
  trend: RecoveryTrend;
  reviews: Array<{
    id: string;
    dispatchId: string;
    reviewKind: string;
    decision: string;
    reviewedAt: string;
  }>;
  handoffs: ShiftEvent[];
  truncated: boolean;
}): Record<string, unknown>;
