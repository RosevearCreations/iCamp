export function originalAdmission278(): Promise<{
  adopted: boolean;
  host: { configured: boolean; pinned: boolean; status: string };
  status: string;
}>;
export function recordFieldAttestation278(input: {
  reviewerId: string;
  responseId: string;
  evidenceDigest: string;
}): Promise<{ stored: boolean; status: string }>;
export function recordOwnerMfaReadback278(input: {
  reviewerId: string;
  sessionId: string;
  ownerId: string;
  evidenceDigest: string;
}): Promise<{ stored: boolean; status: string }>;
export function recordRestoreServiceReadback278(input: {
  reviewerId: string;
  externalReviewId: string;
  providerDigest: string;
  isolatedDigest: string;
  evidenceDigest: string;
}): Promise<{ stored: boolean; status: string }>;
export function fieldReadback278(): Promise<{
  status: string;
  reviewedCount: number;
  peers: { source: string; status: string }[];
  records: {
    source: string;
    responseId: string;
    reviewed: boolean;
    signed: boolean;
  }[];
}>;
export function ownerReadback278(session: {
  sessionId: string;
  assuranceLevel: string;
  user: { id: string; username?: string | null };
}): Promise<{
  status: string;
  owner: {
    status: string;
    checks: {
      id: string;
      status: string;
      detail: string;
    }[];
  };
}>;
export function restoreReadback278(): Promise<{
  status: string;
  evidenceCount: number;
  productionRestored: boolean;
  records: { externalReviewId: string; witnessed: boolean }[];
}>;
export function acceptanceSummary278(session: {
  sessionId: string;
  assuranceLevel: string;
  user: { id: string; username?: string | null };
}): Promise<{
  admission: {
    adopted: boolean;
    host: { configured: boolean; pinned: boolean; status: string };
    status: string;
  };
  owner: {
    status: string;
    owner: {
      status: string;
      checks: { id: string; status: string; detail: string }[];
    };
  };
  peers: {
    status: string;
    reviewedCount: number;
    peers: { source: string; status: string }[];
    records: {
      source: string;
      responseId: string;
      reviewed: boolean;
      signed: boolean;
    }[];
  };
  restore: {
    status: string;
    evidenceCount: number;
    productionRestored: boolean;
    records: { externalReviewId: string; witnessed: boolean }[];
  };
  closure: {
    status: string;
    productionRestored: boolean;
    providerCertified: boolean;
  };
}>;
