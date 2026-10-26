export interface ExceptionScope {
  id: string;
  sourceCampgroundId: string;
  targetCampgroundId: string;
}
export interface ExceptionCaseInput extends ExceptionScope {
  exportAcceptanceId: string;
  issueKind: string;
  actionDueAt: string;
  evidenceReference: string;
  issueNote: string;
}
export interface ExceptionOutcomeInput extends ExceptionScope {
  caseId: string;
  actionKind: string;
  nextDueAt?: string;
  evidenceReference: string;
  actionNote: string;
}
export interface ExceptionReviewInput extends ExceptionScope {
  caseId: string;
  outcomeId: string;
  reviewKind: string;
  evidenceReference: string;
  reviewNote: string;
}
export function normalizeExportExceptionCase(
  raw: ExceptionCaseInput,
  now?: Date,
): Omit<ExceptionCaseInput, "actionDueAt"> & { actionDueAt: string };
export function normalizeExportExceptionOutcome(
  raw: ExceptionOutcomeInput,
  now?: Date,
): Omit<ExceptionOutcomeInput, "nextDueAt"> & { nextDueAt: string | null };
export function normalizeExportExceptionReview(
  raw: ExceptionReviewInput,
): ExceptionReviewInput;
export function activeExportException(
  reconciliation: { result: string } | undefined,
  retention: { eventKind: string; retentionDueAt: string | null } | undefined,
  now?: Date,
): string | null;
export function exceptionCorrectionReady(
  issueKind: string,
  reconciliation: { result: string } | undefined,
  retention: { eventKind: string; retentionDueAt: string | null } | undefined,
  now?: Date,
): boolean;
