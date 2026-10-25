import type { HandoffOutcomeInput, HandoffResolutionInput } from "./core.mjs";
export interface OwnerHandoffOutcome {
  id: string;
  planId: string;
  sourceCampgroundId: string;
  targetCampgroundId: string;
  outcomeKind: string;
  nextActionAt: string | null;
  evidenceReference: string;
  ownerNote: string;
  recordedAt: string;
}
export interface OwnerHandoffResolution {
  id: string;
  planId: string;
  latestOutcomeId: string;
  sourceCampgroundId: string;
  targetCampgroundId: string;
  resolutionKind: string;
  evidenceReference: string;
  ownerNote: string;
  resolvedAt: string;
}
export function getOwnerHandoffEvidence(
  actorUserId: string,
  authorizedCampgroundIds: string[],
): Promise<{
  outcomes: OwnerHandoffOutcome[];
  resolutions: OwnerHandoffResolution[];
  outcomesLimited: boolean;
  resolutionsLimited: boolean;
}>;
export function recordOwnerHandoffOutcome(
  input: HandoffOutcomeInput & { actorUserId: string },
): Promise<string>;
export function recordOwnerHandoffResolution(
  input: HandoffResolutionInput & { actorUserId: string },
): Promise<string>;
