const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const reassessmentKinds = [
  "continue_monitoring",
  "evidence_needed",
  "escalation_recommended",
  "closure_recommended",
];
export const agingFilters = [
  "all",
  "overdue",
  "due_week",
  "due_month",
  "later",
  "closure_recommended",
  "closed_no_action",
];
function uuid(raw, name) {
  const value = String(raw ?? "").trim();
  if (!uuidPattern.test(value))
    throw new Error(`${name} must be a valid identifier.`);
  return value;
}
function safeText(raw, name, min, max) {
  const value = String(raw ?? "").trim();
  if (value.length < min || value.length > max)
    throw new Error(`${name} must contain ${min}–${max} characters.`);
  if (
    /@|\b(?:sin|ssn|bank.account|routing.number|credit.card)\b|\d{7,}/i.test(
      value,
    )
  )
    throw new Error(`${name} cannot contain contact or financial identifiers.`);
  return value;
}
function deadline(raw, now) {
  const value = String(raw ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new Error("Next review needs a UTC calendar date.");
  const date = new Date(`${value}T23:59:00.000Z`);
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value ||
    date <= now ||
    date.getTime() > now.getTime() + 90 * 86400000
  )
    throw new Error("Next review must fall within the next 90 days.");
  return date.toISOString();
}
export function normalizeAgingFilter(raw) {
  const value = String(raw ?? "all").trim();
  return agingFilters.includes(value) ? value : "all";
}
export function classifyOwnerDecisionAging(
  { decisionKind, assessmentKind, effectiveDueAt },
  now = new Date(),
) {
  if (decisionKind === "closed_no_action") return "closed_no_action";
  if (assessmentKind === "closure_recommended") return "closure_recommended";
  const due = effectiveDueAt ? new Date(effectiveDueAt).getTime() : NaN;
  if (!Number.isFinite(due)) return "overdue";
  const days = (due - now.getTime()) / 86400000;
  if (days < 0) return "overdue";
  if (days <= 7) return "due_week";
  if (days <= 30) return "due_month";
  return "later";
}
export function normalizeOwnerDecisionReassessment(raw, now = new Date()) {
  const id = uuid(raw.id, "New reassessment");
  const decisionId = uuid(raw.decisionId, "Owner decision");
  const sourceCampgroundId = uuid(raw.sourceCampgroundId, "Source campground");
  const targetCampgroundId = uuid(raw.targetCampgroundId, "Target campground");
  if (sourceCampgroundId === targetCampgroundId)
    throw new Error("Select two different campground scopes.");
  const assessmentKind = String(raw.assessmentKind ?? "").trim();
  if (!reassessmentKinds.includes(assessmentKind))
    throw new Error("Unknown independent reassessment disposition.");
  const basisCaseId = String(raw.basisCaseId ?? "").trim()
    ? uuid(raw.basisCaseId, "Source exception case")
    : null;
  if (assessmentKind === "escalation_recommended" && !basisCaseId)
    throw new Error(
      "Escalation recommendation must cite one unresolved exception case.",
    );
  if (
    assessmentKind === "closure_recommended" &&
    String(raw.nextDueAt ?? "").trim()
  )
    throw new Error(
      "Closure recommendation cannot set an active reassessment due date.",
    );
  return {
    id,
    decisionId,
    sourceCampgroundId,
    targetCampgroundId,
    assessmentKind,
    basisCaseId,
    nextDueAt:
      assessmentKind === "closure_recommended"
        ? null
        : deadline(raw.nextDueAt, now),
    evidenceReference: safeText(
      raw.evidenceReference,
      "Evidence reference",
      8,
      400,
    ),
    reassessmentNote: safeText(
      raw.reassessmentNote,
      "Independent reassessment note",
      12,
      800,
    ),
  };
}
