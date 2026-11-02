export function normalizeReopenActionPlan(
  raw: Record<string, unknown>,
  now?: Date,
): {
  id: string;
  exceptionReviewId: string;
  sourceCampgroundId: string;
  targetCampgroundId: string;
  actionKind: string;
  nextDueAt: string;
  evidenceReference: string;
  actionNote: string;
};
export function normalizeHoldResolution(raw: Record<string, unknown>): {
  id: string;
  actionPlanId: string;
  sourceCampgroundId: string;
  targetCampgroundId: string;
  resolutionKind: string;
  evidenceReference: string;
  resolutionNote: string;
};
