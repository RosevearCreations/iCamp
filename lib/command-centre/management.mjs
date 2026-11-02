const ACTIVE_STAYS = new Set(["confirmed", "checked_in"]);
const OPEN_MAINTENANCE = new Set([
  "open",
  "assigned",
  "in_progress",
  "blocked",
]);

function todayInZone(now, timezone) {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone || "America/Toronto",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .format(now)
      .replace(/\//g, "-");
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

function plusDays(isoDate, count) {
  const date = new Date(`${isoDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}

export function buildManagementSnapshot({
  reservations = null,
  maintenance = null,
  now = new Date(),
  timezone = "America/Toronto",
}) {
  const today = todayInZone(now, timezone);
  const weekEnd = plusDays(today, 7);
  const availableReservations = Array.isArray(reservations?.reservations);
  const availableMaintenance = Array.isArray(maintenance?.workOrders);
  const rows = availableReservations ? reservations.reservations : [];
  const workOrders = availableMaintenance ? maintenance.workOrders : [];

  const upcoming = rows
    .filter(
      (row) =>
        ACTIVE_STAYS.has(row.status) &&
        row.arrivalDate >= today &&
        row.arrivalDate < weekEnd,
    )
    .sort((a, b) => a.arrivalDate.localeCompare(b.arrivalDate))
    .slice(0, 6)
    .map((row) => ({
      id: row.id,
      date: row.arrivalDate,
      site: row.accommodationCode,
      label: row.guestDisplayName,
      status: row.status,
    }));
  const openOrders = workOrders.filter((row) =>
    OPEN_MAINTENANCE.has(row.status),
  );
  const blockedOrders = workOrders.filter((row) => row.status === "blocked");
  const sites = reservations?.accommodations ?? maintenance?.accommodations;
  const siteCount = Array.isArray(sites) ? sites.length : null;
  const availableSites = Array.isArray(reservations?.accommodations)
    ? reservations.accommodations.filter(
        (site) => site.statusState === "available",
      ).length
    : null;

  return {
    asOf: now.toISOString(),
    today,
    siteCount,
    availableSites,
    visibleReservationCount: availableReservations ? rows.length : null,
    reservationRowsCapped: availableReservations && rows.length >= 250,
    arrivalsThisWeek: availableReservations
      ? rows.filter(
          (row) =>
            ACTIVE_STAYS.has(row.status) &&
            row.arrivalDate >= today &&
            row.arrivalDate < weekEnd,
        ).length
      : null,
    financialReviews: availableReservations
      ? rows.filter((row) => row.financialReviewRequired).length
      : null,
    openWorkOrders: availableMaintenance ? openOrders.length : null,
    blockedWorkOrders: availableMaintenance ? blockedOrders.length : null,
    recentArrivals: upcoming,
    workOrderQueue: openOrders.slice(0, 5).map((row) => ({
      id: row.id,
      label: row.title || row.code || "Maintenance work order",
      status: row.status,
      priority: row.priorityKey ?? "normal",
    })),
    reservationAvailable: availableReservations,
    maintenanceAvailable: availableMaintenance,
  };
}
