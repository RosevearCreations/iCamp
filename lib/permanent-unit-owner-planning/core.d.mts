export interface TrendAnnotationInput {
  id: unknown;
  campgroundId: unknown;
  weekStart: unknown;
  metric: unknown;
  disposition: unknown;
  evidenceReference: unknown;
  note: unknown;
  nextReviewAt: unknown;
}
export interface HandoffPlanInput {
  id: unknown;
  sourceCampgroundId: unknown;
  targetCampgroundId: unknown;
  sourceAnnotationId: unknown;
  planningScope: unknown;
  dueAt: unknown;
  evidenceReference: unknown;
  ownerNote: unknown;
}
export function utcWeekOptions(now?: Date): string[];
export function normalizeTrendAnnotation(
  input: TrendAnnotationInput,
  now?: Date,
): {
  id: string;
  campgroundId: string;
  weekStart: string;
  metric: string;
  disposition: string;
  evidenceReference: string;
  note: string;
  nextReviewAt: string;
};
export function normalizeHandoffPlan(
  input: HandoffPlanInput,
  now?: Date,
): {
  id: string;
  sourceCampgroundId: string;
  targetCampgroundId: string;
  sourceAnnotationId: string;
  planningScope: string;
  dueAt: string;
  evidenceReference: string;
  ownerNote: string;
};
