const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const RULE_CATEGORIES = Object.freeze([
  "campground",
  "pool",
  "waterfront",
  "sports",
  "playground",
  "event",
  "access",
]);

export function validUuid(value, label = "Identifier") {
  const result = String(value ?? "").trim();
  if (!uuid.test(result)) throw new Error(`${label} must be a valid UUID.`);
  return result;
}

export function normalizeRuleSet(input) {
  const code = String(input?.code ?? "")
    .trim()
    .toUpperCase();
  if (!/^[A-Z][A-Z0-9_-]{2,39}$/.test(code))
    throw new Error(
      "Rule code must contain 3–40 letters, numbers, dashes or underscores.",
    );
  const title = String(input?.title ?? "").trim();
  if (title.length < 4 || title.length > 160)
    throw new Error("Rule title must contain 4–160 characters.");
  const category = String(input?.category ?? "").trim();
  if (!RULE_CATEGORIES.includes(category))
    throw new Error("Unknown rule category.");
  const facilityId = String(input?.facilityId ?? "").trim();
  if (category === "campground" && facilityId)
    throw new Error("Campground-wide rules cannot target one facility.");
  return {
    code,
    title,
    category,
    facilityId: facilityId ? validUuid(facilityId, "Facility") : null,
  };
}

export function normalizeRulePublication(input) {
  const content = String(input?.content ?? "").trim();
  if (content.length < 30 || content.length > 10000)
    throw new Error("Published rules require 30–10,000 characters.");
  const expected = Number(input?.expectedVersion);
  if (!Number.isSafeInteger(expected) || expected < 0 || expected > 999999)
    throw new Error(
      "Expected version is invalid. Refresh the rules before publishing.",
    );
  return {
    ruleSetId: validUuid(input?.ruleSetId, "Rule set"),
    clientPublicationId: validUuid(
      input?.clientPublicationId,
      "Publication retry ID",
    ),
    expectedVersion: expected,
    content,
    acknowledgementRequired: input?.acknowledgementRequired === true,
  };
}

export function normalizeRuleAcknowledgement(input) {
  return {
    reservationId: validUuid(input?.reservationId, "Reservation"),
    ruleSetId: validUuid(input?.ruleSetId, "Rule set"),
    ruleVersionId: validUuid(input?.ruleVersionId, "Published rule version"),
  };
}
