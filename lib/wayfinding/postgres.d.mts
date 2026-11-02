export interface WayfindingCandidate {
  id: string;
  code: string;
  kind: string;
  name: string;
  lifecycleState: string;
  eligible: boolean;
  mapPublished: boolean;
  bindingKind: string | null;
  publication: {
    isPublished: boolean;
    description: string;
    accessibilityNote: string;
    landmarkHint: string;
    rowVersion: number;
    reviewedAt: string | Date | null;
  };
}
export function listWayfindingCandidates(input: {
  userId: string;
  campgroundId: string;
}): Promise<WayfindingCandidate[]>;
export function saveWayfindingReview(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  mapObjectId: string;
  expectedRowVersion: number;
  input: {
    isPublished?: boolean;
    description?: unknown;
    accessibilityNote?: unknown;
    landmarkHint?: unknown;
  };
}): Promise<{ isPublished: boolean }>;
export function closeWayfindingPoolForTests(): Promise<void>;
