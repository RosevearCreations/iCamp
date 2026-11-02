import type { PublicAccommodationDetail } from "../public-accommodation-detail/postgres.mjs";

export const BOOKING_DRAFT_TTL_DAYS: 7;

export interface BookingDraftInput {
  campgroundSlug: string;
  accommodationId: string;
  arrivalDate: string;
  departureDate: string;
  nights: number;
  selections: Array<{ code: string; quantity: number }>;
}

export interface BookingDraftQuoteSnapshot {
  status: "quoted" | "unavailable";
  knownSubtotalCents: number | null;
  currencyCode: string | null;
  availabilityRevision: number | null;
  selectable: boolean;
}

export interface BookingDraft extends BookingDraftInput {
  id: string;
  campgroundId: string;
  campgroundName: string;
  accommodationCode: string;
  accommodationName: string;
  savedQuote: BookingDraftQuoteSnapshot;
  consentedAt: string;
  expiresAt: string;
  updatedAt: string;
  rowVersion: number;
}

export function normalizeBookingDraftInput(
  input: Record<string, unknown>,
  now?: Date,
): BookingDraftInput;

export function quoteSnapshot(
  detail: PublicAccommodationDetail | null,
): BookingDraftQuoteSnapshot;

export function compareBookingDraftToLive(
  draft: BookingDraft,
  detail: PublicAccommodationDetail | null,
): {
  status: "current" | "changed" | "unavailable";
  live: BookingDraftQuoteSnapshot | null;
};

export function bookingDraftDetailHref(draft: BookingDraft): string;
