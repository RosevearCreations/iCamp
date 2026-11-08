import {
  filterPublicWayfinding,
  publicAmenityKinds,
} from "../wayfinding/core.mjs";

export const guestServiceKindLabels = Object.freeze({
  pool: "Pools",
  washroom: "Washrooms",
  dock: "Docks",
  building: "Buildings & halls",
});

export function normalizeGuestServiceFilters(input = {}) {
  const requestedKind = String(input.kind ?? "all")
    .trim()
    .toLowerCase();
  const kind = publicAmenityKinds.includes(requestedKind)
    ? requestedKind
    : "all";
  const query = String(input.query ?? "")
    .trim()
    .slice(0, 80);
  return { kind, query };
}

/**
 * Build a directory only from the public, staff-reviewed wayfinding snapshot.
 * Location publication must never be confused with a live open/closed state.
 */
export function buildGuestServiceDirectory({
  wayfinding,
  campgroundSlug,
  arrivalDate,
  departureDate,
  filters = {},
}) {
  if (!Array.isArray(wayfinding) || !campgroundSlug) {
    throw new Error("A published campground wayfinding source is required.");
  }
  const normalized = normalizeGuestServiceFilters(filters);
  const eligible = wayfinding.filter(
    (item) =>
      item &&
      publicAmenityKinds.includes(item.kind) &&
      typeof item.id === "string" &&
      item.id.length > 0 &&
      typeof item.name === "string" &&
      item.name.trim() &&
      typeof item.description === "string" &&
      item.description.trim(),
  );
  const matches = filterPublicWayfinding(eligible, normalized);
  const mapQuery = `/booking/map?campground=${encodeURIComponent(campgroundSlug)}&arrivalDate=${encodeURIComponent(arrivalDate)}&departureDate=${encodeURIComponent(departureDate)}`;
  const mapHref = `${mapQuery}#wayfinding`;
  return {
    ...normalized,
    totalPublished: eligible.length,
    mapHref,
    items: matches.map((item) => ({
      id: item.id,
      kind: item.kind,
      kindLabel: guestServiceKindLabels[item.kind],
      name: item.name,
      description: item.description,
      accessibilityNote: item.accessibilityNote?.trim() || null,
      landmarkHint: item.landmarkHint?.trim() || null,
      mapHref: `${mapQuery}#wayfinding-amenity-${encodeURIComponent(item.id)}`,
      availabilityLabel:
        "Current hours, capacity and operating status are not verified here. Ask the campground office before visiting.",
    })),
  };
}
