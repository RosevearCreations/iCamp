import { unitId } from "../permanent-unit-market/core.mjs";
const reasons = [
  "identity_mismatch",
  "disclosure_dispute",
  "delivery_failure",
  "consent_withdrawn",
  "other",
];
const decisions = [
  "continue_monitoring",
  "recommend_owner_review",
  "record_pattern_for_followup",
];
export function normalizeRecurrenceReview(input) {
  const reasonCode = String(input.reasonCode ?? "");
  const reviewDisposition = String(input.reviewDisposition ?? "");
  if (!reasons.includes(reasonCode))
    throw new Error("Unknown finance exception reason.");
  if (!decisions.includes(reviewDisposition))
    throw new Error("Unsupported recurrence review decision.");
  const observedReasonHoldCount = Number(input.observedReasonHoldCount);
  const observedEscalationCount = Number(input.observedEscalationCount);
  if (
    !Number.isSafeInteger(observedReasonHoldCount) ||
    observedReasonHoldCount < 2 ||
    !Number.isSafeInteger(observedEscalationCount) ||
    observedEscalationCount < 0
  )
    throw new Error("Recurrence counts must match repeated event history.");
  const when = Date.parse(String(input.nextReviewAt ?? ""));
  if (
    !Number.isFinite(when) ||
    when <= Date.now() ||
    when > Date.now() + 90 * 86400000
  )
    throw new Error("Next review must be in the next 90 days.");
  const text = (value, label, min, max) => {
    const s = String(value ?? "").trim();
    if (s.length < min || s.length > max)
      throw new Error(`${label} needs ${min}–${max} characters.`);
    return s;
  };
  return {
    id: unitId(input.id),
    consentId: unitId(input.consentId, "Consent"),
    latestExceptionEventId: unitId(input.latestExceptionEventId, "Exception"),
    reasonCode,
    reviewDisposition,
    observedReasonHoldCount,
    observedEscalationCount,
    nextReviewAt: new Date(when).toISOString(),
    evidenceReference: text(
      input.evidenceReference,
      "Evidence reference",
      8,
      400,
    ),
    note: text(input.note, "Review note", 12, 800),
  };
}
export function classifyPortfolio(row, now = Date.now()) {
  const openTasks = Number(row.open_tasks ?? 0),
    overdueTasks = Number(row.overdue_tasks ?? 0),
    repeatedReasons = (row.reasons ?? []).filter(
      (r) => Number(r.hold_count) >= 2,
    );
  return {
    status:
      row.latest_event_type === "hold"
        ? "active_hold"
        : openTasks > 0
          ? "owner_followup"
          : "monitoring",
    openTasks,
    overdueTasks,
    recurrences: repeatedReasons,
    attention:
      row.latest_event_type === "hold" ||
      overdueTasks > 0 ||
      repeatedReasons.length > 0,
    staleReview: repeatedReasons.some(
      (r) => !r.next_review_at || Date.parse(r.next_review_at) <= now,
    ),
  };
}
export function summarizePortfolio(rows, now = Date.now()) {
  const states = rows.map((r) => classifyPortfolio(r, now));
  return {
    consents: rows.length,
    activeHolds: states.filter((s) => s.status === "active_hold").length,
    openOwnerTasks: states.reduce((n, s) => n + s.openTasks, 0),
    overdueOwnerTasks: states.reduce((n, s) => n + s.overdueTasks, 0),
    recurringConsents: states.filter((s) => s.recurrences.length > 0).length,
    pendingRecurrenceReviews: states.filter((s) => s.staleReview).length,
  };
}
