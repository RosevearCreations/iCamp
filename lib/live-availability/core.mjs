export function normalizeAvailabilityWindow(input = {}) {
  const arrivalDate = String(input.arrivalDate ?? "").trim();
  const departureDate = String(input.departureDate ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(arrivalDate) || !/^\d{4}-\d{2}-\d{2}$/.test(departureDate)) {
    throw new Error("Arrival and departure must be ISO dates.");
  }
  if (departureDate <= arrivalDate) throw new Error("Departure must be after arrival.");
  return { arrivalDate, departureDate };
}

export function mapAvailabilityRow(row) {
  const blockers = [];
  if (row.reservation_blocked) blockers.push("reservation");
  if (row.hold_blocked) blockers.push("temporary_hold");
  if (row.restriction_blocked) blockers.push("management_restriction");
  if (row.turnover_blocked) blockers.push("turnover");
  if (row.seasonal_blocked) blockers.push("seasonal_assignment");
  return {
    accommodationId: row.accommodation_id,
    availabilityRevision: Number(row.availability_revision ?? 0),
    available: blockers.length === 0,
    blockers,
  };
}

export function assertLiveAvailability(result) {
  if (!result?.available) {
    const error = new Error(
      "Accommodation is not available for the requested dates: " +
        (result?.blockers ?? ["unknown"]).join(", ") + ".",
    );
    error.code = "ICAMP_ACCOMMODATION_UNAVAILABLE";
    error.blockers = result?.blockers ?? [];
    throw error;
  }
  return result;
}
