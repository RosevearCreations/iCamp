export const feedbackCategories = Object.freeze([
  "stay",
  "amenities",
  "staff",
  "accessibility",
  "activities",
  "other",
]);
export const feedbackRecoveryStages = Object.freeze([
  "reviewing",
  "action_planned",
  "resolved",
  "not_actionable",
]);

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export function feedbackUuid(value, label = "Identifier") {
  const text = String(value ?? "").trim();
  if (!UUID.test(text)) throw new Error(`${label} must be a UUID.`);
  return text;
}

export function feedbackText(value, label, min, max) {
  const text = String(value ?? "").trim();
  if (text.length < min || text.length > max || /\p{Cc}/u.test(text))
    throw new Error(`${label} must contain ${min}–${max} readable characters.`);
  return text;
}

export function normalizeGuestFeedback(input) {
  const rating = Number(input?.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5)
    throw new Error("Rating must be 1–5 stars.");
  const category = String(input?.category ?? "").trim();
  if (!feedbackCategories.includes(category))
    throw new Error("Feedback category is invalid.");
  const caseValue = String(input?.assistanceCaseId ?? "").trim();
  return {
    rating,
    category,
    title: feedbackText(input?.title, "Review title", 4, 120),
    publicSummary: feedbackText(
      input?.publicSummary,
      "Review summary",
      20,
      1000,
    ),
    privateDetails: feedbackText(
      input?.privateDetails,
      "Private incident details",
      0,
      2000,
    ),
    publicRequested: input?.publicRequested === true,
    assistanceCaseId: caseValue
      ? feedbackUuid(caseValue, "Service case")
      : null,
  };
}

export function normalizeFeedbackDecision(input) {
  const decision = String(input?.decision ?? "").trim();
  if (!["approved", "declined"].includes(decision))
    throw new Error("Moderation decision is invalid.");
  return {
    decision,
    reason: feedbackText(
      input?.reason,
      "Moderation explanation",
      decision === "declined" ? 10 : 0,
      500,
    ),
  };
}

export function normalizeFeedbackAppeal(value) {
  return feedbackText(value, "Moderation appeal", 10, 600);
}

export function feedbackDate(value) {
  const text = String(value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(text))
    throw new Error("Follow-up date must be YYYY-MM-DD.");
  const [y, m, d] = text.split("-").map(Number);
  const parsed = new Date(Date.UTC(y, m - 1, d));
  if (parsed.toISOString().slice(0, 10) !== text)
    throw new Error("Follow-up date is invalid.");
  return text;
}

export function normalizeFeedbackRecovery(input) {
  const stage = String(input?.stage ?? "").trim();
  if (!feedbackRecoveryStages.includes(stage))
    throw new Error("Recovery stage is invalid.");
  const due = String(input?.dueDate ?? "").trim();
  return {
    stage,
    dueDate: due ? feedbackDate(due) : null,
    internalNote: feedbackText(
      input?.internalNote,
      "Private staff note",
      0,
      800,
    ),
    guestVisibleSummary: recoveryResponseTemplate(stage),
  };
}

// Fixed, accessible and respectful in-app response templates. This is not a
// message provider integration or a promise of remediation or compensation.
export function recoveryResponseTemplate(stage) {
  const templates = {
    reviewing:
      "Our campground team is reviewing your feedback. We will record a follow-up update here when available.",
    action_planned:
      "The campground team has recorded a follow-up action for review. Timing and outcomes are not guaranteed.",
    resolved:
      "Staff marked the feedback follow-up reviewed. This does not confirm a refund, compensation or a change to any separate assistance case.",
    not_actionable:
      "The campground team recorded that no actionable change was confirmed from this feedback. You can contact the office to discuss it.",
  };
  if (!Object.hasOwn(templates, stage))
    throw new Error("Recovery response stage is invalid.");
  return templates[stage];
}

export function feedbackPublicLabel(review) {
  return `${review.rating} of 5 stars · verified completed stay`;
}
