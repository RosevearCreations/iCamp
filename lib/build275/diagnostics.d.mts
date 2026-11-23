export const SOURCES275: readonly string[];
export interface Pin275 {
  keyId: string;
  commitSha: string;
  publicKeyPem: string;
}
export function pins275(raw?: string): Record<string, Pin275>;
export function verifySigned275(input: {
  body: string;
  signature: string | null;
  pins: Record<string, Pin275>;
  now?: number;
}): {
  source: string;
  keyId: string;
  commitSha: string;
  challengeId: string;
  nonce: string;
  observedAt: string;
  body: string;
  signature: string;
  digest: string;
};
export function classify275(input: {
  host: { hostPinned: boolean; adopted: boolean };
  owner: {
    identifiedOriginalHost?: boolean;
    accountFound?: boolean;
    accountActive?: boolean;
    credentialPresent?: boolean;
    mfaVerified?: boolean;
    recoveryEmailVerified?: boolean;
    platformGrantActive?: boolean;
    independentOwnerBinding?: boolean;
  } | null;
  session: { originalRosevear: boolean; aal2: boolean } | null;
  ledger: { schemaReady: boolean; receipts: { source: string; observedAt: string }[] };
  configured?: string[];
  now?: number;
}): {
  hostStatus: string;
  ownerStatus: string;
  handshakeStatus: string;
  signedCount: number;
  checks: { source: string; status: string }[];
  closureStatus: string;
};
