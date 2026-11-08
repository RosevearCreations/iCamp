import type { PublicWayfindingPoint } from "../wayfinding/core.mjs";

export const guestServiceKindLabels: Readonly<Record<string, string>>;

export function normalizeGuestServiceFilters(input?: {
  kind?: unknown;
  query?: unknown;
}): { kind: string; query: string };

export function buildGuestServiceDirectory(input: {
  wayfinding: PublicWayfindingPoint[];
  campgroundSlug: string;
  arrivalDate: string;
  departureDate: string;
  filters?: { kind?: unknown; query?: unknown };
}): {
  kind: string;
  query: string;
  totalPublished: number;
  mapHref: string;
  items: Array<{
    id: string;
    kind: string;
    kindLabel: string;
    name: string;
    description: string;
    accessibilityNote: string | null;
    landmarkHint: string | null;
    mapHref: string;
    availabilityLabel: string;
  }>;
};
