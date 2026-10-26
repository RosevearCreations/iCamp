export const reassessmentKinds: string[];
export const agingFilters: string[];
export function normalizeAgingFilter(raw?: unknown): string;
export function classifyOwnerDecisionAging(
  raw: {
    decisionKind: string;
    assessmentKind?: string | null;
    effectiveDueAt?: string | null;
  },
  now?: Date,
): string;
export function normalizeOwnerDecisionReassessment(
  raw: Record<string, unknown>,
  now?: Date,
): {
  id: string;
  decisionId: string;
  sourceCampgroundId: string;
  targetCampgroundId: string;
  assessmentKind: string;
  basisCaseId: string | null;
  nextDueAt: string | null;
  evidenceReference: string;
  reassessmentNote: string;
};
