export const SAFETY_TEXT265: string;
export const SAFETY_VERSION265: string;
export const SUPPORT_CATEGORIES265: readonly string[];
export function normalizedGuestAcknowledgment265(input: {
  allocationId?: unknown;
  safetyConfirmed?: boolean;
  termsConfirmed?: boolean;
}): {
  allocationId: string;
  versionSha256: string;
  safetyConfirmed: true;
  termsConfirmed: true;
  paid: false;
  waiverCertified: false;
};
export function normalizedCustody265(input: {
  allocationId?: unknown;
  eventKind?: unknown;
  evidenceReference?: unknown;
  conditionNote?: unknown;
}): {
  allocationId: string;
  eventKind: string;
  evidenceReference: string;
  conditionNote: string;
  bankPaid: false;
  insuranceCertified: false;
  physicalThirdPartyVerified: false;
};
export function normalizedSupervision265(input: {
  pilotReviewId?: unknown;
  siteReference?: unknown;
  supervisionReference?: unknown;
  safetyRestrictions?: unknown;
}): {
  pilotReviewId: string;
  siteReference: string;
  supervisionReference: string;
  safetyRestrictions: string;
  livePublicPilotAuthorized: false;
  insuranceVerifiedExternally: false;
};
export function normalizedSupport265(input: {
  category?: unknown;
  severity?: unknown;
  title?: unknown;
  description?: unknown;
}): {
  category: string;
  severity: string;
  title: string;
  description: string;
  status: "open";
};
export function classifyCampgroundSupport265(
  records: readonly { status: string; severity: string; category: string }[],
): {
  observed: number;
  open: number;
  triaged: number;
  resolved: number;
  criticalOpen: number;
  lockedOpen: number;
  performanceOpen: number;
  coverageCapped: boolean;
};
