import type { TrendAnnotationInput, HandoffPlanInput } from "./core.mjs";
export interface OwnerTrendAnnotation {
  id: string;
  campgroundId: string;
  weekStart: string;
  metric: string;
  disposition: string;
  evidenceReference: string;
  note: string;
  nextReviewAt: string;
  recordedAt: string;
}
export interface OwnerHandoffPlan {
  id: string;
  sourceCampgroundId: string;
  targetCampgroundId: string;
  sourceAnnotationId: string;
  planningScope: string;
  dueAt: string;
  evidenceReference: string;
  ownerNote: string;
  plannedAt: string;
}
export function getOwnerPlanning(
  actorUserId: string,
  authorizedCampgroundIds: string[],
): Promise<{
  annotations: OwnerTrendAnnotation[];
  handoffs: OwnerHandoffPlan[];
  annotationLimited: boolean;
  handoffLimited: boolean;
}>;
export function recordOwnerTrendAnnotation(
  input: TrendAnnotationInput & { actorUserId: string },
): Promise<string>;
export function recordOwnerHandoffPlan(
  input: HandoffPlanInput & { actorUserId: string },
): Promise<string>;
