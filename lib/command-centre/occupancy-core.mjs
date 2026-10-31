export function summarizeOccupancyRows(rows, observedAt = new Date()) {
  if (!Array.isArray(rows) || rows.length !== 14) {
    throw new Error("Capacity source must supply fourteen campground dates.");
  }
  const days = rows.map((row) => {
    const fields = [
      "totalSites",
      "operatingSites",
      "pausedSites",
      "bookedSites",
      "heldSites",
      "pendingSites",
    ];
    for (const field of fields) {
      if (!Number.isInteger(row[field]) || row[field] < 0) {
        throw new Error(`Invalid campground capacity field: ${field}.`);
      }
    }
    if (
      row.operatingSites > row.totalSites ||
      row.pausedSites > row.totalSites ||
      row.bookedSites > row.totalSites ||
      row.heldSites > row.totalSites ||
      row.pendingSites > row.totalSites
    ) {
      throw new Error("Capacity source returned impossible site counts.");
    }
    return {
      date: row.date,
      ...Object.fromEntries(fields.map((field) => [field, row[field]])),
      bookedPercent: row.totalSites
        ? Math.round((row.bookedSites / row.totalSites) * 100)
        : 0,
      pausedPercent: row.totalSites
        ? Math.round((row.pausedSites / row.totalSites) * 100)
        : 0,
    };
  });
  return {
    generatedAt: observedAt.toISOString(),
    firstDate: days[0].date,
    days,
    totalSites: days[0].totalSites,
    averageBookedPercent: days.length
      ? Math.round(
          days.reduce((sum, day) => sum + day.bookedPercent, 0) / days.length,
        )
      : 0,
    bookedSiteNights: days.reduce((sum, day) => sum + day.bookedSites, 0),
    heldSiteNights: days.reduce((sum, day) => sum + day.heldSites, 0),
    pausedSiteNights: days.reduce((sum, day) => sum + day.pausedSites, 0),
  };
}
