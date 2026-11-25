export const PROVIDER_CLOSURE_KIND280: string;
export function digest280(raw: string | Buffer): string;
export function validateProviderKey280(input: {
  providerId: string;
  keyId: string;
  fingerprint: string;
  evidenceDigest: string;
  publicKeyPem: string;
}): {
  providerId: string;
  keyId: string;
  fingerprint: string;
  evidenceDigest: string;
  publicKeyPem: string;
};
export function validateProviderKeyReview280(input: {
  proposalId: string;
  evidenceDigest: string;
}): { proposalId: string; evidenceDigest: string };
export function scopeDigest280(record: Record<string, string>): string;
export function verifyProviderClosure280(input: {
  body: string;
  signature: string;
  providerKey: {
    providerId: string;
    keyId: string;
    publicKeyPem: string;
  };
  original: {
    providerId: string;
    sourceHostSha256: string;
    isolatedHostSha256: string;
    backupManifestSha256: string;
    scopeDigestSha256: string;
  };
  now?: number;
}): {
  kind: string;
  providerId: string;
  keyId: string;
  providerEventId: string;
  nonce: string;
  sourceHostSha256: string;
  isolatedHostSha256: string;
  backupManifestSha256: string;
  scopeDigestSha256: string;
  observedAt: string;
  digest: string;
};
export function validateOwnerCompletion280(input: {
  ownerAuditId: string;
  evidenceDigest: string;
}): { ownerAuditId: string; evidenceDigest: string };
export function validateCertificate280(input: {
  providerClosureId: string;
  ownerWitnessId: string;
  evidenceDigest: string;
}): {
  providerClosureId: string;
  ownerWitnessId: string;
  evidenceDigest: string;
};
export function classifyCertificate280(input: {
  admission: { adopted: boolean; host: { pinned: boolean } };
  providerSigned: boolean;
  ownerWitness: boolean;
  sources: number;
  certificateStored: boolean;
}): {
  status: string;
  originalEvidenceReady: boolean;
  productionRestored: boolean;
  externalProviderFinalAck: boolean;
};
