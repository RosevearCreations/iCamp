export interface HandoffOutcomeInput {
  id: unknown;
  planId: unknown;
  sourceCampgroundId: unknown;
  targetCampgroundId: unknown;
  outcomeKind: unknown;
  nextActionAt: unknown;
  evidenceReference: unknown;
  ownerNote: unknown;
}
export interface HandoffResolutionInput {
  id: unknown;
  planId: unknown;
  sourceCampgroundId: unknown;
  targetCampgroundId: unknown;
  latestOutcomeId: unknown;
  resolutionKind: unknown;
  evidenceReference: unknown;
  ownerNote: unknown;
}
export interface OutcomeForClassification {
  id: string;
  planId: string;
  outcomeKind: string;
  recordedAt: string;
}
export function normalizeHandoffOutcome(
  input: HandoffOutcomeInput,
  now?: Date,
): {
  id: string;
  planId: string;
  sourceCampgroundId: string;
  targetCampgroundId: string;
  outcomeKind: string;
  nextActionAt: string | null;
  evidenceReference: string;
  ownerNote: string;
};
export function normalizeHandoffResolution(input: HandoffResolutionInput): {
  id: string;
  planId: string;
  sourceCampgroundId: string;
  targetCampgroundId: string;
  latestOutcomeId: string;
  resolutionKind: string;
  evidenceReference: string;
  ownerNote: string;
};
export function latestOutcomesByPlan<T extends OutcomeForClassification>(
  outcomes: T[],
): Map<string, T>;
export function canResolveOutcome(
  outcome: OutcomeForClassification | undefined,
  resolved: boolean,
): boolean;
