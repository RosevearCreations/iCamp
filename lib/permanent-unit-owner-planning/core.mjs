const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const metrics = [
  "consents",
  "holds",
  "clears",
  "created_tasks",
  "closed_tasks",
];
const dispositions = [
  "routine_context",
  "monitor_next_cycle",
  "propose_followup",
];
const scopes = [
  "followup_coordination",
  "exception_review_planning",
  "trend_pattern_review",
];
function uuid(value, label) {
  const result = String(value ?? "").trim();
  if (!uuidPattern.test(result))
    throw new Error(`${label} must be a valid identifier.`);
  return result;
}
function choice(value, choices, label) {
  const result = String(value ?? "").trim();
  if (!choices.includes(result))
    throw new Error(`${label} is not an allowed option.`);
  return result;
}
function safeText(value, label, min, max) {
  const result = String(value ?? "").trim();
  if (result.length < min || result.length > max)
    throw new Error(`${label} must be between ${min} and ${max} characters.`);
  // Owner-level planning holds workflow context only. No email, phone, bank or ID details.
  if (
    /@|\b(?:sin|ssn|bank.account|routing.number|credit.card)\b|\d{7,}/i.test(
      result,
    )
  )
    throw new Error(
      `${label} must not include applicant contact or financial identifiers.`,
    );
  return result;
}
export function utcWeekOptions(now = new Date()) {
  const monday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  return Array.from({ length: 12 }, (_, index) => {
    const d = new Date(monday);
    d.setUTCDate(d.getUTCDate() - 7 * index);
    return d.toISOString().slice(0, 10);
  });
}
function upcoming(value, label, now = new Date()) {
  const supplied = String(value ?? "").trim();
  const date = new Date(
    /^\d{4}-\d{2}-\d{2}$/.test(supplied)
      ? `${supplied}T23:59:00.000Z`
      : supplied,
  );
  if (
    !Number.isFinite(date.getTime()) ||
    date <= now ||
    date.getTime() > now.getTime() + 90 * 86400000
  )
    throw new Error(`${label} must be in the next 90 days.`);
  return date.toISOString();
}
export function normalizeTrendAnnotation(input, now = new Date()) {
  const weekStart = String(input.weekStart ?? "").trim();
  if (!utcWeekOptions(now).includes(weekStart))
    throw new Error("Review week must be one of the last 12 UTC weeks.");
  return {
    id: uuid(input.id, "Annotation ID"),
    campgroundId: uuid(input.campgroundId, "Campground ID"),
    weekStart,
    metric: choice(input.metric, metrics, "Trend metric"),
    disposition: choice(input.disposition, dispositions, "Review disposition"),
    evidenceReference: safeText(
      input.evidenceReference,
      "Evidence reference",
      8,
      400,
    ),
    note: safeText(input.note, "Trend note", 12, 800),
    nextReviewAt: upcoming(input.nextReviewAt, "Next review", now),
  };
}
export function normalizeHandoffPlan(input, now = new Date()) {
  const sourceCampgroundId = uuid(
    input.sourceCampgroundId,
    "Source campground",
  );
  const targetCampgroundId = uuid(
    input.targetCampgroundId,
    "Target campground",
  );
  if (sourceCampgroundId === targetCampgroundId)
    throw new Error("Source and target campgrounds must be different.");
  return {
    id: uuid(input.id, "Handoff plan ID"),
    sourceCampgroundId,
    targetCampgroundId,
    sourceAnnotationId: uuid(input.sourceAnnotationId, "Source annotation"),
    planningScope: choice(input.planningScope, scopes, "Handoff scope"),
    dueAt: upcoming(input.dueAt, "Handoff planning date", now),
    evidenceReference: safeText(
      input.evidenceReference,
      "Evidence reference",
      8,
      400,
    ),
    ownerNote: safeText(input.ownerNote, "Owner planning note", 12, 800),
  };
}
