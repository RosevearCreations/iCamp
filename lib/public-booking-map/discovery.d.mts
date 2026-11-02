import type { PublicBookingMapItem } from "./postgres.mjs";

export interface PublicDiscoveryFilters {
  campsiteType: "all" | "tent" | "rv" | "mixed";
  accessibility:
    "all" | "advertised_site" | "step_free" | "accessible_washroom";
  amenity:
    "all" | "waterfront" | "wifi" | "electric" | "fire_ring" | "picnic_table";
  photos: "all" | "with_photos" | "described";
  guests: number;
  pets: number;
  rvLengthMeters: number;
}

export interface SavedPublicComparison {
  version: 1;
  campgroundSlug: string;
  arrivalDate: string;
  departureDate: string;
  savedAt: string;
  entries: Array<{ id: string; fingerprint: string }>;
}

export interface RecheckedPublicComparison {
  datesChanged: boolean;
  entries: Array<{
    id: string;
    item: PublicBookingMapItem | null;
    changed: boolean;
  }>;
}

export const PUBLIC_COMPARISON_LIMIT: 3;
export const PUBLIC_COMPARISON_STORAGE_VERSION: 1;
export function normalizePublicDiscoveryFilters(
  input?: Record<string, unknown>,
): PublicDiscoveryFilters;
export function filterPublicDiscoveryItems(
  items: PublicBookingMapItem[],
  filters: PublicDiscoveryFilters,
): PublicBookingMapItem[];
export function publicComparisonFingerprint(item: PublicBookingMapItem): string;
export function savePublicComparison(
  items: PublicBookingMapItem[],
  context: {
    campgroundSlug: string;
    arrivalDate: string;
    departureDate: string;
  },
  savedAt?: string,
): SavedPublicComparison;
export function parsePublicComparison(
  raw: string | null,
  campgroundSlug: string,
): SavedPublicComparison | null;
export function recheckPublicComparison(
  saved: SavedPublicComparison,
  items: PublicBookingMapItem[],
  context: { arrivalDate: string; departureDate: string },
): RecheckedPublicComparison;
