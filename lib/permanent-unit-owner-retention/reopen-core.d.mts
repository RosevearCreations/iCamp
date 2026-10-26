export const reopenKinds: string[];
export function normalizeAcceptanceExceptionReview(
  raw: Record<string, unknown>,
): {
  id: string;
  acceptanceId: string;
  sourceCampgroundId: string;
  targetCampgroundId: string;
  reviewKind: string;
  evidenceReference: string;
  reviewNote: string;
};
