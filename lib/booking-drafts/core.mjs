import { normalizePublicAccommodationDates } from "../public-accommodation-detail/core.mjs";
import { parsePublicQuoteSelections } from "../public-accommodation-detail/quote-preview.mjs";

export const BOOKING_DRAFT_TTL_DAYS = 7;

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const slug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

export function normalizeBookingDraftInput(input, now = new Date()) {
  const campgroundSlug = String(input.campgroundSlug ?? "").trim();
  const accommodationId = String(input.accommodationId ?? "").trim();
  if (!slug.test(campgroundSlug) || campgroundSlug.length > 100) {
    throw new Error("Choose a valid campground.");
  }
  if (!uuid.test(accommodationId)) {
    throw new Error("Choose a valid campsite or cottage.");
  }
  const dates = normalizePublicAccommodationDates(input);
  const today = now.toISOString().slice(0, 10);
  if (dates.arrivalDate < today || dates.nights > 90) {
    throw new Error("Choose future dates for no more than 90 nights.");
  }
  const selections = parsePublicQuoteSelections(input);
  return { campgroundSlug, accommodationId, ...dates, selections };
}

export function quoteSnapshot(detail) {
  const quote = detail?.quotePreview;
  return {
    status: quote?.status === "quoted" ? "quoted" : "unavailable",
    knownSubtotalCents:
      quote?.status === "quoted" ? quote.knownSubtotalCents : null,
    currencyCode: quote?.status === "quoted" ? quote.currencyCode : null,
    availabilityRevision:
      quote?.status === "quoted" ? quote.availabilityRevision : null,
    selectable: detail?.availability?.selectable === true,
  };
}

export function compareBookingDraftToLive(draft, detail) {
  if (!detail) return { status: "unavailable", live: null };
  const live = quoteSnapshot(detail);
  const saved = draft.savedQuote;
  if (live.status !== "quoted" || !live.selectable || detail.selectionError) {
    return { status: "unavailable", live };
  }
  if (
    saved.status !== live.status ||
    saved.currencyCode !== live.currencyCode ||
    saved.knownSubtotalCents !== live.knownSubtotalCents ||
    saved.availabilityRevision !== live.availabilityRevision ||
    saved.selectable !== live.selectable
  ) {
    return { status: "changed", live };
  }
  return { status: "current", live };
}

export function bookingDraftDetailHref(draft) {
  const query = new URLSearchParams({
    campground: draft.campgroundSlug,
    arrivalDate: draft.arrivalDate,
    departureDate: draft.departureDate,
  });
  draft.selections.forEach((selection, index) => {
    query.set(`extra${index + 1}`, selection.code);
    query.set(`quantity${index + 1}`, String(selection.quantity));
  });
  return `/booking/accommodations/${encodeURIComponent(draft.accommodationId)}?${query}`;
}
