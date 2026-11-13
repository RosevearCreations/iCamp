// Build 250 private owner-scoped ceremony controls and source-only readbacks.
export function assessOwnerSupervisedCeremony(input: {
  userId: string;
  campgroundId: string;
}): Promise<{
  sourceRevision: string | null;
  dossier: { status: string; currentSourceCountsMatch?: boolean };
  sourceHealthy: {
    status: string;
    sourceHealthyVerified: boolean;
    sourceNonceDigestSha256?: string;
    receiptDigestSha256?: string;
  };
  masters: {
    decision: string;
    allIndependentlySigned: boolean;
    connected: false;
    evidence: Array<{ plane: string; status: string }>;
  };
  gate: {
    status: string;
    supervisedReviewEligible: boolean;
    dossierSnapshotId?: string;
    verifiedPacketId?: string;
    witnessId: string | null;
    dossierDigestSha256?: string;
  };
  masterEvidenceDigestSha256: string | null;
  sourceReceiptDigestSha256: string | null;
}>;
export function listOwnerSupervisedDecisions(input: {
  userId: string;
  campgroundId: string;
}): Promise<{
  decisions: Array<{
    id: string;
    sourceRevision: string;
    dossierSnapshotId: string | null;
    decision: string;
    recordedAt: string;
  }>;
  truncated: boolean;
  ownerProductionAcceptance: "HOLD";
  masterConnected: false;
}>;
export function recordOwnerSupervisedDecision(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  decision: string;
  explanation: string;
}): Promise<{
  id: string;
  decision: string;
  ownerProductionAcceptance: "HOLD";
  masterConnected: false;
}>;
