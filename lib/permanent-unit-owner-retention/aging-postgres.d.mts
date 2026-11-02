export interface OwnerDecisionAgingReport {
  source: string;
  target: string;
  filter: string;
  asOf: string;
  campgrounds: { id: string; name: string }[];
  campgroundsLimited: boolean;
  itemsLimited: boolean;
  historyLimited: boolean;
  casesLimited: boolean;
  summary: {
    decisions: number;
    overdue: number;
    dueWeek: number;
    dueMonth: number;
    later: number;
    closureRecommended: number;
    closedNoAction: number;
    overdueOver30: number;
    independentlyReassessed: number;
  };
  items: {
    id: string;
    reviewId: string;
    issueKind: string;
    decisionKind: string;
    originalDueAt: string | null;
    effectiveDueAt: string | null;
    decidedAt: string;
    decidedByUserId: string;
    reassessmentId: string | null;
    assessmentKind: string | null;
    stage: string;
    ageDays: number;
    overdueDays: number;
    latestReassessedAt: string | null;
    observedUnclosedCases: number | null;
    newCasesSinceReview: number | null;
  }[];
  reassessments: {
    id: string;
    decisionId: string;
    reviewId: string;
    assessmentKind: string;
    basisCaseId: string | null;
    nextDueAt: string | null;
    observedUnclosedCases: number;
    newCasesSinceReview: number;
    evidenceReference: string;
    reassessmentNote: string;
    reassessedByUserId: string;
    reassessedAt: string;
  }[];
  cases: { id: string; issueKind: string; openedAt: string }[];
}
export function getOwnerDecisionAgingReport(
  actorUserId: string,
  source: string,
  target: string,
  options?: { filter?: string },
): Promise<OwnerDecisionAgingReport>;
export function recordIndependentOwnerDecisionReassessment(
  raw: Record<string, unknown> & { actorUserId: string },
): Promise<{
  id: string;
  observed_unclosed_cases: number;
  new_cases_since_review: number;
}>;
