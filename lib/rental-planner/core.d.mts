import type { RecreationStay } from "../recreation-events/core.mjs";
export interface RentalWindow {
  startDate: string;
  endDate: string;
  days: number;
}
export interface RentalOffer {
  id: string;
  campgroundId: string;
  campgroundName: string;
  campgroundSlug: string;
  timezone: string;
  localDate: string;
  assetId: string;
  assetCode: string;
  assetName: string;
  assetClass: string;
  itemType: string;
  sourceReady: boolean;
  description: string;
  accessibilityNote: string;
  returnGuidance: string;
  maxDays: number;
  isPublished: boolean;
  acceptingRequests: boolean;
  available: boolean | null;
  rowVersion: number;
}
export function rentalUuid(value: unknown, label?: string): string;
export function normalizeRentalWindow(
  input: { startDate?: unknown; endDate?: unknown } | null,
): RentalWindow | null;
export function normalizeRentalOffer(input: {
  description?: unknown;
  accessibilityNote?: unknown;
  returnGuidance?: unknown;
  maxDays?: unknown;
  isPublished?: boolean;
  acceptingRequests?: boolean;
}): {
  description: string;
  accessibilityNote: string;
  returnGuidance: string;
  maxDays: number;
  isPublished: boolean;
  acceptingRequests: boolean;
};
export function normalizeRentalRequest(input: {
  startDate?: unknown;
  endDate?: unknown;
  guestNote?: unknown;
  clientRequestId?: unknown;
}): RentalWindow & { guestNote: string; clientRequestId: string };
export function rentalAvailabilityLabel(
  offer: RentalOffer,
  window: RentalWindow | null,
): string;
export function guestStayEligibleForRental(
  stay: RecreationStay,
  offer: RentalOffer,
  window: RentalWindow | null,
): boolean;
