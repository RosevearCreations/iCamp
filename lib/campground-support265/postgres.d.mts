export interface LocalSupportCase265 {
  id: string;
  category: string;
  severity: string;
  title: string;
  description: string;
  status: string;
  createdAt: string;
  reviewedAt: string | null;
  version: number;
}
export function listLocalSupport265(input: {
  userId: string;
  campgroundId: string;
}): Promise<{
  status: string;
  cases: LocalSupportCase265[];
  metrics: {
    observed: number;
    open: number;
    triaged: number;
    resolved: number;
    criticalOpen: number;
    lockedOpen: number;
    performanceOpen: number;
    coverageCapped: boolean;
  };
}>;
export function submitLocalSupport265(input: {
  userId: string;
  sessionId: string | null;
  campgroundId: string;
  input: Record<string, unknown>;
}): Promise<string>;
export function transitionLocalSupport265(input: {
  userId: string;
  sessionId: string | null;
  campgroundId: string;
  caseId: string;
  version: number;
  status: string;
}): Promise<string>;
export function listPlatformSupportAggregates265(): Promise<{
  status: string;
  total: number;
  open: number;
  critical: number;
  locked: number;
  performance: number;
  triaged: number;
  limited: boolean;
}>;
export function listOwnSafetyAcknowledgements265(input: {
  guestUserId: string;
}): Promise<{
  status: string;
  allocationIds: string[];
}>;
export function recordGuestSafetyAcknowledgement265(input: {
  guestUserId: string;
  sessionId: string | null;
  input: Record<string, unknown>;
}): Promise<{ acknowledged: boolean; newlyRecorded: boolean }>;
export interface LocalCustody265 {
  status: string;
  events: Array<{
    id: string;
    allocationId: string;
    eventKind: string;
    evidenceReference: string;
    conditionNote: string;
    recordedAt: string;
  }>;
  witnesses: Array<{
    id: string;
    pilotReviewId: string;
    siteReference: string;
    supervisionReference: string;
    safetyRestrictions: string;
    witnessedAt: string;
  }>;
}
export function listLocalCustody265(input: {
  userId: string;
  campgroundId: string;
}): Promise<LocalCustody265>;
export function recordLocalCustody265(input: {
  userId: string;
  sessionId: string | null;
  campgroundId: string;
  input: Record<string, unknown>;
}): Promise<string>;
export function recordLocalWitness265(input: {
  userId: string;
  sessionId: string | null;
  campgroundId: string;
  input: Record<string, unknown>;
}): Promise<string>;
export function closeCampgroundSupportPool265ForTests(): Promise<void>;

export function listPlatformResponseSla266(): Promise<{
  status: string;
  metrics: null | {
    observed: number;
    unresolved: number;
    overdueResponse: number;
    responseObserved: number;
    responseUnknown: number;
    missingTimestamp: number;
    bySeverity: { critical: number; priority: number; routine: number };
  };
}>;
