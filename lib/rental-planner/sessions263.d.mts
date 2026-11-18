export interface NormalizedRentalSession263 {
  offerId: string;
  plannedDay: string;
  startMinute: number;
  endMinute: number;
  participantLimit: number;
  activityKind: string;
  safetyBrief: string;
  status: "planned";
  guestBookingsCreated: false;
}
export function normalizeRentalSession263(input: {
  offerId?: unknown;
  plannedDay?: unknown;
  start?: unknown;
  end?: unknown;
  participantLimit?: unknown;
  activityKind?: unknown;
  safetyBrief?: unknown;
}): NormalizedRentalSession263;
export function inventoryReadiness263(
  assets: Array<{
    id: string;
    operatingState: string;
    lifecycleState: string;
  }>,
  offers: Array<{ assetId: string; isPublished: boolean }>,
): {
  registeredEligibleAssetsObserved: number;
  publishedOffersObserved: number;
  unpublishedOffersObserved: number;
  operationalCandidatesObserved: number;
  notYetListedCandidatesObserved: number;
  evidenceMayBeTruncated: boolean;
  originalInventoryVerifiedComplete: false;
  rentalReservationsConfirmed: 0;
};
export function sessionLocalClock263(minute: number): string;
