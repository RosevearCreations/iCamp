import { createHash } from "node:crypto";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
export const SAFETY_TEXT265 =
  "I have read the campground equipment safety instructions and rental terms. I understand that staff must confirm equipment condition, operating restrictions, supervision where needed, and the pickup/return process. This is an acknowledgment of information, not an automated waiver, payment, or proof of physical handover.";
export const SAFETY_VERSION265 = createHash("sha256")
  .update(SAFETY_TEXT265)
  .digest("hex");
const clean = (value, min, max, label) => {
  const str = String(value ?? "").trim();
  if (str.length < min || str.length > max || /\p{Cc}/u.test(str))
    throw Error(
      label + " must be " + min + "–" + max + " readable characters.",
    );
  return str;
};
export function normalizedGuestAcknowledgment265(input) {
  const allocationId = String(input?.allocationId ?? "").trim();
  if (!UUID.test(allocationId))
    throw Error("Original rental reservation ID required.");
  if (input?.safetyConfirmed !== true || input?.termsConfirmed !== true)
    throw Error("Both safety and terms must be explicitly acknowledged.");
  return {
    allocationId,
    versionSha256: SAFETY_VERSION265,
    safetyConfirmed: true,
    termsConfirmed: true,
    paid: false,
    waiverCertified: false,
  };
}
export function normalizedCustody265(input) {
  const allocationId = String(input?.allocationId ?? "").trim();
  if (!UUID.test(allocationId))
    throw Error("Original equipment reservation ID required.");
  const eventKind = String(input?.eventKind ?? "").trim();
  if (!["staff_observed_pickup", "staff_observed_return"].includes(eventKind))
    throw Error("Only a staff-observed pickup or return is supported.");
  return {
    allocationId,
    eventKind,
    evidenceReference: clean(
      input?.evidenceReference,
      12,
      160,
      "Original evidence reference",
    ),
    conditionNote: clean(
      input?.conditionNote,
      30,
      650,
      "Condition, staff and safety observations",
    ),
    bankPaid: false,
    insuranceCertified: false,
    physicalThirdPartyVerified: false,
  };
}
export function normalizedSupervision265(input) {
  const pilotReviewId = String(input?.pilotReviewId ?? "").trim();
  if (!UUID.test(pilotReviewId))
    throw Error("Original independent internal pilot ID required.");
  return {
    pilotReviewId,
    siteReference: clean(
      input?.siteReference,
      8,
      140,
      "Real on-site reference",
    ),
    supervisionReference: clean(
      input?.supervisionReference,
      12,
      140,
      "Original qualified supervisor reference",
    ),
    safetyRestrictions: clean(
      input?.safetyRestrictions,
      30,
      650,
      "Original safety restrictions",
    ),
    livePublicPilotAuthorized: false,
    insuranceVerifiedExternally: false,
  };
}
export const SUPPORT_CATEGORIES265 = Object.freeze([
  "software_locked",
  "performance",
  "traffic",
  "guest_complaint",
  "rental_change",
  "event_change",
  "site_change",
  "feature_request",
  "billing_question",
  "other",
]);
export function normalizedSupport265(input) {
  const category = String(input?.category ?? "").trim();
  const severity = String(input?.severity ?? "").trim();
  if (!SUPPORT_CATEGORIES265.includes(category))
    throw Error("Unknown campground support category.");
  if (!["routine", "priority", "critical"].includes(severity))
    throw Error("Unsupported severity.");
  return {
    category,
    severity,
    title: clean(input?.title, 8, 140, "Support title"),
    description: clean(input?.description, 20, 1400, "Support description"),
    status: "open",
  };
}
export function classifyCampgroundSupport265(records) {
  const rows = Array.isArray(records) ? records : [];
  const result = {
    observed: rows.length,
    open: 0,
    triaged: 0,
    resolved: 0,
    criticalOpen: 0,
    lockedOpen: 0,
    performanceOpen: 0,
    coverageCapped: rows.length >= 100,
  };
  for (const entry of rows) {
    if (["open", "triaged", "resolved"].includes(entry.status))
      result[entry.status]++;
    if (entry.severity === "critical" && entry.status !== "resolved")
      result.criticalOpen++;
    if (entry.category === "software_locked" && entry.status !== "resolved")
      result.lockedOpen++;
    if (entry.category === "performance" && entry.status !== "resolved")
      result.performanceOpen++;
  }
  return result;
}
