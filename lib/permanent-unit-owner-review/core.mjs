const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const reviewKinds = [
  "resolution_supported",
  "additional_evidence_needed",
  "resolution_requires_revisit",
];
function uuid(input, name) {
  const value = String(input ?? "").trim();
  if (!uuidPattern.test(value))
    throw new Error(`${name} must be a valid identifier.`);
  return value;
}
function note(input, name, min, max) {
  const value = String(input ?? "").trim();
  if (value.length < min || value.length > max)
    throw new Error(`${name} must be between ${min} and ${max} characters.`);
  if (
    /@|\b(?:sin|ssn|bank.account|routing.number|credit.card)\b|\d{7,}/i.test(
      value,
    )
  )
    throw new Error(
      `${name} must not include contact or financial identifiers.`,
    );
  return value;
}
function common(input) {
  const sourceCampgroundId = uuid(
    input.sourceCampgroundId,
    "Source campground",
  );
  const targetCampgroundId = uuid(
    input.targetCampgroundId,
    "Target campground",
  );
  if (sourceCampgroundId === targetCampgroundId)
    throw new Error(
      "Independent review requires two distinct campground scopes.",
    );
  return {
    id: uuid(input.id, "Record"),
    resolutionId: uuid(input.resolutionId, "Existing owner resolution"),
    planId: uuid(input.planId, "Handoff plan"),
    sourceCampgroundId,
    targetCampgroundId,
    evidenceReference: note(
      input.evidenceReference,
      "Evidence reference",
      8,
      400,
    ),
  };
}
export function normalizeIndependentReview(input, now = new Date()) {
  const data = common(input);
  const reviewKind = String(input.reviewKind ?? "").trim();
  if (!reviewKinds.includes(reviewKind))
    throw new Error("Unknown independent reassessment outcome.");
  const supplied = String(input.nextReviewAt ?? "").trim();
  if (reviewKind === "resolution_supported") {
    if (supplied)
      throw new Error(
        "Supported resolution cannot have an outstanding review deadline.",
      );
    return {
      ...data,
      reviewKind,
      nextReviewAt: null,
      reviewerNote: note(
        input.reviewerNote,
        "Independent reviewer note",
        12,
        800,
      ),
    };
  }
  const due = new Date(
    /^\d{4}-\d{2}-\d{2}$/.test(supplied)
      ? `${supplied}T23:59:00.000Z`
      : supplied,
  );
  if (
    !Number.isFinite(due.getTime()) ||
    due <= now ||
    due.getTime() > now.getTime() + 90 * 86400000
  )
    throw new Error(
      "Unresolved reassessment requires another review within 90 days.",
    );
  return {
    ...data,
    reviewKind,
    nextReviewAt: due.toISOString(),
    reviewerNote: note(
      input.reviewerNote,
      "Independent reviewer note",
      12,
      800,
    ),
  };
}
export function normalizeReviewAcceptance(input) {
  return {
    ...common(input),
    reassessmentId: uuid(input.reassessmentId, "Latest independent review"),
    acceptanceNote: note(input.acceptanceNote, "Acceptance note", 12, 800),
  };
}
export function latestReviewsByResolution(reviews) {
  const latest = new Map();
  for (const review of [...reviews].sort(
    (a, b) =>
      b.reviewedAt.localeCompare(a.reviewedAt) || b.id.localeCompare(a.id),
  )) {
    if (!latest.has(review.resolutionId))
      latest.set(review.resolutionId, review);
  }
  return latest;
}
export function canAcceptReview(review, accepted) {
  return Boolean(
    review && !accepted && review.reviewKind === "resolution_supported",
  );
}
