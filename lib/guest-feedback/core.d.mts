export const feedbackCategories: readonly string[];
export const feedbackRecoveryStages: readonly string[];
export function feedbackUuid(value: unknown, label?: string): string;
export function feedbackText(
  value: unknown,
  label: string,
  min: number,
  max: number,
): string;
export function normalizeGuestFeedback(input: {
  rating: unknown;
  category: unknown;
  title: unknown;
  publicSummary: unknown;
  privateDetails: unknown;
  publicRequested: boolean;
  assistanceCaseId: unknown;
}): {
  rating: number;
  category: string;
  title: string;
  publicSummary: string;
  privateDetails: string;
  publicRequested: boolean;
  assistanceCaseId: string | null;
};
export function normalizeFeedbackDecision(input: {
  decision: unknown;
  reason: unknown;
}): { decision: string; reason: string };
export function normalizeFeedbackAppeal(value: unknown): string;
export function feedbackDate(value: unknown): string;
export function normalizeFeedbackRecovery(input: {
  stage: unknown;
  dueDate: unknown;
  internalNote: unknown;
}): {
  stage: string;
  dueDate: string | null;
  internalNote: string;
  guestVisibleSummary: string;
};
export function recoveryResponseTemplate(stage: string): string;
export function feedbackPublicLabel(review: { rating: number }): string;
