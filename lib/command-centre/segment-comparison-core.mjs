export const SEGMENT_KINDS = ["campsite", "rental_cottage", "permanent_unit"];

export function summarizeSegmentComparisons(rows, observedAt = new Date()) {
  if (!Array.isArray(rows) || rows.length !== 18) {
    throw new Error(
      "Segment comparisons require six months for three accommodation types.",
    );
  }
  const found = new Map();
  const segments = SEGMENT_KINDS.map((kind) => ({
    kind,
    months: [],
    siteNights: 0,
    bookedNights: 0,
    seasonalNights: 0,
    reservationNights: 0,
    bookedPercent: 0,
  }));
  const expectedMonths = [];
  for (const row of rows) {
    if (
      !/^\d{4}-\d{2}-01$/.test(row.month) ||
      !SEGMENT_KINDS.includes(row.kind)
    ) {
      throw new Error("Invalid utilization segment or month.");
    }
    for (const key of [
      "siteNights",
      "bookedNights",
      "seasonalNights",
      "reservationNights",
    ]) {
      if (!Number.isSafeInteger(row[key]) || row[key] < 0) {
        throw new Error(`Invalid segment site-night count: ${key}.`);
      }
    }
    if (
      row.bookedNights > row.siteNights ||
      row.seasonalNights > row.siteNights ||
      row.reservationNights > row.siteNights ||
      row.bookedNights > row.seasonalNights + row.reservationNights
    ) {
      throw new Error("Impossible segment utilization counts.");
    }
    const key = `${row.month}:${row.kind}`;
    if (found.has(key)) throw new Error("Duplicate segment-month row.");
    found.set(key, row);
    if (!expectedMonths.includes(row.month)) expectedMonths.push(row.month);
  }
  expectedMonths.sort();
  if (expectedMonths.length !== 6)
    throw new Error("Segment months are incomplete.");
  for (let index = 1; index < expectedMonths.length; index++) {
    const date = new Date(`${expectedMonths[index - 1]}T00:00:00Z`);
    date.setUTCMonth(date.getUTCMonth() + 1);
    if (date.toISOString().slice(0, 10) !== expectedMonths[index]) {
      throw new Error("Segment months must be consecutive.");
    }
  }
  for (const segment of segments) {
    segment.months = expectedMonths.map((month) => {
      const row = found.get(`${month}:${segment.kind}`);
      if (!row) throw new Error("Missing segment-month row.");
      for (const key of [
        "siteNights",
        "bookedNights",
        "seasonalNights",
        "reservationNights",
      ]) {
        segment[key] += row[key];
      }
      return {
        ...row,
        bookedPercent: row.siteNights
          ? Math.round((row.bookedNights / row.siteNights) * 100)
          : 0,
      };
    });
    segment.bookedPercent = segment.siteNights
      ? Math.round((segment.bookedNights / segment.siteNights) * 100)
      : 0;
  }
  return {
    generatedAt: observedAt.toISOString(),
    months: expectedMonths,
    segments,
  };
}
