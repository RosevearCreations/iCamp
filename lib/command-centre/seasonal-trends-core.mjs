export function summarizeSeasonalTrends(rows, observedAt = new Date()) {
  if (!Array.isArray(rows) || rows.length !== 6) {
    throw new Error("Seasonal utilization requires six monthly periods.");
  }
  const months = rows.map((row, index) => {
    if (!/^\d{4}-\d{2}-01$/.test(row.month)) {
      throw new Error(`Invalid utilization period at index ${index}.`);
    }
    for (const key of [
      "siteNights",
      "bookedNights",
      "seasonalNights",
      "reservationNights",
    ]) {
      if (!Number.isSafeInteger(row[key]) || row[key] < 0) {
        throw new Error(`Invalid utilization count: ${key}.`);
      }
    }
    if (
      row.bookedNights > row.siteNights ||
      row.seasonalNights > row.siteNights ||
      row.reservationNights > row.siteNights ||
      row.bookedNights > row.seasonalNights + row.reservationNights
    ) {
      throw new Error("Impossible seasonal site-night totals.");
    }
    return {
      ...row,
      bookedPercent: row.siteNights
        ? Math.round((row.bookedNights / row.siteNights) * 100)
        : 0,
      seasonalPercent: row.siteNights
        ? Math.round((row.seasonalNights / row.siteNights) * 100)
        : 0,
    };
  });
  for (let index = 1; index < months.length; index++) {
    const previous = months[index - 1].month;
    const expected = new Date(`${previous}T00:00:00Z`);
    expected.setUTCMonth(expected.getUTCMonth() + 1);
    if (months[index].month !== expected.toISOString().slice(0, 10)) {
      throw new Error("Utilization periods must be consecutive months.");
    }
  }
  const totals = months.reduce(
    (all, month) => ({
      siteNights: all.siteNights + month.siteNights,
      bookedNights: all.bookedNights + month.bookedNights,
      seasonalNights: all.seasonalNights + month.seasonalNights,
      reservationNights: all.reservationNights + month.reservationNights,
    }),
    { siteNights: 0, bookedNights: 0, seasonalNights: 0, reservationNights: 0 },
  );
  return {
    generatedAt: observedAt.toISOString(),
    months,
    ...totals,
    averageBookedPercent: totals.siteNights
      ? Math.round((totals.bookedNights / totals.siteNights) * 100)
      : 0,
  };
}
