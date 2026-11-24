export const KINDS278: readonly string[];
export function validateFieldReview278(input: {
  responseId: string;
  evidenceDigest: string;
}): { responseId: string; evidenceDigest: string };
export function validateMfaReview278(input: {
  sessionId: string;
  ownerId: string;
  evidenceDigest: string;
}): { sessionId: string; ownerId: string; evidenceDigest: string };
export function validateExternalReadback278(input: {
  externalReviewId: string;
  providerDigest: string;
  isolatedDigest: string;
  evidenceDigest: string;
}): {
  externalReviewId: string;
  providerDigest: string;
  isolatedDigest: string;
  evidenceDigest: string;
};
export function summarizeField278(
  items: {
    source: string;
    acceptedAt: string;
    reviewedAt: string | null;
    cryptographic: boolean;
  }[],
  now?: number,
): {
  peers: { source: string; status: string }[];
  reviewedCount: number;
  status: string;
};
export function summarizeOwner278(
  owner: { status: string },
  session: {
    user: { id: string; username?: string | null };
    assuranceLevel: string;
    sessionId: string;
  },
  readback: { ownerId: string; sessionId: string } | null,
): { status: string };
export function summarizeRestore278(rows: { independent: boolean }[]): {
  evidenceCount: number;
  status: string;
  productionRestored: boolean;
};
export function classifyClosure278(input: {
  host: { pinned: boolean };
  owner: { status: string };
  peers: { reviewedCount: number };
  restore: { evidenceCount: number };
  migrationAdopted: boolean;
}): { status: string; productionRestored: boolean; providerCertified: boolean };
