export function originalAdmission276(): Promise<{
  adopted: boolean;
  hostPinned: boolean;
  status: string;
}>;
export function proposePeerSigner276(input: {
  actorId: string;
  sourceId: string;
  keyId: string;
  commitSha: string;
  publicKeyPem: string;
  keyFingerprint: string;
  evidenceDigest: string;
}): Promise<{ stored: boolean; status: string }>;
export function approvePeerSigner276(input: {
  reviewerId: string;
  proposalId: string;
  reviewDigest: string;
}): Promise<{ stored: boolean; status: string }>;
export function approvedPeerPins276(): Promise<
  Record<
    string,
    {
      keyId: string;
      commitSha: string;
      publicKeyPem: string;
    }
  >
>;
export function originalPeerOverview276(): Promise<{
  admission: { adopted: boolean; hostPinned: boolean; status: string };
  status: string;
  proposals: {
    id: string;
    sourceId: string;
    keyId: string;
    commitSha: string;
    fingerprint: string;
    reviewed: boolean;
  }[];
}>;
export function actualOwnerReadback276(session: {
  user: { username?: string | null };
  assuranceLevel: string;
}): Promise<{
  status: string;
  checks: { id: string; status: string; detail: string }[];
}>;
export function signedPeerReadback276(): Promise<{
  status: string;
  sources: { source: string; status: string }[];
  verifiedCount: number;
  admission: { adopted: boolean; hostPinned: boolean; status: string };
}>;
export function acceptIndependentHandshake276(
  body: string,
  signature: string | null,
): Promise<{ accepted: boolean; status: string }>;
export function originalRestoreReadback276(): Promise<{
  admission: { adopted: boolean; hostPinned: boolean; status: string };
  status: string;
  records: { id: string; providerId: string; reviewed: boolean }[];
  reviewed: number;
}>;
export function recordIndependentRestoreReview276(input: {
  reviewerId: string;
  attestationId: string;
  evidenceDigest: string;
}): Promise<{ stored: boolean; status: string }>;
