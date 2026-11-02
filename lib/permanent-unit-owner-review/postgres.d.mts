import type { IndependentReviewInput, ReviewAcceptanceInput } from "./core.mjs";
export interface OwnerResolutionReview {
  id: string;
  resolutionId: string;
  planId: string;
  sourceCampgroundId: string;
  targetCampgroundId: string;
  reviewKind: string;
  nextReviewAt: string | null;
  evidenceReference: string;
  reviewerNote: string;
  reviewedByUserId: string;
  reviewedAt: string;
}
export interface OwnerReviewAcceptance {
  id: string;
  resolutionId: string;
  planId: string;
  reassessmentId: string;
  sourceCampgroundId: string;
  targetCampgroundId: string;
  evidenceReference: string;
  acceptanceNote: string;
  acceptedByUserId: string;
  acceptedAt: string;
}
export function getOwnerResolutionReview(
  actorUserId: string,
  authorizedCampgroundIds: string[],
): Promise<{
  reviews: OwnerResolutionReview[];
  acceptances: OwnerReviewAcceptance[];
  reviewsLimited: boolean;
  acceptancesLimited: boolean;
}>;
export function recordOwnerResolutionReview(
  input: IndependentReviewInput & { actorUserId: string },
): Promise<string>;
export function recordOwnerReviewAcceptance(
  input: ReviewAcceptanceInput & { actorUserId: string },
): Promise<string>;
