import { unitId } from "../permanent-unit-market/core.mjs";

function bounded(value, label, min, max) {
  const result = String(value ?? "").trim();
  if (result.length < min || result.length > max)
    throw new Error(`${label} must contain ${min}–${max} characters.`);
  return result;
}
export function normalizeDisclosureVersion(input) {
  const digest = String(input.sha256 ?? "")
    .trim()
    .toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(digest))
    throw new Error("Disclosure SHA-256 must be 64 hexadecimal characters.");
  return {
    id: unitId(input.id),
    jurisdiction: bounded(input.jurisdiction, "Jurisdiction", 2, 80),
    versionCode: bounded(input.versionCode, "Disclosure version", 3, 80),
    documentReference: bounded(
      input.documentReference,
      "Restricted disclosure source",
      8,
      400,
    ),
    sha256: digest,
    legalReviewReference: bounded(
      input.legalReviewReference,
      "Independent legal review source",
      8,
      400,
    ),
    note: bounded(input.note, "Version note", 12, 800),
  };
}
export function normalizeDisclosureReview(input) {
  const outcome = String(input.outcome ?? "");
  if (!["approved_internal_use", "rejected"].includes(outcome))
    throw new Error("Disclosure review must approve internal use or reject.");
  return {
    id: unitId(input.id),
    versionId: unitId(input.versionId, "Disclosure version"),
    outcome,
    note: bounded(input.note, "Disclosure review note", 12, 800),
  };
}
export function normalizeDeliveryConsent(input) {
  const channel = String(input.channel ?? "");
  if (!["in_person", "secure_portal"].includes(channel))
    throw new Error(
      "Consent channel must be in-person or verified secure portal.",
    );
  return {
    id: unitId(input.id),
    proposalId: unitId(input.proposalId, "Terms proposal"),
    versionId: unitId(input.versionId, "Disclosure version"),
    channel,
    consentReference: bounded(
      input.consentReference,
      "Applicant consent evidence",
      8,
      400,
    ),
    recipientReference: bounded(
      input.recipientReference,
      "Verified recipient reference",
      8,
      400,
    ),
    note: bounded(input.note, "Consent note", 12, 800),
  };
}
export function normalizeDeliverySignoff(input) {
  const decision = String(input.decision ?? "");
  if (!["ready_for_manual_handoff", "held"].includes(decision))
    throw new Error("Only manual handoff readiness or hold is allowed.");
  return {
    id: unitId(input.id),
    consentId: unitId(input.consentId, "Delivery consent"),
    decision,
    reviewReference: bounded(
      input.reviewReference,
      "Sign-off evidence source",
      8,
      400,
    ),
    note: bounded(input.note, "Sign-off note", 12, 800),
  };
}
