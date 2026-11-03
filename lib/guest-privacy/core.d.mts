export const privacyRequestKinds: string[];
export const privacySubjectAreas: string[];
export const privacyReviewEvents: string[];
export function normalizePrivacyRequest(input: Record<string, unknown>): {
  requestKind: string;
  subjectArea: string;
};
export function normalizePrivacyReview(input: Record<string, unknown>): {
  eventKind: string;
  outcomeCode: string;
  sourceReference: string | null;
};
export function isPrivacyTerminal(eventKind: string): boolean;
export function buildOwnPrivacyExport(input: {
  campgroundId: string;
  campgroundName: string;
  exportedAt: string;
  detail: import("../guest-profile/postgres.mjs").GuestProfileDetail | null;
  privacy: import("./postgres.mjs").PrivacyWorkspace;
  records: {
    campgroundName?: string;
    stays: Array<Record<string, string | number | null>>;
    receipts: Array<Record<string, string | number | null>>;
    truncated: boolean;
  };
}): { bytes: Buffer; sha256: string };
