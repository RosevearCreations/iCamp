export const CONTINUITY_DECISIONS: Readonly<Record<string, string>>;
export const DEVICE_REVIEW_DECISIONS: Readonly<Record<string, string>>;
export function validateSupervisorContinuityReview(input: {
  dispatchId: string;
  subjectId: string;
  previousReviewId?: string;
  reviewKind: string;
  decision: string;
  note: string;
}): {
  dispatchId: string;
  subjectId: string;
  previousReviewId: string | null;
  reviewKind: string;
  decision: string;
  note: string;
};
export function buildSupervisorPrivateExport(input: {
  campgroundId: string;
  asOf: string;
  sourceRevision: string | null;
  supervisor: {
    ownership: Array<{
      id: string;
      dispatchId: string;
      claimedByUserId: string | null;
    }>;
    mobile: Array<{
      id: string;
      dispatchId: string;
      deviceKind: string;
      outcome: string;
    }>;
    truncated: boolean;
  };
  continuity: {
    caseFollowups: Array<{
      dispatchId: string;
      subjectId: string;
      decision: string;
    }>;
    deviceReviews: Array<{
      dispatchId: string;
      subjectId: string;
      decision: string;
    }>;
    truncated: boolean;
  };
}): {
  schema: string;
  campgroundId: string;
  generatedAt: string;
  sourceRevision: string | null;
  source: string;
  audience: string;
  signedHealthReceipt: false;
  independentDeviceAcceptance: string;
  truncated: boolean;
  cases: Array<Record<string, unknown>>;
};
