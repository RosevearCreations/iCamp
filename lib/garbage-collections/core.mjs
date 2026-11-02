const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const streams = ["garbage", "recycling", "organics"];
export const COLLECTION_OUTCOMES = Object.freeze([
  "collected",
  "not_accessible",
  "not_ready",
  "missed",
]);
export const FINANCE_REVIEW_DECISIONS = Object.freeze([
  "receipt_matched",
  "needs_followup",
  "disputed",
]);

export function requireUuid(value, label) {
  const clean = String(value ?? "").trim();
  if (!uuidPattern.test(clean))
    throw new Error(`${label} must be a valid UUID.`);
  return clean;
}
function bounded(value, label, min, max) {
  const clean = String(value ?? "").trim();
  if (clean.length < min || clean.length > max)
    throw new Error(`${label} must be ${min}–${max} characters.`);
  return clean;
}
export function normalizeCollectionRoute(input) {
  const stream = String(input?.stream ?? "").trim();
  if (!streams.includes(stream)) throw new Error("Invalid route waste stream.");
  const date = String(input?.serviceDate ?? "").trim();
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    Number.isNaN(Date.parse(`${date}T00:00:00Z`)) ||
    new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date
  )
    throw new Error("Provide a valid collection service date.");
  const note = String(input?.note ?? "").trim();
  if (note.length > 1000) throw new Error("Route note is too long.");
  return {
    clientRouteId: requireUuid(input?.clientRouteId, "Route retry ID"),
    name: bounded(input?.name, "Route name", 3, 120),
    stream,
    serviceDate: date,
    note: note || null,
  };
}
export function normalizeCollectionProof(input) {
  const outcome = String(input?.outcome ?? "").trim();
  if (!COLLECTION_OUTCOMES.includes(outcome))
    throw new Error("Invalid collection outcome.");
  const count = Number(input?.bagCount);
  if (
    !Number.isSafeInteger(count) ||
    count < 0 ||
    count > 1000 ||
    (outcome === "collected" && count === 0) ||
    (outcome !== "collected" && count !== 0)
  )
    throw new Error(
      "Collected pickups require a positive bag count; skipped pickups require zero.",
    );
  const reference = String(input?.evidenceReference ?? "").trim();
  if (reference.length > 240 || (reference && reference.length < 4))
    throw new Error("Evidence reference must be 4–240 characters.");
  return {
    routeId: requireUuid(input?.routeId, "Route"),
    pickupId: requireUuid(input?.pickupId, "Pickup"),
    outcome,
    bagCount: count,
    note: bounded(input?.note, "Collection note", 4, 1000),
    evidenceReference: reference || null,
  };
}
export function normalizeFinanceReview(input) {
  const decision = String(input?.decision ?? "").trim();
  if (!FINANCE_REVIEW_DECISIONS.includes(decision))
    throw new Error("Invalid receipt review decision.");
  const value = input?.checkedAmountCents;
  const amount = value === "" || value == null ? null : Number(value);
  if (
    amount !== null &&
    (!Number.isSafeInteger(amount) || amount < 0 || amount > 1000000)
  )
    throw new Error("Checked amount must be valid CAD cents.");
  if (decision === "receipt_matched" && amount === null)
    throw new Error("A matched receipt needs an independently checked amount.");
  return {
    clientReviewId: requireUuid(input?.clientReviewId, "Review retry ID"),
    tagId: requireUuid(input?.tagId, "Tag"),
    decision,
    checkedAmountCents: amount,
    note: bounded(input?.note, "Review note", 4, 1000),
  };
}
