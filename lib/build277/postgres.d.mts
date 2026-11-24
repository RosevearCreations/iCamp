export function originalAdmission277(): Promise<{
  host: { configured: boolean; pinned: boolean; status: string };
  adopted: boolean;
  status: string;
}>;
export function adoptOwnerPeer277(input: {
  proposalId: string;
  evidenceDigest: string;
  session: {
    sessionId: string;
    assuranceLevel: string;
    user: { id: string; username?: string | null };
  };
}): Promise<{ stored: boolean; status: string }>;
export function ownerAdoptedPins277(): Promise<
  Record<
    string,
    {
      keyId: string;
      commitSha: string;
      publicKeyPem: string;
    }
  >
>;
export function issueFieldChallenge277(
  body: string,
  signature: string | null,
): Promise<{
  challengeId: string;
  expiresAt: string;
  source: string;
  status: string;
}>;
export function recordFieldResponse277(
  body: string,
  signature: string | null,
): Promise<{
  accepted: boolean;
  status: string;
}>;
export function fieldReadback277(): Promise<{
  admission: {
    host: { configured: boolean; pinned: boolean; status: string };
    adopted: boolean;
    status: string;
  };
  checks: { source: string; status: string }[];
  count: number;
  status: string;
  adopted: {
    sourceId: string;
    keyId: string;
    commitSha: string;
    fingerprint: string;
  }[];
}>;
export function recordExternalRestore277(input: {
  reviewerId: string;
  closureReviewId: string;
  evidenceDigest: string;
  sourceHostDigest: string;
  isolatedHostDigest: string;
}): Promise<{ stored: boolean; status: string; productionRestored: boolean }>;
export function externalRestoreReadback277(): Promise<{
  admission: {
    host: { configured: boolean; pinned: boolean; status: string };
    adopted: boolean;
    status: string;
  };
  reviewed: number;
  status: string;
  actualRestoreExecuted: boolean;
  records: { closureId: string; providerId: string; reviewed: boolean }[];
}>;
export function acceptanceSummary277(session: {
  sessionId: string;
  assuranceLevel: string;
  user: { id: string; username?: string | null };
}): Promise<{
  admission: {
    host: { configured: boolean; pinned: boolean; status: string };
    adopted: boolean;
    status: string;
  };
  owner: {
    status: string;
    checks: { id: string; status: string; detail: string }[];
  };
  peer: {
    checks: { source: string; status: string }[];
    count: number;
    status: string;
    adopted: {
      sourceId: string;
      keyId: string;
      commitSha: string;
      fingerprint: string;
    }[];
  };
  restore: {
    reviewed: number;
    status: string;
    actualRestoreExecuted: boolean;
    records: { closureId: string; providerId: string; reviewed: boolean }[];
  };
  closure: { status: string; productionRestored: boolean };
}>;
