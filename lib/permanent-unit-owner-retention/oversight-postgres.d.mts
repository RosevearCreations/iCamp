export interface OwnerExportOversightReport {
  asOf: string;
  start: string;
  days: number;
  selectedSource: string | null;
  selectedTarget: string | null;
  campgrounds: { id: string; name: string }[];
  campgroundsLimited: boolean;
  summary: {
    casesOpened: number;
    affectedReceipts: number;
    independentlyClosed: number;
    notClosed: number;
    overdueActions: number;
    awaitingReview: number;
    returnedForFollowup: number;
    escalated: number;
    receiptsReopened: number;
    repeatedPairIssueGroups: number;
  };
  receipts: {
    accepted: number;
    missingReconciliation: number;
    mismatched: number;
    missingRetention: number;
    overdueRetention: number;
    disposalAttested: number;
  };
  groupsLimited: boolean;
  groups: {
    source: string;
    target: string;
    issueKind: string;
    casesOpened: number;
    affectedReceipts: number;
    independentlyClosed: number;
    overdueActions: number;
  }[];
  casesLimited: boolean;
  cases: {
    id: string;
    exportAcceptanceId: string;
    source: string;
    target: string;
    issueKind: string;
    openedAt: string;
    stage: string;
    dueAt: string | null;
  }[];
  weeks: {
    week: string;
    casesOpened: number;
    accepted: number;
    returned: number;
    escalated: number;
  }[];
}
export function getOwnerExportOversightReport(
  actorUserId: string,
  options?: { days?: unknown; source?: string; target?: string },
): Promise<OwnerExportOversightReport>;
