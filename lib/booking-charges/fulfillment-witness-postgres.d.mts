import type {
  WitnessEvent,
  ForecastCheckpoint,
  OwnerAuditEvent,
} from "./fulfillment-witness-core.mjs";
export function listWitnessAuditEvidence(input: {
  userId: string;
  campgroundId: string;
}): Promise<{
  witnesses: WitnessEvent[];
  checkpoints: ForecastCheckpoint[];
  ownerAudits: OwnerAuditEvent[];
  truncated: boolean;
}>;
export function recordIndependentFieldWitness(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  dispatchId: string;
  closureId: string;
  previousWitnessId?: string | null;
  decision: string;
  evidenceReference: string;
  explanation: string;
}): Promise<{ id: string }>;
export function recordForecastCheckpoint(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  forecast: {
    expectedNewReviewEvents: number;
    planningLoad: number;
    evidenceCoverage: string;
  };
}): Promise<{ id: string }>;
export function recordOwnerShiftAudit(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  subjectKind: string;
  subjectId: string;
  decision: string;
  explanation: string;
}): Promise<{ id: string }>;
