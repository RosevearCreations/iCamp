export interface ProtectedDevicePin {
  keyId: string;
  publicKeySpkiBase64: string;
  independentlyAuthenticatedSpkiFingerprint: string;
}
export function assessDeviceVerifierPin(input: {
  custodianEnrolled: boolean;
  trust: ProtectedDevicePin | null;
}): { status: string; configured: boolean };
export interface OwnerDossierReadbackSnapshot {
  id: string;
  campgroundId: string;
  previousSnapshotId: string | null;
  sourceRevision: string;
  digestSha256: string;
  previousDigestSha256: string | null;
  completeness: string;
  witnessCount: number;
  deviceReviewCount: number;
  forecastCount: number;
  auditedCount: number;
  recordedAt: string;
}
export function auditOwnerDossierLineage(input: {
  campgroundId: string;
  snapshots: OwnerDossierReadbackSnapshot[];
  windowTruncated?: boolean;
}): {
  status: string;
  reviewedSnapshotCount: number;
  contentDigestRecomputed: false;
  independentSignatureVerified: false;
  ownerProductionAcceptance: "HOLD";
  masterConnection: "HOLD";
};
