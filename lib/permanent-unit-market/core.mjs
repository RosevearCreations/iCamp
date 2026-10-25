const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function required(value, label, min, max) {
  const text = String(value ?? "").trim();
  if (text.length < min || text.length > max)
    throw new Error(`${label} must contain ${min}–${max} characters.`);
  return text;
}
export function unitId(value, label = "Record ID") {
  if (!uuid.test(String(value ?? "")))
    throw new Error(`${label} must be a UUID.`);
  return String(value).toLowerCase();
}
export function normalizeOwnership(input) {
  const eventKind = String(input.eventKind ?? "owner_recorded");
  if (
    !["owner_recorded", "ownership_corrected", "ownership_ended"].includes(
      eventKind,
    )
  )
    throw new Error("Invalid ownership event kind.");
  return {
    id: unitId(input.id),
    accommodationId: unitId(input.accommodationId, "Permanent unit"),
    eventKind,
    ownerDisplayName: required(input.ownerDisplayName, "Owner", 3, 160),
    evidenceReference: required(
      input.evidenceReference,
      "Ownership source",
      8,
      400,
    ),
    notes: required(input.notes, "Ownership note", 12, 1200),
  };
}
export function normalizeListing(input) {
  const dollars = String(input.askingPrice ?? "").trim();
  if (!/^(0|[1-9]\d{0,8})(\.\d{1,2})?$/.test(dollars))
    throw new Error(
      "Asking price must be a nonnegative CAD amount with up to two decimals.",
    );
  const [whole, fraction = ""] = dollars.split(".");
  return {
    id: unitId(input.id),
    accommodationId: unitId(input.accommodationId, "Permanent unit"),
    ownershipEventId: unitId(input.ownershipEventId, "Ownership evidence"),
    headline: required(input.headline, "Listing headline", 8, 160),
    description: required(input.description, "Listing description", 20, 2500),
    askingPriceCents: Number(whole) * 100 + Number(fraction.padEnd(2, "0")),
  };
}
export function normalizeInquiry(input) {
  return {
    id: unitId(input.id),
    listingId: unitId(input.listingId, "Listing"),
    buyerDisplayName: required(input.buyerDisplayName, "Buyer name", 3, 160),
    contactReference: required(
      input.contactReference,
      "Private contact reference",
      8,
      400,
    ),
    inquiryNote: required(input.inquiryNote, "Inquiry note", 12, 1200),
  };
}
export function listingIsCurrent(listing, ownershipEvents) {
  const latest = ownershipEvents.find(
    (event) => event.accommodation_id === listing.accommodation_id,
  );
  return Boolean(
    latest &&
    latest.id === listing.ownership_event_id &&
    latest.event_kind !== "ownership_ended",
  );
}
