const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const issueKinds = [
  "all",
  "reconciliation_missing",
  "digest_mismatch",
  "retention_missing",
  "retention_overdue",
];
export const reviewKinds = ["routine_context", "monitor", "followup_proposed"];
export const decisionKinds = [
  "monitor",
  "followup",
  "escalate",
  "closed_no_action",
];

function uuid(value, label) {
  const parsed = String(value ?? "").trim();
  if (!uuidPattern.test(parsed))
    throw new Error(`${label} needs a valid identifier.`);
  return parsed;
}
function safeText(value, label, min, max) {
  const parsed = String(value ?? "").trim();
  if (parsed.length < min || parsed.length > max)
    throw new Error(`${label} requires ${min}–${max} characters.`);
  if (
    /@|\b(?:sin|ssn|bank.account|routing.number|credit.card)\b|\d{7,}/i.test(
      parsed,
    )
  )
    throw new Error(
      `${label} cannot contain contact or financial identifiers.`,
    );
  return parsed;
}
function pair(raw) {
  const sourceCampgroundId = uuid(raw.sourceCampgroundId, "Source campground");
  const targetCampgroundId = uuid(raw.targetCampgroundId, "Target campground");
  if (sourceCampgroundId === targetCampgroundId)
    throw new Error("Select two different campgrounds for owner oversight.");
  return {
    id: uuid(raw.id, "New record"),
    sourceCampgroundId,
    targetCampgroundId,
  };
}
function nextDate(raw, label, now) {
  const value = String(raw ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new Error(`${label} requires a UTC calendar date.`);
  const date = new Date(`${value}T23:59:00.000Z`);
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value ||
    date <= now ||
    date.getTime() > now.getTime() + 90 * 86400000
  )
    throw new Error(`${label} must fall within the next 90 days.`);
  return date.toISOString();
}
export function normalizeOversightReview(raw, now = new Date()) {
  const windowDays = Number(raw.windowDays);
  if (![30, 90, 180].includes(windowDays))
    throw new Error("Review window must be 30, 90 or 180 days.");
  const issueKind = String(raw.issueKind ?? "").trim();
  const reviewKind = String(raw.reviewKind ?? "").trim();
  if (!issueKinds.includes(issueKind) || !reviewKinds.includes(reviewKind))
    throw new Error("Unknown oversight review scope or disposition.");
  return {
    ...pair(raw),
    windowDays,
    issueKind,
    reviewKind,
    nextReviewAt: nextDate(raw.nextReviewAt, "Next oversight review", now),
    evidenceReference: safeText(
      raw.evidenceReference,
      "Evidence reference",
      8,
      400,
    ),
    reviewNote: safeText(raw.reviewNote, "Oversight note", 12, 800),
  };
}
export function normalizeOversightDecision(raw, now = new Date()) {
  const decisionKind = String(raw.decisionKind ?? "").trim();
  if (!decisionKinds.includes(decisionKind))
    throw new Error("Unknown owner oversight decision.");
  const basisCaseId = String(raw.basisCaseId ?? "").trim()
    ? uuid(raw.basisCaseId, "Underlying exception case")
    : null;
  if (decisionKind === "escalate" && !basisCaseId)
    throw new Error("Manual escalation requires an underlying exception case.");
  if (decisionKind === "closed_no_action" && String(raw.nextDueAt ?? "").trim())
    throw new Error(
      "Final no-action decisions cannot have a pending due date.",
    );
  return {
    ...pair(raw),
    reviewId: uuid(raw.reviewId, "Owner review"),
    decisionKind,
    basisCaseId,
    nextDueAt:
      decisionKind === "closed_no_action"
        ? null
        : nextDate(raw.nextDueAt, "Next owner decision", now),
    evidenceReference: safeText(
      raw.evidenceReference,
      "Decision evidence reference",
      8,
      400,
    ),
    decisionNote: safeText(raw.decisionNote, "Decision note", 12, 800),
  };
}
