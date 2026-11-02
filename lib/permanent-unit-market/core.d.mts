export function unitId(value: unknown, label?: string): string;
export function normalizeOwnership(input: Record<string, unknown>): {
  id: string;
  accommodationId: string;
  eventKind: string;
  ownerDisplayName: string;
  evidenceReference: string;
  notes: string;
};
export function normalizeListing(input: Record<string, unknown>): {
  id: string;
  accommodationId: string;
  ownershipEventId: string;
  headline: string;
  description: string;
  askingPriceCents: number;
};
export function normalizeInquiry(input: Record<string, unknown>): {
  id: string;
  listingId: string;
  buyerDisplayName: string;
  contactReference: string;
  inquiryNote: string;
};
export function listingIsCurrent(
  listing: { accommodation_id: string; ownership_event_id: string },
  ownershipEvents: Array<{
    id: string;
    accommodation_id: string;
    event_kind: string;
  }>,
): boolean;
