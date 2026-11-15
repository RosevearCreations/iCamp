import { createHash } from "node:crypto";

const REV = /^[a-f0-9]{40}$/u;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const SHA = /^[a-f0-9]{64}$/u;
export const MASTER_PLANES = Object.freeze([
  "ai-data-platform",
  "rosevear-ai-hub",
  "rosevear-comms-hub",
]);
export const DECISIONS = Object.freeze([
  "hold",
  "reject",
  "request_fresh_originals",
  "request_independent_review",
]);
export const SECURITY_TIERS = Object.freeze([
  "public_discovery",
  "source_integrity",
  "signed_custody",
  "tenant_access",
  "independent_review",
  "live_connectivity",
]);
export const sha256 = (value) =>
  createHash("sha256").update(value).digest("hex");

/** Signed/verified originals originate only from separately pinned server-side
 * Master sources. A client-supplied status can never promote a tier. */
export function evaluateThreeMasterFreshness({
  sourceRevision,
  evidence,
  receipts,
  asOf,
}) {
  const now = Date.parse(asOf);
  const results = MASTER_PLANES.map((plane) => {
    const original = evidence?.evidence?.find((row) => row.plane === plane);
    const matches = Array.isArray(receipts)
      ? receipts.filter((r) => r?.plane === plane)
      : [];
    let status = "HOLD_ORIGINAL_SIGNED_MASTER_MISSING";
    let horizon = "unverified";
    if (!REV.test(String(sourceRevision ?? "")) || !Number.isFinite(now))
      status = "HOLD_CURRENT_DEPLOYMENT_REVISION_UNAVAILABLE";
    else if (
      evidence?.sourceRevision !== sourceRevision ||
      original?.status !== "SIGNED_RECEIPT_OBSERVED_NOT_OWNER_ACCEPTED" ||
      matches.length !== 1
    )
      status = original?.status ?? status;
    else {
      const receipt = matches[0];
      const issued = Date.parse(receipt.issuedAt);
      const age = now - issued;
      if (
        receipt.sourceRevision !== sourceRevision ||
        !Number.isFinite(issued) ||
        age < -60_000 ||
        age > 15 * 60_000
      )
        status = "HOLD_STALE_OR_WRONG_MASTER_SOURCE";
      else if (age > 10 * 60_000) {
        status = "SIGNED_SOURCE_RENEWAL_DUE";
        horizon = "under_5_min_remaining";
      } else if (age > 5 * 60_000) {
        status = "SIGNED_SOURCE_FRESH_WATCH";
        horizon = "5_to_10_min_remaining";
      } else {
        status = "SIGNED_SOURCE_FRESH_OBSERVED";
        horizon = "over_10_min_remaining";
      }
    }
    return { plane, status, horizon };
  });
  const allCurrent = results.every((r) =>
    r.status.startsWith("SIGNED_SOURCE_"),
  );
  const needsRenewal = results.some(
    (r) => r.status === "SIGNED_SOURCE_RENEWAL_DUE",
  );
  return {
    schema: "icamp.three-master-freshness.v1",
    results,
    allCurrent,
    needsRenewal,
    independentlySignedSourceObserved: allCurrent,
    allThreeReceiversConnected: false,
    ownerProductionAcceptance: "HOLD",
  };
}
export function validateRemediationDecision({
  claimId,
  decision,
  explanation,
}) {
  if (!UUID.test(String(claimId ?? "")))
    throw new Error("Original source receipt claim required.");
  if (!DECISIONS.includes(decision))
    throw new Error("Only HOLD/review/reject decisions are permitted.");
  const reason = String(explanation ?? "")
    .trim()
    .replace(/\s+/gu, " ");
  if (reason.length < 12 || reason.length > 300)
    throw new Error(
      "Independent review explanation must be 12–300 characters.",
    );
  return { claimId, decision, explanation: reason };
}
export function prepareSignedReceiptClaim({
  sourceRevision,
  receiptType,
  masterPlane,
  nonce,
  receiptDigestSha256,
  signerFingerprintSha256,
  issuedAt,
  cryptographicallyVerified,
  asOf,
}) {
  const age = Date.parse(asOf) - Date.parse(issuedAt);
  if (
    !REV.test(String(sourceRevision ?? "")) ||
    !["database_provenance", "master_source"].includes(receiptType) ||
    (receiptType === "master_source"
      ? !MASTER_PLANES.includes(masterPlane)
      : masterPlane !== null) ||
    !/^[A-Za-z0-9_-]{22,96}$/u.test(String(nonce ?? "")) ||
    !SHA.test(String(receiptDigestSha256 ?? "")) ||
    !SHA.test(String(signerFingerprintSha256 ?? "")) ||
    !cryptographicallyVerified ||
    !Number.isFinite(age) ||
    age < -60_000 ||
    age > (receiptType === "master_source" ? 15 * 60_000 : 24 * 60 * 60_000)
  )
    throw new Error("Fresh independently signed source evidence required.");
  return {
    sourceRevision,
    receiptType,
    masterPlane,
    nonceDigestSha256: sha256(nonce),
    receiptDigestSha256,
    signerFingerprintSha256,
    issuedAt,
    decision: "signed_source_observed_hold",
    ownerAcceptance: "HOLD",
    masterConnected: false,
  };
}
export function assessTieredSecurity({
  sourceChecksumsMatch,
  independentlySignedDatabase,
  masterFreshness,
  tenantAuthenticated,
  independentDisposition,
  runtimeConnected,
}) {
  return {
    schema: "icamp.seven-app-tiered-assurance.v1",
    tiers: SECURITY_TIERS.map((tier) => {
      const state = {
        public_discovery: "DISCOVERY_ONLY",
        source_integrity: sourceChecksumsMatch
          ? "SOURCE_CHECKSUM_OBSERVED"
          : "HOLD",
        signed_custody: independentlySignedDatabase
          ? "DATABASE_PROVENANCE_SOURCE_ONLY"
          : "HOLD",
        tenant_access: tenantAuthenticated ? "SCOPED_OWNER_READ" : "HOLD",
        independent_review: independentDisposition
          ? "INDEPENDENT_HOLD_RECORDED"
          : "HOLD",
        live_connectivity: runtimeConnected
          ? "UNVERIFIED_EXTERNAL_STATUS_CANNOT_PROMOTE"
          : "HOLD",
      }[tier];
      return { tier, status: state };
    }),
    threeMasterEvidenceCurrent: masterFreshness?.allCurrent === true,
    externalRuntimeConnected: false,
    ownerProductionAcceptance: "HOLD",
  };
}
