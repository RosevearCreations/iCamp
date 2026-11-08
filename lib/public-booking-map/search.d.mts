import type { PublicDiscoveryFilters } from "./discovery.mjs";

export type PublicBookingSearchResult =
  | Readonly<{
      ok: true;
      mapFilters: Readonly<{
        arrivalDate: string;
        departureDate: string;
        kind: string;
        availability: string;
      }>;
      discoveryFilters: PublicDiscoveryFilters;
    }>
  | Readonly<{
      ok: false;
      message: string;
    }>;

export function parsePublicBookingSearch(
  params?: Record<string, string | undefined>,
  defaults?: { arrivalDate: string; departureDate: string },
): PublicBookingSearchResult;
