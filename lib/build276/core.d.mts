export const UUID276: RegExp;
export const SHA276: RegExp;
export interface SignerInput276 {
  sourceId: string;
  keyId: string;
  commitSha: string;
  publicKeyPem: string;
  evidenceDigest: string;
  keyFingerprint: string;
}
export function validateSigner276(value: SignerInput276): SignerInput276;
export function validateRegistryRow276(row: {
  source_id: string;
  key_id: string;
  commit_sha: string;
  public_key_pem: string;
  evidence_sha256: string;
  key_fingerprint_sha256: string;
}): {
  sourceId: string;
  keyId: string;
  commitSha: string;
  publicKeyPem: string;
} | null;
export function classifyOwner276(
  owner: {
    identifiedOriginalHost?: boolean;
    accountFound?: boolean;
    accountActive?: boolean;
    credentialPresent?: boolean;
    recoveryEmailVerified?: boolean;
    platformGrantActive?: boolean;
    independentOwnerBinding?: boolean;
    mfaVerified?: boolean;
  } | null,
  ownerSession: { originalRosevear: boolean; aal2: boolean } | null,
  originalWitnesses: number,
): {
  status: string;
  checks: { id: string; status: string; detail: string }[];
};
export interface Receipt276 {
  source_id: string;
  key_id: string;
  commit_sha: string;
  signed_body: string;
  signature_b64url: string;
  body_sha256: string;
  observed_at: string | Date;
}
export function verifyReadback276(
  rows: Receipt276[],
  pins: Record<
    string,
    { keyId: string; commitSha: string; publicKeyPem: string }
  >,
  now?: number,
): {
  sources: { source: string; status: string }[];
  verifiedCount: number;
  status: string;
};
export function classifyRestore276(rows: { reviewed_at?: string | null }[]): {
  reviewed: number;
  status: string;
};
