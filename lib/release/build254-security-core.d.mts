export const MASTER_PLANES: readonly string[];
export const DECISIONS: readonly string[];
export const SECURITY_TIERS: readonly string[];
export function sha256(value: string): string;
export function evaluateThreeMasterFreshness(input: {
  sourceRevision: string | null;
  evidence: {
    sourceRevision?: string | null;
    evidence?: Array<{ plane: string; status: string }>;
  } | null;
  receipts: Array<{ plane: string; sourceRevision: string; issuedAt: string }>;
  asOf: string;
}): {
  schema: string;
  results: Array<{ plane: string; status: string; horizon: string }>;
  allCurrent: boolean;
  needsRenewal: boolean;
  independentlySignedSourceObserved: boolean;
  allThreeReceiversConnected: false;
  ownerProductionAcceptance: "HOLD";
};
export function validateRemediationDecision(input: {
  claimId: string;
  decision: string;
  explanation: string;
}): { claimId: string; decision: string; explanation: string };
export function prepareSignedReceiptClaim(input: {
  sourceRevision: string;
  receiptType: string;
  masterPlane: string | null;
  nonce: string;
  receiptDigestSha256: string;
  signerFingerprintSha256: string;
  issuedAt: string;
  cryptographicallyVerified: boolean;
  asOf: string;
}): {
  sourceRevision: string;
  receiptType: string;
  masterPlane: string | null;
  nonceDigestSha256: string;
  receiptDigestSha256: string;
  signerFingerprintSha256: string;
  issuedAt: string;
  decision: "signed_source_observed_hold";
  ownerAcceptance: "HOLD";
  masterConnected: false;
};
export function assessTieredSecurity(input: {
  sourceChecksumsMatch: boolean;
  independentlySignedDatabase: boolean;
  masterFreshness: { allCurrent: boolean } | null;
  tenantAuthenticated: boolean;
  independentDisposition: boolean;
  runtimeConnected: boolean;
}): {
  schema: string;
  tiers: Array<{ tier: string; status: string }>;
  threeMasterEvidenceCurrent: boolean;
  externalRuntimeConnected: false;
  ownerProductionAcceptance: "HOLD";
};
