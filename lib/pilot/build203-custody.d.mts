export const BUILD203_STATE: string;
export const BUILD203_REVIEW_STATE: string;
export const BUILD203_OWNER_ACTIONS: readonly string[];
export function validateBuild203Custody(input: unknown): {
  campgroundId: string;
  evidenceId: string;
  issuerReceiptRef: string;
  issuerClaimedSha256: string;
  disposition: string;
};
export function validateBuild203OwnerIntent(
  input: unknown,
  now?: Date,
): {
  campgroundId: string;
  custodyReviewId: string;
  requestId: string;
  decision: string;
  expiresAt: string | null;
  scopeAcknowledged: boolean;
  disposition: string;
};
export function build203ReviewReadback(
  evidence?: unknown[],
  reviews?: unknown[],
  ownerEvents?: unknown[],
  now?: Date,
): {
  schema: string;
  evidence: unknown[];
  reviews: Array<{
    id: string;
    evidenceId: string;
    issuerReceiptRef: string;
    issuerClaimedSha256: string;
    claimedDigestComparison: string;
    submittedAt: string;
    disposition: string;
    independentVerification: boolean;
  }>;
  ownerIntents: Array<{
    id: string;
    custodyReviewId: string;
    decision: string;
    expiresAt: string | null;
    submittedAt: string;
    disposition: string;
    independentAuthority: boolean;
  }>;
  ownerIntentState: string;
  connection_state: string;
  issuer_independently_verified: boolean;
  peer_enrolled: boolean;
  signed_test_witness_observed: boolean;
  external_requests_or_writes: boolean;
};
export function build203Runbook(report?: { ownerIntentState?: string }): {
  schema: string;
  mode: string;
  connection_state: string;
  ownerIntentState: string;
  externalAuthorityVerified: boolean;
  authorizeHandshake: boolean;
  liveCallsOrMessages: boolean;
  steps: Array<{ order: number; instruction: string; status: string }>;
};
