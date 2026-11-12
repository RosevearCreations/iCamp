export interface OriginalDeviceReview {
  id: string;
  dispatchId: string;
  fieldReportId: string;
  witnessId: string;
  previousReviewId: string | null;
  evidenceReference: string;
  digestSha256: string;
  decision: "inspected_unverified" | "recheck_required";
  reviewedByUserId: string;
  reviewedAt: string;
}
export interface CalibrationFollowup {
  id: string;
  checkpointId: string;
  previousEventId: string | null;
  decision: "investigate" | "mitigation_recorded" | "recheck_required";
  expectedNewReviewEvents: number;
  observedNewReviewEvents: number;
  absoluteError: number;
  recordedAt: string;
}
export function validateOriginalDeviceReview(input: {
  dispatchId: string;
  fieldReportId: string;
  witnessId: string;
  previousReviewId?: string | null;
  evidenceReference: string;
  digestSha256: string;
  decision: string;
  explanation: string;
}): {
  dispatchId: string;
  fieldReportId: string;
  witnessId: string;
  previousReviewId: string | null;
  evidenceReference: string;
  digestSha256: string;
  decision: string;
  explanation: string;
};
export function validateCalibrationFollowup(input: {
  checkpointId: string;
  previousEventId?: string | null;
  decision: string;
  explanation: string;
}): {
  checkpointId: string;
  previousEventId: string | null;
  decision: string;
  explanation: string;
};
export function classifyCalibrationException(
  evaluation:
    | {
        evidenceState: string;
        expectedNewReviewEvents: number;
        absoluteError: number | null;
      }
    | null
    | undefined,
): { status: string; deviation: number | null; threshold?: number };
export function buildOwnerAcceptanceEvidenceExport(input: {
  campgroundId: string;
  sourceRevision: string | null;
  generatedAt: string;
  witnessEvents: Array<{ id: string }>;
  originalDeviceReviews: OriginalDeviceReview[];
  checkpoints: Array<{
    id: string;
    capturedAt: string;
    expectedNewReviewEvents: number;
  }>;
  evaluations: Array<{
    checkpointId: string;
    expectedNewReviewEvents: number;
    observedNewReviewEvents: number | null;
    absoluteError: number | null;
    evidenceState: string;
  }>;
  calibrations: CalibrationFollowup[];
  ownerAudits: Array<{
    id: string;
    subjectKind: string;
    subjectId: string;
    decision: string;
    reviewedAt: string;
  }>;
  truncated: boolean;
}): Record<string, unknown>;
