export interface OwnerReviewCommonInput {
  id: string;
  resolutionId: string;
  planId: string;
  sourceCampgroundId: string;
  targetCampgroundId: string;
  evidenceReference: string;
}
export interface IndependentReviewInput extends OwnerReviewCommonInput {
  reviewKind: string;
  nextReviewAt: string;
  reviewerNote: string;
}
export interface ReviewAcceptanceInput extends OwnerReviewCommonInput {
  reassessmentId: string;
  acceptanceNote: string;
}
export function normalizeIndependentReview(
  input: IndependentReviewInput,
  now?: Date,
): IndependentReviewInput & { nextReviewAt: string | null };
export function normalizeReviewAcceptance(
  input: ReviewAcceptanceInput,
): ReviewAcceptanceInput;
export function latestReviewsByResolution<
  T extends { id: string; resolutionId: string; reviewedAt: string },
>(reviews: T[]): Map<string, T>;
export function canAcceptReview(
  review: { reviewKind: string } | undefined,
  accepted: boolean,
): boolean;
