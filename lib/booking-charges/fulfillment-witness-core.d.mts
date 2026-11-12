export interface WitnessEvent {
  id: string;
  dispatchId: string;
  closureId: string;
  previousWitnessId: string | null;
  decision: "observed_unverified" | "recheck_required";
  evidenceReference: string;
  explanation: string;
  witnessedByUserId: string;
  witnessedAt: string;
}
export interface ForecastCheckpoint {
  id: string;
  expectedNewReviewEvents: number;
  planningLoad: number;
  evidenceCoverage: string;
  capturedAt: string;
}
export interface OwnerAuditEvent {
  id: string;
  subjectKind: string;
  subjectId: string;
  decision: string;
  reviewedAt: string;
}
export function validateIndependentFieldWitness(input: {
  dispatchId: string;
  closureId: string;
  previousWitnessId?: string | null;
  decision: string;
  evidenceReference: string;
  explanation: string;
}): {
  dispatchId: string;
  closureId: string;
  previousWitnessId: string | null;
  decision: string;
  evidenceReference: string;
  explanation: string;
};
export function validateOwnerShiftAudit(input: {
  subjectKind: string;
  subjectId: string;
  decision: string;
  explanation: string;
}): {
  subjectKind: string;
  subjectId: string;
  decision: string;
  explanation: string;
};
export function evaluateForecastCheckpoint(input: {
  checkpoint: ForecastCheckpoint;
  reviews: Array<{ id: string; decision: string; reviewedAt: string }>;
  handoffs: Array<{ id: string; eventKind: string; recordedAt: string }>;
  asOf: string;
  truncated?: boolean;
}): {
  checkpointId: string;
  horizonEndedAt: string;
  expectedNewReviewEvents: number;
  observedNewReviewEvents: number | null;
  absoluteError: number | null;
  evidenceState: string;
  ownerAcceptance: string;
  independentFieldAcceptance: string;
};
export function buildWitnessAuditSummary(input: {
  witnesses: WitnessEvent[];
  checkpoints: ForecastCheckpoint[];
  reviews: Array<{ id: string; decision: string; reviewedAt: string }>;
  handoffs: Array<{ id: string; eventKind: string; recordedAt: string }>;
  ownerAudits: OwnerAuditEvent[];
  asOf: string;
  truncated?: boolean;
}): Record<string, unknown>;
