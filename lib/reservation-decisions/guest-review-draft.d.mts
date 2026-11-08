export const GUEST_REVIEW_DRAFT_TTL_MS: number;

export type GuestReviewKind = "change_dates" | "cancellation_review";

export type GuestReviewDraft = {
  version: 1;
  reason: string;
  expiresAt: number;
};

export function guestReviewDraftKey(input: {
  guestId: string;
  reservationId: string;
  kind: GuestReviewKind;
}): string;

export function createGuestReviewDraft(
  reason: string,
  now?: number,
): GuestReviewDraft;

export function readGuestReviewDraft(
  raw: string | null,
  now?: number,
): GuestReviewDraft | null;
