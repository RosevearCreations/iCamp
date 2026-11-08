export const serviceOperatingStatuses: readonly string[];
export const serviceOperatingStatusLabels: Readonly<Record<string, string>>;
export interface PublicAmenityService {
  operatingStatus: string;
  hoursSummary: string;
  accessibilityDetails: string;
  reviewedAt: string;
}
export function normalizeAmenityServiceReview(input?: {
  operatingStatus?: unknown;
  hoursSummary?: unknown;
  accessibilityDetails?: unknown;
  publish?: boolean;
  confirmed?: boolean;
}): {
  operatingStatus: string;
  hoursSummary: string;
  accessibilityDetails: string;
  publish: boolean;
};
export function publicAmenityService(row: {
  serviceReviewedAt?: string | Date | null;
  serviceOperatingStatus?: string | null;
  serviceHoursSummary?: string | null;
  serviceAccessibilityDetails?: string | null;
}): PublicAmenityService | null;
