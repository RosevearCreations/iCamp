export interface OwnerOversightDecisionLedger {
  asOf: string;
  campgrounds: { id: string; name: string }[];
  source: string;
  target: string;
  reviewsLimited: boolean;
  decisionsLimited: boolean;
  casesLimited: boolean;
  reviews: {
    id: string;
    windowDays: number;
    issueKind: string;
    reviewKind: string;
    snapshotAsOf: string;
    casesObserved: number;
    openCasesObserved: number;
    repeatReceiptsObserved: number;
    nextReviewAt: string;
    evidenceReference: string;
    reviewNote: string;
    reviewedByUserId: string;
    reviewedAt: string;
  }[];
  decisions: {
    id: string;
    reviewId: string;
    basisCaseId: string | null;
    decisionKind: string;
    nextDueAt: string | null;
    evidenceReference: string;
    decisionNote: string;
    decidedByUserId: string;
    decidedAt: string;
  }[];
  cases: { id: string; issueKind: string; openedAt: string }[];
}
export function getOwnerOversightDecisionLedger(
  actorUserId: string,
  source: string,
  target: string,
): Promise<OwnerOversightDecisionLedger>;
export function createOwnerOversightReview(
  raw: Record<string, unknown> & { actorUserId: string },
): Promise<{
  id: string;
  cases_observed: number;
  open_cases_observed: number;
  repeat_receipts_observed: number;
}>;
export function appendOwnerOversightDecision(
  raw: Record<string, unknown> & { actorUserId: string },
): Promise<string>;
