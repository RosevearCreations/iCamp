export interface DeviceSignaturePacket {
  campgroundId: string; dispatchId: string; fieldReportId: string;
  originalReviewId: string; sourceRevision: string;
  evidenceDigestSha256: string; keyId: string; nonce: string;
  issuedAt: string; signatureBase64: string;
}
export interface DeviceTrustPin {
  keyId: string; publicKeySpkiBase64: string;
  independentlyAuthenticatedSpkiFingerprint: string;
}
export function buildDeviceSigningMessage(packet: DeviceSignaturePacket): string;
export function verifyOriginalDevicePacket(input: {
  packet: DeviceSignaturePacket;
  expected: Pick<DeviceSignaturePacket,"campgroundId"|"dispatchId"|"fieldReportId"|"originalReviewId"|"sourceRevision"|"evidenceDigestSha256">;
  trust: DeviceTrustPin | null; asOf: string;
}): {
  status: string; accepted: boolean; keyId?: string; fingerprint?: string;
  nonceDigestSha256?: string; messageDigestSha256?: string;
  sourceRevision?: string; deviceAcceptance?: string; masterConnection?: string;
};
export function validateCalibrationClosure(input: {
  checkpointId: string; followupId: string; previousClosureId?: string | null;
  decision: string; explanation: string;
}): {
  checkpointId: string; followupId: string; previousClosureId: string | null;
  decision: string; explanation: string;
};
export interface DossierSnapshot { id: string; digestSha256: string; }
export function buildDossierContinuity(input: {
  campgroundId: string; sourceRevision: string; previousSnapshot: DossierSnapshot | null;
  evidenceSummary: {
    campgroundId: string; ownerProductionAcceptance: string;
    masterConnection: string; schema: string; trust: string;
    witnessStatementCount: number;
    originalDeviceReviews: unknown[]; forecastCalibration: unknown[];
    ownerAuditDecisions: unknown[]; completeness: string;
  };
}): {
  schema: string; campgroundId: string; sourceRevision: string;
  evidenceSchema: string; reportTrust: string; witnessCount: number;
  deviceReviewCount: number; forecastCount: number; auditedCount: number;
  completeness: string; previousId: string | null; previousDigest: string | null;
  ownerAcceptance: string; masterConnection: string; digestSha256: string;
};
