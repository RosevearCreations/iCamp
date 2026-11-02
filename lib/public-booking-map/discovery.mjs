// Build 173: discovery operates only on public, published, server-authoritative snapshots.
const allowed = Object.freeze({
  campsiteType: ["all", "tent", "rv", "mixed"],
  accessibility: ["all", "advertised_site", "step_free", "accessible_washroom"],
  amenity: [
    "all",
    "waterfront",
    "wifi",
    "electric",
    "fire_ring",
    "picnic_table",
  ],
  photos: ["all", "with_photos", "described"],
});

function boundedNumber(value, name, max, decimal = false) {
  const raw = String(value ?? "0").trim();
  if (
    !new RegExp(
      decimal ? "^(0|[1-9]\\d*)(\\.\\d{1,2})?$" : "^(0|[1-9]\\d*)$",
    ).test(raw)
  ) {
    throw new Error(`${name} filter is invalid.`);
  }
  const number = Number(raw);
  if (number > max) throw new Error(`${name} filter is invalid.`);
  return number;
}

export function normalizePublicDiscoveryFilters(input = {}) {
  const values = {};
  for (const [key, options] of Object.entries(allowed)) {
    const value = String(input[key] ?? "all")
      .trim()
      .toLowerCase();
    if (!options.includes(value)) throw new Error(`${key} filter is invalid.`);
    values[key] = value;
  }
  return Object.freeze({
    ...values,
    guests: boundedNumber(input.guests, "Guests", 80),
    pets: boundedNumber(input.pets, "Pets", 20),
    rvLengthMeters: boundedNumber(input.rvLengthMeters, "RV length", 80, true),
  });
}

export function filterPublicDiscoveryItems(items, filters) {
  return items.filter((item) => {
    const fact = item.discovery;
    if (!fact) return false;
    if (
      filters.campsiteType !== "all" &&
      fact.campsiteType !== filters.campsiteType
    )
      return false;
    if (
      (filters.accessibility === "advertised_site" &&
        fact.accessibleSite !== true) ||
      (filters.accessibility === "step_free" && fact.stepFreeAccess !== true) ||
      (filters.accessibility === "accessible_washroom" &&
        fact.accessibleWashroom !== true)
    )
      return false;
    if (
      (filters.amenity === "waterfront" && fact.isWaterfront !== true) ||
      (filters.amenity === "wifi" &&
        !["shared", "site"].includes(fact.wifiService)) ||
      (filters.amenity === "electric" &&
        !(Number(fact.electricalAmperage) > 0)) ||
      (filters.amenity === "fire_ring" && fact.hasFireRing !== true) ||
      (filters.amenity === "picnic_table" && fact.hasPicnicTable !== true)
    )
      return false;
    if (filters.photos === "with_photos" && fact.photoCount < 1) return false;
    if (filters.photos === "described" && fact.describedPhotoCount < 1)
      return false;
    // No campsite occupancy ceiling is stored: exclude unknown fit rather than promise it.
    if (filters.guests > 0 && !(fact.maxOccupancy >= filters.guests))
      return false;
    if (
      filters.pets > 0 &&
      !(fact.petsAllowed === true && fact.maxPets >= filters.pets)
    )
      return false;
    // Unknown RV fit never passes a specific requested length.
    if (
      filters.rvLengthMeters > 0 &&
      !(fact.maxRvLengthMeters >= filters.rvLengthMeters)
    )
      return false;
    return true;
  });
}

export const PUBLIC_COMPARISON_LIMIT = 3;
export const PUBLIC_COMPARISON_STORAGE_VERSION = 1;

export function publicComparisonFingerprint(item) {
  // Live blockers are included because a hold can change without an accommodation edit.
  return JSON.stringify([
    item.availabilityRevision,
    item.statusState,
    item.selectable,
    [...item.blockers].sort(),
    item.discovery,
  ]);
}

export function savePublicComparison(
  items,
  context,
  savedAt = new Date().toISOString(),
) {
  if (items.length < 1 || items.length > PUBLIC_COMPARISON_LIMIT) {
    throw new Error("Choose one to three accommodations to save.");
  }
  if (
    new Set(items.map((item) => item.accommodationId)).size !== items.length
  ) {
    throw new Error("A comparison cannot include duplicate accommodations.");
  }
  if (
    items.some(
      (item) =>
        !["campsite", "rental_cottage"].includes(item.accommodationKind),
    )
  ) {
    throw new Error("Only campsites and cottages can be compared.");
  }
  return {
    version: PUBLIC_COMPARISON_STORAGE_VERSION,
    campgroundSlug: context.campgroundSlug,
    arrivalDate: context.arrivalDate,
    departureDate: context.departureDate,
    savedAt,
    entries: items.map((item) => ({
      id: item.accommodationId,
      fingerprint: publicComparisonFingerprint(item),
    })),
  };
}

export function parsePublicComparison(raw, campgroundSlug) {
  if (typeof raw !== "string" || raw.length > 16000) return null;
  try {
    const value = JSON.parse(raw);
    if (
      value?.version !== PUBLIC_COMPARISON_STORAGE_VERSION ||
      value.campgroundSlug !== campgroundSlug ||
      typeof value.arrivalDate !== "string" ||
      typeof value.departureDate !== "string" ||
      typeof value.savedAt !== "string" ||
      !Array.isArray(value.entries) ||
      value.entries.length < 1 ||
      value.entries.length > PUBLIC_COMPARISON_LIMIT ||
      !value.entries.every(
        (entry) =>
          typeof entry?.id === "string" &&
          /^[0-9a-f-]{36}$/i.test(entry.id) &&
          typeof entry.fingerprint === "string" &&
          entry.fingerprint.length < 4096,
      ) ||
      new Set(value.entries.map((entry) => entry.id)).size !==
        value.entries.length
    )
      return null;
    return value;
  } catch {
    return null;
  }
}

export function recheckPublicComparison(saved, items, context) {
  const byId = new Map(items.map((item) => [item.accommodationId, item]));
  const datesChanged =
    saved.arrivalDate !== context.arrivalDate ||
    saved.departureDate !== context.departureDate;
  return {
    datesChanged,
    entries: saved.entries.map((entry) => {
      const item = byId.get(entry.id);
      return {
        id: entry.id,
        item: item ?? null,
        changed:
          datesChanged ||
          !item ||
          publicComparisonFingerprint(item) !== entry.fingerprint,
      };
    }),
  };
}
