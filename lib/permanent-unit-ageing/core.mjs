import { unitId } from "../permanent-unit-market/core.mjs";
function bounded(value, label, min = 8, max = 400) {
  const s = String(value ?? "").trim();
  if (s.length < min || s.length > max)
    throw new Error(`${label} requires ${min}–${max} characters.`);
  return s;
}
function isoFuture(value, label, maxDays) {
  const date = new Date(String(value ?? ""));
  if (
    !Number.isFinite(date.getTime()) ||
    date.getTime() <= Date.now() ||
    date.getTime() > Date.now() + maxDays * 86400000
  )
    throw new Error(`${label} must be a future date within ${maxDays} days.`);
  return date.toISOString();
}
export function ageBand(when, now = Date.now()) {
  const time = new Date(String(when ?? "")).getTime();
  if (!Number.isFinite(time)) return "unknown";
  const hours = Math.max(0, (now - time) / 3600000);
  return hours >= 72
    ? "critical_72h"
    : hours >= 24
      ? "overdue_24h"
      : "within_24h";
}
export function normalizeExceptionReview(input) {
  const observationState = String(input.observationState ?? "");
  const reviewDecision = String(input.reviewDecision ?? "");
  if (!["open_hold", "cleared_history", "followup"].includes(observationState))
    throw new Error("Exception state must match current history.");
  if (
    ![
      "continue_monitoring",
      "request_owner_escalation",
      "recommend_manual_clearance",
    ].includes(reviewDecision)
  )
    throw new Error("Unsupported independent exception review decision.");
  if (
    reviewDecision === "recommend_manual_clearance" &&
    observationState !== "open_hold"
  )
    throw new Error(
      "Only an active hold can be recommended for manual clearance.",
    );
  return {
    id: unitId(input.id),
    consentId: unitId(input.consentId, "Consent"),
    reconciliationId: input.reconciliationId
      ? unitId(input.reconciliationId, "Reconciliation")
      : null,
    exceptionEventId: input.exceptionEventId
      ? unitId(input.exceptionEventId, "Exception event")
      : null,
    observationState,
    reviewDecision,
    nextReviewAt: isoFuture(input.nextReviewAt, "Next review", 90),
    evidenceReference: bounded(input.evidenceReference, "Review source"),
    note: bounded(input.note, "Review rationale", 12, 800),
  };
}
export function normalizeOwnerEscalation(input) {
  const priority = String(input.priority ?? "");
  if (!["standard", "urgent", "critical"].includes(priority))
    throw new Error(
      "Owner escalation priority must be standard, urgent or critical.",
    );
  return {
    id: unitId(input.id),
    exceptionReviewId: unitId(input.exceptionReviewId, "Exception review"),
    targetOwnerUserId: unitId(input.targetOwnerUserId, "Owner"),
    priority,
    escalationReference: bounded(
      input.escalationReference,
      "Restricted escalation source",
    ),
    requestedAction: bounded(
      input.requestedAction,
      "Owner action request",
      12,
      800,
    ),
    dueAt: isoFuture(input.dueAt, "Owner response due", 30),
  };
}
export function normalizeOwnerResponse(input) {
  const response = String(input.response ?? "");
  if (!["accepted_followup", "returned_for_rework"].includes(response))
    throw new Error(
      "Owner response must accept follow-up or return for rework.",
    );
  return {
    id: unitId(input.id),
    escalationId: unitId(input.escalationId, "Escalation"),
    response,
    evidenceReference: bounded(
      input.evidenceReference,
      "Owner response evidence",
    ),
    note: bounded(input.note, "Owner response note", 12, 800),
  };
}
