import {
  createHash,
  createPublicKey,
  verify as verifySignature,
} from "node:crypto";
import { assessDeviceVerifierPin } from "./fulfillment-dossier-readback-core.mjs";

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/iu;
const REV = /^[a-f0-9]{40}$/u;
const SHA = /^[a-f0-9]{64}$/u;
const NONCE = /^[A-Za-z0-9_-]{22,96}$/u;
const B64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u;
export const sha256 = (value) =>
  createHash("sha256").update(value).digest("hex");

const hold = (status) => ({
  status,
  sourceHealthyVerified: false,
  sourceSignerAuthority: "HOLD",
  masterConnected: false,
  ownerProductionAcceptance: "HOLD",
});

export function sourceHealthyMessage(receipt) {
  return JSON.stringify([
    "icamp.original-source-healthy.v1",
    receipt.sourceId,
    receipt.campgroundId,
    receipt.sourceRevision,
    receipt.dossierDigestSha256,
    receipt.issuedAt,
    receipt.nonce,
    receipt.keyId,
    receipt.decision,
  ]);
}

/** Protected original-source signature is independent of the three Master
 * receipts. A self-reported HEALTHY string is never a trusted signature. */
export function verifySourceHealthyCeremony({
  campgroundId,
  sourceRevision,
  dossierDigestSha256,
  receipt,
  trust,
  custodianEnrolled,
  asOf,
}) {
  if (
    !UUID.test(String(campgroundId ?? "")) ||
    !REV.test(String(sourceRevision ?? "")) ||
    !SHA.test(String(dossierDigestSha256 ?? ""))
  )
    return hold("HOLD_SOURCE_CEREMONY_SCOPE");
  if (
    !receipt ||
    receipt.sourceId !== "icamp" ||
    receipt.campgroundId !== campgroundId ||
    receipt.sourceRevision !== sourceRevision ||
    receipt.dossierDigestSha256 !== dossierDigestSha256 ||
    receipt.decision !== "SOURCE_HEALTHY_OBSERVED" ||
    !NONCE.test(String(receipt.nonce ?? ""))
  )
    return hold("HOLD_SOURCE_HEALTH_RECEIPT_MISMATCH");
  const pin = assessDeviceVerifierPin({ custodianEnrolled, trust });
  if (!pin.configured || receipt.keyId !== trust.keyId)
    return hold("HOLD_INDEPENDENT_SOURCE_HEALTH_SIGNER");
  const issued = Date.parse(receipt.issuedAt);
  const now = Date.parse(asOf);
  if (
    !Number.isFinite(now) ||
    !Number.isFinite(issued) ||
    issued > now + 60_000 ||
    now - issued > 15 * 60_000
  )
    return hold("HOLD_STALE_SOURCE_HEALTH_RECEIPT");
  try {
    const signatureBase64 = String(receipt.signatureBase64 ?? "");
    if (!B64.test(signatureBase64) || signatureBase64.length > 1024)
      return hold("HOLD_INVALID_SOURCE_HEALTH_SIGNATURE");
    const signature = Buffer.from(signatureBase64, "base64");
    if (
      signature.length !== 64 ||
      signature.toString("base64") !== signatureBase64
    )
      return hold("HOLD_INVALID_SOURCE_HEALTH_SIGNATURE");
    const publicKey = createPublicKey({
      key: Buffer.from(trust.publicKeySpkiBase64, "base64"),
      type: "spki",
      format: "der",
    });
    if (
      !verifySignature(
        null,
        Buffer.from(sourceHealthyMessage(receipt), "utf8"),
        publicKey,
        signature,
      )
    )
      return hold("HOLD_SOURCE_HEALTH_SIGNATURE_MISMATCH");
    return {
      status: "ORIGINAL_SOURCE_HEALTH_SIGNATURE_VERIFIED",
      sourceHealthyVerified: true,
      sourceSignerAuthority: "SIGNED_SOURCE_ONLY",
      receiptDigestSha256: sha256(sourceHealthyMessage(receipt)),
      sourceNonceDigestSha256: sha256(receipt.nonce),
      masterConnected: false,
      ownerProductionAcceptance: "HOLD",
    };
  } catch {
    return hold("HOLD_INVALID_SOURCE_HEALTH_SIGNATURE");
  }
}

/** Eligibility for a human review request, NEVER CONNECTED or operational
 * acceptance. Every source must be currently verified and tenant scoped. */
export function evaluateBuild250OwnerGate({
  campgroundId,
  sourceRevision,
  dossierIntegrity,
  dossierSnapshots,
  signedSourceHealthy,
  crossMasterEvidence,
  originalDeviceWitnesses,
  verifiedSourcePackets,
  asOf,
}) {
  const decision = (status, witnessId = null) => ({
    status,
    witnessId,
    supervisedReviewEligible: false,
    masterConnected: false,
    ownerProductionAcceptance: "HOLD",
  });
  if (
    !UUID.test(String(campgroundId ?? "")) ||
    !REV.test(String(sourceRevision ?? ""))
  )
    return decision("HOLD_SOURCE_SCOPE");
  const snapshot = dossierSnapshots?.[0];
  if (
    !snapshot ||
    snapshot.campgroundId !== campgroundId ||
    snapshot.sourceRevision !== sourceRevision ||
    !SHA.test(String(snapshot.digestSha256 ?? "")) ||
    dossierIntegrity?.status !== "HISTORICAL_DIGESTS_REVALIDATED_UNSIGNED" ||
    dossierIntegrity?.currentSourceCountsMatch !== true
  )
    return decision("HOLD_FRESH_OWNER_DOSSIER_REVALIDATION");
  if (!signedSourceHealthy?.sourceHealthyVerified)
    return decision("HOLD_ORIGINAL_SIGNED_SOURCE_HEALTH");
  if (
    !crossMasterEvidence?.allIndependentlySigned ||
    crossMasterEvidence.sourceRevision !== sourceRevision ||
    crossMasterEvidence.connected !== false ||
    !Array.isArray(crossMasterEvidence.evidence) ||
    crossMasterEvidence.evidence.length !== 3
  )
    return decision("HOLD_THREE_INDEPENDENT_MASTER_RECEIPTS");
  if (
    !Array.isArray(originalDeviceWitnesses) ||
    !Array.isArray(verifiedSourcePackets)
  )
    return decision("HOLD_ORIGINAL_DEVICE_WITNESS_SOURCE");
  const now = Date.parse(asOf);
  for (const row of originalDeviceWitnesses) {
    if (
      row.sourceRevision !== sourceRevision ||
      row.decision !== "source_observed_pending_external_authority" ||
      !UUID.test(String(row.id ?? "")) ||
      !UUID.test(String(row.signatureVerificationId ?? "")) ||
      !Number.isFinite(Date.parse(row.admittedAt)) ||
      Date.parse(row.admittedAt) > now ||
      now - Date.parse(row.admittedAt) > 24 * 60 * 60 * 1000
    )
      continue;
    const verified = verifiedSourcePackets.find(
      (packet) =>
        packet.id === row.signatureVerificationId &&
        packet.sourceRevision === sourceRevision &&
        packet.dispatchId === row.dispatchId &&
        packet.originalReviewId === row.originalReviewId &&
        packet.decision === "signature_valid_source_bound",
    );
    if (verified) {
      return {
        status: "SUPERVISED_SOURCE_REVIEW_ELIGIBLE_NOT_ACCEPTED",
        witnessId: row.id,
        verifiedPacketId: verified.id,
        dossierSnapshotId: snapshot.id,
        dossierDigestSha256: snapshot.digestSha256,
        supervisedReviewEligible: true,
        masterConnected: false,
        ownerProductionAcceptance: "HOLD",
      };
    }
  }
  return decision("HOLD_FRESH_INDEPENDENT_DEVICE_WITNESS");
}

export function validateBuild250OwnerDecision({
  decision,
  explanation,
  eligible,
}) {
  if (!["hold", "reject", "request_supervised_review"].includes(decision))
    throw new Error("Invalid supervised owner decision.");
  const reason = String(explanation ?? "")
    .trim()
    .replace(/\s+/gu, " ");
  if (reason.length < 12 || reason.length > 300)
    throw new Error("Explicit owner reason of 12–300 characters required.");
  if (decision === "request_supervised_review" && eligible !== true)
    throw new Error("Original signed ceremony evidence is still HOLD.");
  return {
    decision,
    explanation: reason,
    operationalAcceptance: "HOLD",
    masterConnected: false,
  };
}
