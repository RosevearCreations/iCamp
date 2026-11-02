const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const reopenKinds = ["monitor", "exception_hold", "reopen_recommended"];
export function normalizeAcceptanceExceptionReview(raw) {
  const result = {};
  for (const key of [
    "id",
    "acceptanceId",
    "sourceCampgroundId",
    "targetCampgroundId",
  ]) {
    result[key] = String(raw[key] ?? "").trim();
    if (!uuid.test(result[key]))
      throw new Error(`${key} requires a valid identifier.`);
  }
  if (result.sourceCampgroundId === result.targetCampgroundId)
    throw new Error("Two different campground scopes are required.");
  result.reviewKind = String(raw.reviewKind ?? "").trim();
  if (!reopenKinds.includes(result.reviewKind))
    throw new Error("Unknown acceptance exception review kind.");
  for (const [key, min, max] of [
    ["evidenceReference", 8, 400],
    ["reviewNote", 12, 800],
  ]) {
    result[key] = String(raw[key] ?? "").trim();
    if (
      result[key].length < min ||
      result[key].length > max ||
      /@|\d{7,}|\b(?:sin|ssn|bank.account|credit.card)\b/i.test(result[key])
    )
      throw new Error(
        `${key} must be ${min}–${max} characters with no contact or financial identifiers.`,
      );
  }
  return result;
}
