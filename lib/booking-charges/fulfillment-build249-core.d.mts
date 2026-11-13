export function validateOriginalDeviceWitness(input: {
  verificationId: string;
  decision: string;
  explanation: string;
}): { verificationId: string; decision: string; explanation: string };
export interface DossierSnapshot249 {
  id: string;
  campgroundId: string;
  sourceRevision: string;
  previousSnapshotId: string | null;
  previousDigestSha256: string | null;
  digestSha256: string;
  evidenceSchema: string;
  completeness: string;
  witnessCount: number;
  deviceReviewCount: number;
  forecastCount: number;
  auditedCount: number;
  recordedAt: string;
}
export function revalidateOwnerDossierSource(input: {
  campgroundId: string;
  snapshots: DossierSnapshot249[];
  windowTruncated?: boolean;
  currentRevision: string | null;
  currentEvidence: Record<string, unknown> | null;
}): {
  status: string;
  sourceWitnessAccepted: false;
  masterConnected: false;
  ownerProductionAcceptance: "HOLD";
  checked?: number;
  historicalDigestsVerified?: boolean;
  currentSourceCountsMatch?: boolean;
  externallyAnchored?: boolean;
};
export interface MasterReceipt {
  plane: string;
  sourceId: string;
  sourceRevision: string;
  issuedAt: string;
  nonce: string;
  keyId: string;
  decision: string;
  signatureBase64: string;
}
export interface MasterTrustPin {
  plane: string;
  keyId: string;
  publicKeySpkiBase64: string;
  independentlyAuthenticatedSpkiFingerprint: string;
}
export function masterReceiptMessage(receipt: MasterReceipt): string;
export function reconcileCrossMasterAcceptance(input: {
  sourceRevision: string | null;
  receipts: MasterReceipt[];
  pins: MasterTrustPin[];
  custodianEnrolled: boolean;
  asOf: string;
}): {
  schema: string;
  sourceId: "icamp";
  sourceRevision: string | null;
  evidence: Array<{ plane: string; status: string }>;
  allIndependentlySigned: boolean;
  sourceSignerAccepted: false;
  connected: false;
  ownerAccepted: false;
  decision: string;
};
