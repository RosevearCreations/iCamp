export const BUILD203_STATE = "DISCONNECTED / HOLD";
export const BUILD203_REVIEW_STATE = "TWO_SOURCE_CLAIMS_UNVERIFIED";
export const BUILD203_OWNER_ACTIONS = Object.freeze([
  "REQUEST_ISOLATED_TEST",
  "WITHDRAW_ISOLATED_TEST",
]);
const uuid =
  /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const reference =
  /^(?:issue|ticket|review|owner|test|evidence|receipt)-[a-zA-Z0-9][a-zA-Z0-9._-]{4,79}$/;
const digest = /^[a-f0-9]{64}$/;
function object(input, keys) {
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    Object.keys(input).some((key) => !keys.includes(key))
  )
    throw new Error("UNTRUSTED_CUSTODY_OR_AUTHORITY_FIELDS");
}
function id(input, key) {
  if (typeof input[key] !== "string" || !uuid.test(input[key]))
    throw new Error(`INVALID_${key.toUpperCase()}`);
  return input[key].toLowerCase();
}
export function validateBuild203Custody(input) {
  object(input, [
    "action",
    "campgroundId",
    "evidenceId",
    "issuerReceiptRef",
    "issuerClaimedSha256",
  ]);
  if (input.action !== "RECONCILE_SOURCE_CLAIMS")
    throw new Error("INVALID_ACTION");
  const campgroundId = id(input, "campgroundId");
  const evidenceId = id(input, "evidenceId");
  if (
    typeof input.issuerReceiptRef !== "string" ||
    !reference.test(input.issuerReceiptRef)
  )
    throw new Error("INVALID_ISSUER_REFERENCE");
  if (
    typeof input.issuerClaimedSha256 !== "string" ||
    !digest.test(input.issuerClaimedSha256)
  )
    throw new Error("INVALID_ISSUER_CLAIMED_DIGEST");
  return Object.freeze({
    campgroundId,
    evidenceId,
    issuerReceiptRef: input.issuerReceiptRef,
    issuerClaimedSha256: input.issuerClaimedSha256,
    disposition: BUILD203_REVIEW_STATE,
  });
}
export function validateBuild203OwnerIntent(input, now = new Date()) {
  object(input, [
    "action",
    "campgroundId",
    "custodyReviewId",
    "decision",
    "expiresAt",
    "scopeAcknowledged",
    "requestId",
  ]);
  if (
    input.action !== "OWNER_TEST_INTENT" ||
    !BUILD203_OWNER_ACTIONS.includes(input.decision)
  )
    throw new Error("INVALID_OWNER_TEST_ACTION");
  const campgroundId = id(input, "campgroundId");
  const custodyReviewId = id(input, "custodyReviewId");
  const requestId = id(input, "requestId");
  const requesting = input.decision === "REQUEST_ISOLATED_TEST";
  if (
    requesting !== (input.scopeAcknowledged === true) ||
    (!requesting && input.scopeAcknowledged !== false)
  )
    throw new Error("ISOLATED_TEST_SCOPE_NOT_ACKNOWLEDGED");
  let expiresAt = null;
  if (requesting) {
    if (
      typeof input.expiresAt !== "string" ||
      !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d/.test(input.expiresAt)
    )
      throw new Error("INVALID_TEST_WINDOW");
    const expiry = new Date(input.expiresAt);
    const duration = expiry.getTime() - now.getTime();
    if (
      !Number.isFinite(duration) ||
      duration < 5 * 60000 ||
      duration > 24 * 3600000
    )
      throw new Error("TEST_WINDOW_MUST_BE_FIVE_MINUTES_TO_24_HOURS");
    expiresAt = expiry.toISOString();
  } else if (input.expiresAt !== null) {
    throw new Error("WITHDRAWAL_CANNOT_DECLARE_EXPIRY");
  }
  return Object.freeze({
    campgroundId,
    custodyReviewId,
    requestId,
    decision: input.decision,
    expiresAt,
    scopeAcknowledged: requesting,
    disposition: "LOCAL_OWNER_INTENT_ONLY",
  });
}
export function build203ReviewReadback(
  evidence = [],
  reviews = [],
  ownerEvents = [],
  now = new Date(),
) {
  const reviewed = reviews.slice(0, 100).map((row) => ({
    id: row.id,
    evidenceId: row.evidence_id,
    issuerReceiptRef: row.issuer_receipt_ref,
    issuerClaimedSha256: row.issuer_claimed_sha256,
    claimedDigestComparison:
      row.issuer_claimed_sha256 === row.source_claimed_sha256
        ? "CLAIMS_MATCH_NOT_VERIFIED"
        : "CLAIM_CONFLICT_REQUIRES_INDEPENDENT_RESOLUTION",
    submittedAt: new Date(row.created_at).toISOString(),
    disposition: BUILD203_REVIEW_STATE,
    independentVerification: false,
  }));
  const ownerIntents = ownerEvents.slice(0, 100).map((row) => ({
    id: row.id,
    custodyReviewId: row.custody_review_id,
    decision: row.decision,
    expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : null,
    submittedAt: new Date(row.created_at).toISOString(),
    disposition: "LOCAL_OWNER_INTENT_ONLY",
    independentAuthority: false,
  }));
  const latest = ownerIntents[0];
  const ownerIntentState = !latest
    ? "NO_OWNER_INTENT_RECORDED"
    : latest.decision === "WITHDRAW_ISOLATED_TEST"
      ? "OWNER_INTENT_WITHDRAWN"
      : !latest.expiresAt || Date.parse(latest.expiresAt) <= now.getTime()
        ? "OWNER_INTENT_EXPIRED"
        : "SCOPED_TEST_INTENT_RECORDED_NOT_AUTHORIZED";
  return Object.freeze({
    schema: "icamp.build203.custody-owner-test.v1",
    evidence: evidence.slice(0, 100),
    reviews: reviewed,
    ownerIntents,
    ownerIntentState,
    connection_state: BUILD203_STATE,
    issuer_independently_verified: false,
    peer_enrolled: false,
    signed_test_witness_observed: false,
    external_requests_or_writes: false,
  });
}
export function build203Runbook(report) {
  const tasks = [
    "Confirm original-source issuer independently by callback and signed manifest; record custody outside the application.",
    "Compare independent original issuer digest to the submitted evidence claim; resolve conflicts with a second witness.",
    "Confirm isolated TEST endpoint, single campground entitlement, and independent master-owner authorization.",
    "Require source-owned KMS, pinned workload identity, and durable atomic nonce replay prevention.",
    "Run one scoped signed GET with a fresh challenge only after independent TEST authorization; retain receipt and denial tests.",
    "Reconcile both source and Comms Hub receipts, revoke TEST entitlement, and record owner decision before any future go-live review.",
  ];
  return Object.freeze({
    schema: "icamp.build203.nonproduction-runbook.v1",
    mode: "READ_ONLY_INSTRUCTIONS",
    connection_state: BUILD203_STATE,
    ownerIntentState: report?.ownerIntentState ?? "NO_OWNER_INTENT_RECORDED",
    externalAuthorityVerified: false,
    authorizeHandshake: false,
    liveCallsOrMessages: false,
    steps: tasks.map((instruction, index) => ({
      order: index + 1,
      instruction,
      status: "MANUAL_EVIDENCE_REQUIRED",
    })),
  });
}
