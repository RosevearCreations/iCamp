export interface OriginalSourceHealthyReceipt {
  sourceId: string;
  campgroundId: string;
  sourceRevision: string;
  dossierDigestSha256: string;
  issuedAt: string;
  nonce: string;
  keyId: string;
  decision: string;
  signatureBase64: string;
}
export interface SourceHealthyTrust {
  keyId: string;
  publicKeySpkiBase64: string;
  independentlyAuthenticatedSpkiFingerprint: string;
}
export function sha256(value: string): string;
export function sourceHealthyMessage(
  receipt: OriginalSourceHealthyReceipt,
): string;
export function verifySourceHealthyCeremony(input: {
  campgroundId: string;
  sourceRevision: string | null;
  dossierDigestSha256: string | undefined;
  receipt: OriginalSourceHealthyReceipt | null;
  trust: SourceHealthyTrust | null;
  custodianEnrolled: boolean;
  asOf: string;
}): {
  status: string;
  sourceHealthyVerified: boolean;
  sourceSignerAuthority: string;
  receiptDigestSha256?: string;
  sourceNonceDigestSha256?: string;
  masterConnected: false;
  ownerProductionAcceptance: "HOLD";
};
export function evaluateBuild250OwnerGate(input: {
  campgroundId: string;
  sourceRevision: string | null;
  dossierIntegrity: {
    status: string;
    currentSourceCountsMatch?: boolean;
  } | null;
  dossierSnapshots: Array<{
    id: string;
    campgroundId: string;
    sourceRevision: string;
    digestSha256: string;
  }> | null;
  signedSourceHealthy: { sourceHealthyVerified: boolean } | null;
  crossMasterEvidence: {
    allIndependentlySigned: boolean;
    sourceRevision: string | null;
    connected: boolean;
    evidence: Array<{ plane: string; status: string }>;
  } | null;
  originalDeviceWitnesses: Array<{
    id: string;
    sourceRevision: string;
    signatureVerificationId: string;
    dispatchId: string;
    originalReviewId: string;
    decision: string;
    admittedAt: string;
  }> | null;
  verifiedSourcePackets: Array<{
    id: string;
    sourceRevision: string;
    dispatchId: string;
    originalReviewId: string;
    decision: string;
  }> | null;
  asOf: string;
}): {
  status: string;
  witnessId: string | null;
  verifiedPacketId?: string;
  dossierSnapshotId?: string;
  dossierDigestSha256?: string;
  supervisedReviewEligible: boolean;
  masterConnected: false;
  ownerProductionAcceptance: "HOLD";
};
export function validateBuild250OwnerDecision(input: {
  decision: string;
  explanation: string;
  eligible: boolean;
}): {
  decision: string;
  explanation: string;
  operationalAcceptance: "HOLD";
  masterConnected: false;
};
