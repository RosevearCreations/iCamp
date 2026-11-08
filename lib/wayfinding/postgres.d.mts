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
export interface AmenityServiceCandidate extends WayfindingCandidate {
  service?: {
    isPublished: boolean;
    operatingStatus: string;
    hoursSummary: string;
    accessibilityDetails: string;
    reviewedAt: string | Date | null;
    rowVersion: number;
  };
}
export function listAmenityServiceCandidates(input: {
  userId: string;
  campgroundId: string;
}): Promise<{ migrationReady: boolean; candidates: AmenityServiceCandidate[] }>;
export function saveAmenityServiceReview(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  mapObjectId: string;
  expectedRowVersion: number;
  input: {
    operatingStatus?: unknown;
    hoursSummary?: unknown;
    accessibilityDetails?: unknown;
    publish?: boolean;
    confirmed?: boolean;
  };
}): Promise<{ isPublished: boolean }>;
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
