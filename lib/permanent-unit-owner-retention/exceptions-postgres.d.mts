import type {
  ExceptionCaseInput,
  ExceptionOutcomeInput,
  ExceptionReviewInput,
} from "./exceptions-core.mjs";
import type {
  ExportReceiptRow,
  ReconciliationRow,
  RetentionEventRow,
} from "./postgres.mjs";
export interface OwnerExportExceptionCaseRow {
  id: string;
  exportAcceptanceId: string;
  sourceCampgroundId: string;
  targetCampgroundId: string;
  issueKind: string;
  basisReconciliationId: string | null;
  basisRetentionEventId: string | null;
  actionDueAt: string;
  evidenceReference: string;
  issueNote: string;
  openedByUserId: string;
  openedAt: string;
}
export interface OwnerExportExceptionOutcomeRow {
  id: string;
  caseId: string;
  exportAcceptanceId: string;
  actionKind: string;
  nextDueAt: string | null;
  resolutionReconciliationId: string | null;
  resolutionRetentionEventId: string | null;
  evidenceReference: string;
  actionNote: string;
  recordedByUserId: string;
  recordedAt: string;
}
export interface OwnerExportExceptionReviewRow {
  id: string;
  caseId: string;
  outcomeId: string;
  exportAcceptanceId: string;
  reviewKind: string;
  evidenceReference: string;
  reviewNote: string;
  reviewedByUserId: string;
  reviewedAt: string;
}
export function getOwnerExportExceptionLedger(
  actor: string,
  source: string | null,
  target: string | null,
): Promise<{
  receipts: ExportReceiptRow[];
  reconciliations: ReconciliationRow[];
  events: RetentionEventRow[];
  receiptsLimited: boolean;
  historyLimited: boolean;
  cases: OwnerExportExceptionCaseRow[];
  outcomes: OwnerExportExceptionOutcomeRow[];
  reviews: OwnerExportExceptionReviewRow[];
  casesLimited: boolean;
  exceptionHistoryLimited: boolean;
}>;
export function openOwnerExportException(
  input: ExceptionCaseInput & { actorUserId: string },
): Promise<string>;
export function recordOwnerExportExceptionOutcome(
  input: ExceptionOutcomeInput & { actorUserId: string },
): Promise<string>;
export function reviewOwnerExportException(
  input: ExceptionReviewInput & { actorUserId: string },
): Promise<string>;
