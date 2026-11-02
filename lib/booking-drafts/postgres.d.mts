import type { BookingDraft, BookingDraftInput } from "./core.mjs";
import type { PublicAccommodationDetail } from "../public-accommodation-detail/postgres.mjs";

export function saveOwnBookingDraft(input: {
  userId: string;
  input: BookingDraftInput;
  detail: PublicAccommodationDetail;
}): Promise<string>;

export function listOwnBookingDrafts(input: {
  userId: string;
}): Promise<BookingDraft[]>;

export function getOwnBookingDraft(input: {
  userId: string;
  draftId: string;
}): Promise<BookingDraft | null>;

export function deleteOwnBookingDraft(input: {
  userId: string;
  draftId: string;
}): Promise<boolean>;

export function closeBookingDraftPoolForTests(): Promise<void>;
