export interface WorkloadForecast {
  schema: string;
  asOf: string;
  horizonHours: number;
  openCases: number;
  pendingHandoffs: number;
  observedDemandEvents: number;
  expectedNewReviewEvents: number;
  planningLoad: number;
  peakDailyShiftEquivalent: number;
  evidenceCoverage: string;
  methodology: string;
  independentAcceptance: string;
  automatedStaffing: boolean;
}
export interface FieldClosureEvent {
  id: string;
  dispatchId: string;
  fieldReportId: string;
  reviewId: string;
  previousEventId: string | null;
  decision: "closure_reviewed" | "recheck_required";
  evidenceReference: string;
  note: string;
  recordedByUserId: string;
  recordedAt: string;
}
export function validateFieldClosureEvidence(input: {
  dispatchId: string;
  fieldReportId: string;
  reviewId: string;
  previousEventId?: string | null;
  decision: string;
  evidenceReference: string;
  note: string;
}): {
  dispatchId: string;
  fieldReportId: string;
  reviewId: string;
  previousEventId: string | null;
  decision: string;
  evidenceReference: string;
  note: string;
};
export function buildSupervisorWorkloadForecast(input: {
  trend: {
    days: number;
    truncated: boolean;
    buckets: Array<{
      escalations: number;
      deviceBlockers: number;
      handoffRequests: number;
    }>;
  };
  openCases: number;
  pendingHandoffs: number;
  asOf: string;
  truncated?: boolean;
}): WorkloadForecast;
export function buildOwnerShiftPerformanceReport(input: {
  campgroundId: string;
  sourceRevision: string | null;
  asOf: string;
  trend: unknown;
  forecast: WorkloadForecast;
  closures: FieldClosureEvent[];
  truncated: boolean;
}): Record<string, unknown>;
