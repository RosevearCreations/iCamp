// Build 266: case-derived SLA indicators, not a promise of staffed 24/7 support.
// Computation uses original persisted case timestamps; missing evidence stays UNKNOWN.
export const RESPONSE_TARGET_HOURS266 = Object.freeze({critical: 1,priority: 8,routine: 48});
export function supportSla266(rows, now = new Date()) {
  if (!(now instanceof Date) || Number.isNaN(now.valueOf())) throw Error("Valid observation clock required.");
  const cases = Array.isArray(rows) ? rows : [];
  const result = { observed: cases.length, unresolved: 0, overdueResponse: 0, responseObserved: 0, responseUnknown: 0, missingTimestamp: 0, bySeverity: {critical:0,priority:0,routine:0} };
  for (const entry of cases) {
    const severity = entry.severity;
    if (!Object.hasOwn(RESPONSE_TARGET_HOURS266,severity)) continue;
    result.bySeverity[severity]++;
    if (entry.status === "resolved") continue;
    result.unresolved++;
    const created = new Date(entry.created_at ?? entry.createdAt);
    if (Number.isNaN(created.valueOf()) || created > now) { result.missingTimestamp++; continue; }
    const reviewedValue = entry.reviewed_at ?? entry.reviewedAt;
    const reviewed = reviewedValue == null ? null : new Date(reviewedValue);
    if (reviewed && !Number.isNaN(reviewed.valueOf()) && reviewed >= created && reviewed <= now) {
      result.responseObserved++;
    } else {
      result.responseUnknown++;
      if (now.valueOf() - created.valueOf() > RESPONSE_TARGET_HOURS266[severity]*3600000) result.overdueResponse++;
    }
  }
  return result;
}
