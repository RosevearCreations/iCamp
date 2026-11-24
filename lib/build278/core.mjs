import { SOURCES275 } from "../build275/diagnostics.mjs";
import { SHA276, UUID276 } from "../build276/core.mjs";

export const KINDS278 = [
  "tenant-isolation",
  "reservation-integrity",
  "payment-ledger",
  "service-health",
];

export function validateFieldReview278(input) {
  if (
    !UUID276.test(input?.responseId ?? "") ||
    !SHA276.test(input?.evidenceDigest ?? "")
  )
    throw Error("INVALID_INDEPENDENT_FIELD_EVIDENCE");
  return { responseId: input.responseId, evidenceDigest: input.evidenceDigest };
}
export function validateMfaReview278(input) {
  if (
    !UUID276.test(input?.sessionId ?? "") ||
    !UUID276.test(input?.ownerId ?? "") ||
    !SHA276.test(input?.evidenceDigest ?? "")
  )
    throw Error("INVALID_ORIGINAL_OWNER_MFA_EVIDENCE");
  return {
    sessionId: input.sessionId,
    ownerId: input.ownerId,
    evidenceDigest: input.evidenceDigest,
  };
}
export function validateExternalReadback278(input) {
  if (
    !UUID276.test(input?.externalReviewId ?? "") ||
    ![
      input?.providerDigest,
      input?.isolatedDigest,
      input?.evidenceDigest,
    ].every((x) => SHA276.test(x ?? "")) ||
    input.providerDigest === input.isolatedDigest
  )
    throw Error("INVALID_EXTERNAL_SERVICE_READBACK");
  return input;
}
export function summarizeField278(items, now = Date.now()) {
  const peers = SOURCES275.map((source) => {
    const x = items.find((r) => r.source === source);
    const observed = Date.parse(x?.acceptedAt ?? "");
    const reviewed = Date.parse(x?.reviewedAt ?? "");
    const recent =
      Number.isFinite(observed) &&
      observed <= now + 30000 &&
      observed >= now - 300000;
    return {
      source,
      status:
        recent &&
        Number.isFinite(reviewed) &&
        reviewed >= observed &&
        reviewed <= now + 30000 &&
        x?.cryptographic === true
          ? "FIELD_SIGNED_INDEPENDENTLY_REVIEWED_EXTERNAL_CUSTODY_PENDING"
          : "HOLD",
    };
  });
  const reviewedCount = peers.filter((x) => x.status !== "HOLD").length;
  return {
    peers,
    reviewedCount,
    status:
      reviewedCount === 7
        ? "SEVEN_FIELD_WITNESSES_RECORDED_SEPARATE_EXTERNAL_ACCEPTANCE_REQUIRED"
        : "HOLD_ORIGINAL_SEVEN_SOURCE_FIELD_ACCEPTANCE",
  };
}
export function summarizeOwner278(owner, session, readback) {
  const ownerPresent =
    owner?.status === "OWNER_EVIDENCE_PRESENT_INDEPENDENT_REVIEW_REQUIRED";
  const freshOriginal = Boolean(
    session?.user?.username?.toLowerCase() === "rosevear" &&
    session?.assuranceLevel === "aal2" &&
    session?.sessionId &&
    readback?.ownerId === session?.user?.id &&
    readback?.sessionId === session?.sessionId,
  );
  return {
    status:
      ownerPresent && freshOriginal
        ? "ORIGINAL_OWNER_MFA_COMPLETION_WITNESSED_CURRENT_SESSION"
        : "HOLD_ORIGINAL_OWNER_MFA_RECOVERY_COMPLETION",
  };
}
export function summarizeRestore278(rows) {
  return {
    evidenceCount: rows.filter((x) => x.independent === true).length,
    status: rows.some((x) => x.independent === true)
      ? "EXTERNAL_SERVICE_READBACK_STORED_PROVIDER_CONFIRMATION_REQUIRED"
      : "HOLD_ORIGINAL_EXTERNAL_RESTORE_SERVICE_READBACK",
    productionRestored: false,
  };
}
export function classifyClosure278({
  host,
  owner,
  peers,
  restore,
  migrationAdopted,
}) {
  return {
    status:
      host?.pinned === true &&
      migrationAdopted === true &&
      owner?.status ===
        "ORIGINAL_OWNER_MFA_COMPLETION_WITNESSED_CURRENT_SESSION" &&
      peers?.reviewedCount === 7 &&
      restore?.evidenceCount > 0
        ? "ALL_READBACK_EVIDENCE_PRESENT_EXTERNAL_CERTIFICATION_PENDING"
        : "HOLD_ORIGINAL_RECOVERY_FIELD_CLOSURE",
    productionRestored: false,
    providerCertified: false,
  };
}
