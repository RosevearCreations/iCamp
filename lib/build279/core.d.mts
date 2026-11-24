export const RESTORE_SCOPES279: readonly string[];
export function validateCorrelation279(input: {
  fieldReviewId: string;
  providerReceiptId: string;
  evidenceDigest: string;
}): {
  fieldReviewId: string;
  providerReceiptId: string;
  evidenceDigest: string;
};
export function validateRecoveryAudit279(input: {
  mfaReadbackId: string;
  evidenceDigest: string;
}): { mfaReadbackId: string; evidenceDigest: string };
export function validateRestoreFinalization279(input: {
  serviceReadbackId: string;
  backupDigest: string;
  tenantDigest: string;
  reservationDigest: string;
  paymentDigest: string;
  healthDigest: string;
  comparisonDigest: string;
}): {
  serviceReadbackId: string;
  backupDigest: string;
  tenantDigest: string;
  reservationDigest: string;
  paymentDigest: string;
  healthDigest: string;
  comparisonDigest: string;
};
export interface OriginalPairRow279 {
  source_id: string;
  key_id: string;
  commit_sha: string;
  challenge_id: string;
  request_nonce: string;
  issued_at: string | Date;
  expires_at: string | Date;
  field_accepted_at: string | Date;
  field_reviewed_at: string | Date;
  correlated_at: string | Date | null;
  field_body: string;
  field_signature: string;
  field_sha256: string;
  provider_body: string;
  provider_signature: string;
  provider_sha256: string;
  provider_received_at: string | Date;
  field_review_id?: string;
  signed_receipt_id?: string;
}
export function verifyOriginalCorrelation279(
  row: OriginalPairRow279,
  pins: Record<
    string,
    { keyId: string; commitSha: string; publicKeyPem: string }
  >,
  now?: number,
): {
  source: string;
  keyId: string;
  commitSha: string;
  fieldDigest: string;
  providerDigest: string;
};
export function summarizeCorrelation279(
  rows: OriginalPairRow279[],
  pins: Record<
    string,
    { keyId: string; commitSha: string; publicKeyPem: string }
  >,
  now?: number,
): {
  sources: {
    source: string;
    status: string;
    fieldReviewId: string | null;
    signedReceiptId: string | null;
    correlated: boolean;
  }[];
  verifiedCount: number;
  status: string;
};
export function summarizeRecoveryAudit279(
  owner: { status: string },
  session: {
    user: { id: string; username?: string | null };
    assuranceLevel: string;
    sessionId: string;
  },
  readback: { sessionId: string; ownerId: string } | null,
): { status: string };
export function summarizeIsolatedFinalization279(
  rows: { finalized: boolean }[],
): {
  finalizedCount: number;
  status: string;
  productionRestored: boolean;
  providerCertified: boolean;
};
export function classifyClosure279(input: {
  admission: { adopted: boolean; host: { pinned: boolean } };
  peers: { verifiedCount: number };
  owner: { status: string };
  restore: { finalizedCount: number };
}): {
  status: string;
  productionRestored: boolean;
  providerCertified: boolean;
};
