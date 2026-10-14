export const PUBLIC_BOOKING_MAP_COLORS: Readonly<{
  available: "green";
  used: "grey";
  attention: "yellow";
  closed: "red";
}>;

export function normalizePublicBookingMapFilters(input?: {
  arrivalDate?: string;
  departureDate?: string;
  kind?: string;
  availability?: string;
}): Readonly<{
  arrivalDate: string;
  departureDate: string;
  kind: string;
  availability: string;
}>;

export function publicBookingMapPresentation(input?: {
  statusState?: string;
  blockers?: string[];
}): Readonly<{
  tone: "green" | "grey" | "yellow" | "red";
  label: string;
  selectable: boolean;
}>;

export function publicMapPolygonPoints(geometry: {
  vertices?: Array<{
    image?: {
      x?: number;
      y?: number;
    };
  }>;
} | null): string;
