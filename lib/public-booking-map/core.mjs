import { normalizeAvailabilityWindow } from "../live-availability/core.mjs";

export const PUBLIC_BOOKING_MAP_COLORS = Object.freeze({
  available: "green",
  used: "grey",
  attention: "yellow",
  closed: "red",
});

export function normalizePublicBookingMapFilters(input = {}) {
  const window = normalizeAvailabilityWindow(input);
  const kind = String(input.kind ?? "all")
    .trim()
    .toLowerCase();
  const availability = String(input.availability ?? "all")
    .trim()
    .toLowerCase();

  if (!["all", "campsite", "rental_cottage", "permanent_unit"].includes(kind)) {
    throw new Error("Accommodation filter is invalid.");
  }
  if (!["all", "available"].includes(availability)) {
    throw new Error("Availability filter is invalid.");
  }

  return Object.freeze({ ...window, kind, availability });
}

export function publicBookingMapPresentation(item = {}) {
  const status = String(item.statusState ?? "available").toLowerCase();
  const blockers = Array.isArray(item.blockers) ? item.blockers : [];

  if (
    ["closed", "winterized"].includes(status) ||
    blockers.includes("management_restriction")
  ) {
    return Object.freeze({
      tone: PUBLIC_BOOKING_MAP_COLORS.closed,
      label: "Closed",
      selectable: false,
    });
  }

  if (
    ["maintenance", "inspection"].includes(status) ||
    blockers.includes("turnover")
  ) {
    return Object.freeze({
      tone: PUBLIC_BOOKING_MAP_COLORS.attention,
      label: "Maintenance",
      selectable: false,
    });
  }

  if (
    ["held", "reserved", "arriving", "occupied", "departing"].includes(
      status,
    ) ||
    blockers.some((blocker) =>
      ["reservation", "temporary_hold", "seasonal_assignment"].includes(
        blocker,
      ),
    )
  ) {
    return Object.freeze({
      tone: PUBLIC_BOOKING_MAP_COLORS.used,
      label: "Unavailable",
      selectable: false,
    });
  }

  return Object.freeze({
    tone: PUBLIC_BOOKING_MAP_COLORS.available,
    label: "Available",
    selectable: true,
  });
}

export function publicMapPolygonPoints(geometry) {
  const vertices = geometry?.vertices;
  if (!Array.isArray(vertices) || vertices.length < 3) return "";
  return vertices
    .map((vertex) => {
      const point = vertex?.image;
      const x = Number(point?.x);
      const y = Number(point?.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        throw new Error("Published map polygon contains invalid geometry.");
      }
      return `${x},${y}`;
    })
    .join(" ");
}
