export function ageBand(
  when: unknown,
  now?: number,
): "unknown" | "within_24h" | "overdue_24h" | "critical_72h";
export function normalizeExceptionReview(input: Record<string, unknown>): {
  id: string;
  consentId: string;
  reconciliationId: string | null;
  exceptionEventId: string | null;
  observationState: string;
  reviewDecision: string;
  nextReviewAt: string;
  evidenceReference: string;
  note: string;
};
export function normalizeOwnerEscalation(input: Record<string, unknown>): {
  id: string;
  exceptionReviewId: string;
  targetOwnerUserId: string;
  priority: string;
  escalationReference: string;
  requestedAction: string;
  dueAt: string;
};
export function normalizeOwnerResponse(input: Record<string, unknown>): {
  id: string;
  escalationId: string;
  response: string;
  evidenceReference: string;
  note: string;
};
