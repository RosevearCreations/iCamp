export interface SourceEvidence274 {
  hostPinned: boolean;
  adopted: boolean;
  bookingSignerConfigured: boolean;
  commsSignerConfigured: boolean;
  restoreSignerConfigured: boolean;
  consumerAck: number;
  incidentClosed: number;
  providerRestore: number;
  status: string;
}
export interface OriginalOwnerSession274 {
  originalRosevear: boolean;
  aal2: boolean;
}
export interface Check274 {
  id: string;
  status: "EVIDENCE_PRESENT_REVIEW_REQUIRED" | "HOLD";
  detail: string;
}
export function classify274(
  source: SourceEvidence274,
  ownerSession: OriginalOwnerSession274 | null,
): {
  status: "PENDING_INDEPENDENT_LIVE_ACCEPTANCE";
  checks: Check274[];
  sourceStatus: string;
};
