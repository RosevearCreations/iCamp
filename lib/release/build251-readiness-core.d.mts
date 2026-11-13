export const BUILD251_TABLES: readonly string[];
export function sha256(bytes: string | Uint8Array): string;
export function classifyProductionDatabase(input: {
  sourceRevision: string | null;
  databaseConfigured: boolean;
  expectedHost: string | null;
  runtimeHost: string | null;
  querySucceeded: boolean;
  tables: Array<{
    name: string;
    present: boolean;
    rowLevelSecurity: boolean;
    forceRowLevelSecurity: boolean;
    policyCount: number;
    appendOnly: boolean;
    hasGuardTrigger: boolean;
  }>;
}): {
  status: string;
  runtimeTargetPinMatches: boolean;
  sourceRevision: string | null;
  checklist: Array<{
    name: string;
    present: boolean;
    rowLevelSecurity: boolean;
    forceRowLevelSecurity: boolean;
    ownerOnlyPolicies: boolean;
    appendOnly: boolean;
    hasGuardTrigger: boolean;
  }>;
  schemaVerified: boolean;
  independentlyApprovedProductionDatabase: false;
  masterConnected: false;
};
export interface SourceSignerPin {
  keyId: string;
  publicKeySpkiBase64: string;
  independentlyAuthenticatedSpkiFingerprint: string;
}
export interface CustodyReceipt {
  sourceId: string;
  sourceRevision: string;
  originalSignerFingerprintSha256: string;
  reviewerKeyId: string;
  observedAt: string;
  nonce: string;
  decision: string;
  signatureBase64: string;
}
export function custodyAttestationMessage(receipt: CustodyReceipt): string;
export function inspectOriginalSignerEnrollment(input: {
  sourceRevision: string | null;
  originalPin: SourceSignerPin | null;
  originalCustodianEnrolled: boolean;
  reviewerPin: SourceSignerPin | null;
  reviewerReceipt: CustodyReceipt | null;
  asOf: string;
}): {
  status: string;
  originalPinConfigured: boolean;
  independentReviewerAttested: boolean;
  receiptDigestSha256?: string;
  operationalSourceHealthy: false;
  masterConnected: false;
  ownerProductionAcceptance: "HOLD";
};
export interface ManualThemeReport {
  schema: string;
  formFactor: string;
  visual: string;
  sourceRevision: string;
  deviceId: string;
  recordedAt: string;
  checks: {
    heroVisible: boolean;
    navigationUsable: boolean;
    textReadable: boolean;
    noHorizontalOverflow: boolean;
  };
}
export function assessCrossDeviceThemeAcceptance(input: {
  records: ManualThemeReport[];
  sourceRevision: string | null;
  asOf: string;
}): {
  status: string;
  completed: string[];
  manualChecksComplete: boolean;
  independentAcceptance: false;
  authorizationGranted: false;
};
