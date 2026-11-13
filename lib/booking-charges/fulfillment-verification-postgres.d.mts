import type { DeviceSignaturePacket } from "./fulfillment-verification-core.mjs";
export function devicePinStatus(): string;
export function listVerificationContinuityEvidence(input: {
  userId: string;
  campgroundId: string;
  owner?: boolean;
}): Promise<{
  verifiedSourcePackets: Array<{
    id: string;
    dispatchId: string;
    originalReviewId: string;
    signerKeyId: string;
    signerFingerprint: string;
    sourceRevision: string;
    decision: string;
    verifiedAt: string;
  }>;
  calibrationClosures: Array<{
    id: string;
    checkpointId: string;
    latestFollowupId: string;
    previousClosureId: string | null;
    decision: string;
    reviewedAt: string;
  }>;
  dossierSnapshots: Array<{
    id: string;
    campgroundId: string;
    previousSnapshotId: string | null;
    sourceRevision: string;
    digestSha256: string;
    previousDigestSha256: string | null;
    evidenceSchema: string;
    completeness: string;
    witnessCount: number;
    deviceReviewCount: number;
    forecastCount: number;
    auditedCount: number;
    recordedAt: string;
  }>;
  dossierWindowTruncated: boolean;
  truncated: boolean;
  originalDeviceIndependentAcceptance: string;
  masterConnected: string;
  ownerProductionAcceptance: string;
  pinStatus: string;
}>;
export function recordDeviceSignatureVerification(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  packet: DeviceSignaturePacket;
}): Promise<{ id: string; status: string }>;
export function recordOwnerCalibrationClosure(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  checkpointId: string;
  followupId: string;
  previousClosureId?: string | null;
  decision: string;
  explanation: string;
}): Promise<{ id: string }>;
export function captureOwnerDossierContinuity(input: {
  actorUserId: string;
  actorSessionId?: string | null;
  campgroundId: string;
  evidenceSummary: Record<string, unknown>;
}): Promise<{ id: string; digestSha256: string }>;
