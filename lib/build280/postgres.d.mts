export function originalAdmission280(): Promise<{
  adopted: boolean;
  host: { configured: boolean; pinned: boolean; status: string };
  status: string;
}>;
export function proposeExternalProviderKey280(input: {
  actorId: string;
  providerId: string;
  keyId: string;
  publicKeyPem: string;
  fingerprint: string;
  evidenceDigest: string;
}): Promise<{ status: string }>;
export function reviewExternalProviderKey280(input: {
  reviewerId: string;
  proposalId: string;
  evidenceDigest: string;
}): Promise<{ status: string }>;
export function recordProviderSignedClosure280(input: {
  reviewerId: string;
  keyReviewId: string;
  isolatedEvidenceId: string;
  body: string;
  signature: string;
}): Promise<{ status: string }>;
export function witnessOwnerRecovery280(input: {
  reviewerId: string;
  ownerAuditId: string;
  evidenceDigest: string;
}): Promise<{ status: string }>;
export function recordIsolatedAcceptanceCertificate280(input: {
  reviewerId: string;
  providerClosureId: string;
  ownerWitnessId: string;
  evidenceDigest: string;
}): Promise<{ status: string }>;
export function acceptanceSummary280(): Promise<{
  admission: {
    adopted: boolean;
    host: { configured: boolean; pinned: boolean; status: string };
    status: string;
  };
  status: string;
  keyProposals: {
    id: string;
    providerId: string;
    keyId: string;
    fingerprint: string;
    reviewed: boolean;
    reviewId: string | null;
  }[];
  providerClosures: {
    id: string;
    providerId: string;
    originalSignatureVerified: boolean;
  }[];
  ownerCandidates: { id: string }[];
  ownerWitnesses: { id: string }[];
  certificates: {
    id: string;
    providerClosureId: string;
    ownerWitnessId: string;
  }[];
  sourceCount: number;
  closure: {
    status: string;
    originalEvidenceReady: boolean;
    productionRestored: boolean;
    externalProviderFinalAck: boolean;
  };
}>;
