export interface SupervisorContinuityEvent {
  id: string;
  dispatchId: string;
  subjectId: string;
  previousEventId: string | null;
  reviewKind: string;
  decision: string;
  note: string;
  reviewedByUserId: string;
  reviewedAt: string;
}
export function listSupervisorContinuityEvidence(input: {
  userId: string;
  campgroundId: string;
}): Promise<{
  caseFollowups: SupervisorContinuityEvent[];
  deviceReviews: SupervisorContinuityEvent[];
  truncated: boolean;
}>;
export function recordSupervisorContinuityReview(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  dispatchId: string;
  subjectId: string;
  previousReviewId?: string;
  reviewKind: string;
  decision: string;
  note: string;
}): Promise<{ id: string }>;
