import { createHash } from "node:crypto";

const requestKinds = new Set([
  "access",
  "correction",
  "retention_review",
  "erasure_review",
  "consent_question",
]);
const subjectAreas = new Set(["profile", "stays", "communications", "all"]);
const reviewOutcomes = {
  in_review: "policy_review",
  information_needed: "verifying_identity",
  retention_hold_review: "legal_hold_review",
  manual_action_required: "manual_followup",
  fulfilled_external: "completed_outside_app",
  closed_no_action: "not_applicable",
};
const sourcePattern = /^[A-Za-z0-9][A-Za-z0-9._:/-]{7,119}$/u;

export const privacyRequestKinds = [...requestKinds];
export const privacySubjectAreas = [...subjectAreas];
export const privacyReviewEvents = Object.keys(reviewOutcomes);

export function normalizePrivacyRequest(input) {
  const requestKind = String(input?.requestKind ?? "").trim();
  const subjectArea = String(input?.subjectArea ?? "").trim();
  if (!requestKinds.has(requestKind) || !subjectAreas.has(subjectArea))
    throw new Error("Select a supported privacy request and subject area.");
  return { requestKind, subjectArea };
}

export function normalizePrivacyReview(input) {
  const eventKind = String(input?.eventKind ?? "").trim();
  if (!Object.hasOwn(reviewOutcomes, eventKind))
    throw new Error("Select a supported privacy review decision.");
  const sourceReference = String(input?.sourceReference ?? "").trim();
  if (sourceReference && !sourcePattern.test(sourceReference))
    throw new Error(
      "Use a source ticket ID (8–120 letters, digits or ._:/-), not personal details.",
    );
  if (
    [
      "manual_action_required",
      "fulfilled_external",
      "closed_no_action",
    ].includes(eventKind) &&
    !sourceReference
  )
    throw new Error(
      "Closure needs a recorded external source ticket reference.",
    );
  return {
    eventKind,
    outcomeCode: reviewOutcomes[eventKind],
    sourceReference: sourceReference || null,
  };
}

export function isPrivacyTerminal(eventKind) {
  return eventKind === "fulfilled_external" || eventKind === "closed_no_action";
}

// Entire export is generated server-side for an authenticated guest's own
// campground. Exclude free-text staff events, endpoint values, tokens and IDs.
export function buildOwnPrivacyExport({
  campgroundId,
  campgroundName,
  exportedAt,
  detail,
  privacy,
  records,
}) {
  const body = {
    schema: "icamp.guest-privacy.v1",
    build: 197,
    generatedAt: exportedAt,
    campgroundId,
    campgroundName,
    coverage: {
      reservations: "Latest 100 account-linked stays across all statuses",
      receipts: "Latest 100 account-linked receipts",
      consentEvents:
        "Latest 100 privacy-control and linked-endpoint consent events",
      privacyRequests: "Latest 100 requests",
      profileRequired: false,
      incomplete: Boolean(privacy.truncated || records.truncated),
    },
    savedProfile: detail
      ? {
          ...detail.profile,
          rvs: detail.rvs,
          vehicles: detail.vehicles,
          pets: detail.pets,
        }
      : null,
    stayHistory: records.stays,
    receipts: records.receipts,
    seasonalAssignments: detail?.seasonalAssignments ?? [],
    consentHistory: privacy.consentHistory,
    privacyRequests: privacy.requests,
    retention: {
      automaticErasureEnabled: false,
      scheduleEstablished: false,
      note: "Records are not automatically erased. Retention and erasure requests need a manual policy, legal-hold and dependency review.",
    },
  };
  const bytes = Buffer.from(JSON.stringify(body, null, 2) + "\n", "utf8");
  return {
    bytes,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}
