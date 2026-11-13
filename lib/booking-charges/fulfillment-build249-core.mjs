import {
  createHash,
  createPublicKey,
  verify as verifySignature,
} from "node:crypto";
import { auditOwnerDossierLineage } from "./fulfillment-dossier-readback-core.mjs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const SHA = /^[a-f0-9]{64}$/u;
const REV = /^[a-f0-9]{40}$/u;
const KEY = /^[A-Za-z0-9_.:-]{8,96}$/u;
const NONCE = /^[A-Za-z0-9_-]{22,96}$/u;
const B64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u;
const PLANES = ["ai-data-platform", "rosevear-comms-hub", "rosevear-ai-hub"];
const digest = (input) => createHash("sha256").update(input).digest("hex");
const result = (status, extra = {}) => ({
  status,
  sourceWitnessAccepted: false,
  masterConnected: false,
  ownerProductionAcceptance: "HOLD",
  ...extra,
});

export function validateOriginalDeviceWitness({
  verificationId,
  decision,
  explanation,
}) {
  if (!UUID.test(String(verificationId ?? "")))
    throw new Error("An original signed device verification is required.");
  if (
    ![
      "source_observed_pending_external_authority",
      "discrepancy_hold",
    ].includes(decision)
  )
    throw new Error("Witness outcome cannot authorize device acceptance.");
  const reason = String(explanation ?? "")
    .trim()
    .replace(/\s+/gu, " ");
  if (reason.length < 12 || reason.length > 300)
    throw new Error(
      "A source-only witness explanation of 12-300 characters is required.",
    );
  return { verificationId, decision, explanation: reason };
}

/** Recomputes each stored v1 dossier digest from its persisted source counts.
 * This verifies historical source-summary serialization, not original device
 * bytes, an owner signature, or independently anchored external custody. */
export function revalidateOwnerDossierSource({
  campgroundId,
  snapshots,
  windowTruncated = false,
  currentRevision,
  currentEvidence,
}) {
  const lineage = auditOwnerDossierLineage({
    campgroundId,
    snapshots,
    windowTruncated,
  });
  if (
    lineage.status !== "POINTER_CHAIN_CONSISTENT_UNSIGNED_NOT_CONTENT_VERIFIED"
  )
    return result(lineage.status, {
      checked: lineage.reviewedSnapshotCount ?? 0,
    });
  for (const row of snapshots) {
    if (row.evidenceSchema !== "icamp.fulfillment.owner-acceptance-evidence.v1")
      return result("HOLD_UNKNOWN_DOSSIER_SCHEMA", { checked: 0 });
    const content = {
      schema: "icamp.owner.dossier-continuity.v1",
      campgroundId,
      sourceRevision: row.sourceRevision,
      evidenceSchema: row.evidenceSchema,
      reportTrust: "UNSIGNED_TENANT_SCOPED_SOURCE_EVIDENCE",
      witnessCount: row.witnessCount,
      deviceReviewCount: row.deviceReviewCount,
      forecastCount: row.forecastCount,
      auditedCount: row.auditedCount,
      completeness: row.completeness,
      previousId: row.previousSnapshotId,
      previousDigest: row.previousDigestSha256,
      ownerAcceptance: "HOLD",
      masterConnection: "HOLD",
    };
    if (digest(JSON.stringify(content)) !== row.digestSha256)
      return result("HOLD_DOSSIER_SOURCE_DIGEST_MISMATCH", {
        checked: snapshots.length,
      });
  }
  if (!REV.test(String(currentRevision ?? "")))
    return result("HOLD_CURRENT_SOURCE_REVISION_UNAVAILABLE", {
      checked: snapshots.length,
    });
  if (snapshots[0].sourceRevision !== currentRevision)
    return result("HOLD_DOSSIER_RECAPTURE_AFTER_DEPLOY", {
      checked: snapshots.length,
    });
  if (
    !currentEvidence ||
    currentEvidence.campgroundId !== campgroundId ||
    currentEvidence.sourceRevision !== currentRevision ||
    currentEvidence.trust !== "UNSIGNED_TENANT_SCOPED_SOURCE_EVIDENCE" ||
    currentEvidence.completeness !== "SOURCE_SNAPSHOT_ONLY" ||
    !Array.isArray(currentEvidence.originalDeviceReviews) ||
    !Array.isArray(currentEvidence.forecastCalibration) ||
    !Array.isArray(currentEvidence.ownerAuditDecisions) ||
    !Number.isSafeInteger(currentEvidence.witnessStatementCount)
  )
    return result("HOLD_CURRENT_SOURCE_EVIDENCE_INCOMPLETE", {
      checked: snapshots.length,
    });
  const last = snapshots[0];
  if (
    last.witnessCount !== currentEvidence.witnessStatementCount ||
    last.deviceReviewCount !== currentEvidence.originalDeviceReviews.length ||
    last.forecastCount !== currentEvidence.forecastCalibration.length ||
    last.auditedCount !== currentEvidence.ownerAuditDecisions.length ||
    last.completeness !== currentEvidence.completeness
  )
    return result("HOLD_SOURCE_COUNTS_CHANGED", { checked: snapshots.length });
  return result("HISTORICAL_DIGESTS_REVALIDATED_UNSIGNED", {
    checked: snapshots.length,
    historicalDigestsVerified: true,
    currentSourceCountsMatch: true,
    externallyAnchored: false,
  });
}

export function masterReceiptMessage(receipt) {
  return JSON.stringify([
    "icamp.master-source-receipt.v1",
    receipt.plane,
    receipt.sourceId,
    receipt.sourceRevision,
    receipt.issuedAt,
    receipt.nonce,
    receipt.keyId,
    receipt.decision,
  ]);
}

function validMasterReceipt({ receipt, trust, sourceRevision, asOf }) {
  if (
    !receipt ||
    receipt.sourceId !== "icamp" ||
    receipt.sourceRevision !== sourceRevision ||
    receipt.decision !== "SOURCE_HEALTHY_OBSERVED" ||
    !KEY.test(String(receipt.keyId ?? "")) ||
    !NONCE.test(String(receipt.nonce ?? "")) ||
    !trust ||
    trust.keyId !== receipt.keyId ||
    !SHA.test(String(trust.independentlyAuthenticatedSpkiFingerprint ?? ""))
  )
    return "HOLD_RECEIPT_SOURCE_OR_PIN_MISMATCH";
  const issued = Date.parse(receipt.issuedAt);
  const now = Date.parse(asOf);
  if (
    !Number.isFinite(issued) ||
    !Number.isFinite(now) ||
    issued > now + 60_000 ||
    now - issued > 15 * 60_000
  )
    return "HOLD_STALE_MASTER_RECEIPT";
  try {
    const encoded = String(trust.publicKeySpkiBase64 ?? "");
    if (!encoded || encoded.length > 8192 || !B64.test(encoded))
      return "HOLD_INVALID_MASTER_PIN";
    const keyBytes = Buffer.from(encoded, "base64");
    if (keyBytes.toString("base64") !== encoded)
      return "HOLD_NONCANONICAL_MASTER_PIN";
    if (digest(keyBytes) !== trust.independentlyAuthenticatedSpkiFingerprint)
      return "HOLD_MASTER_PIN_FINGERPRINT_MISMATCH";
    const key = createPublicKey({
      key: keyBytes,
      format: "der",
      type: "spki",
    });
    if (key.asymmetricKeyType !== "ed25519") return "HOLD_MASTER_PIN_ALGORITHM";
    const signature = String(receipt.signatureBase64 ?? "");
    if (!B64.test(signature) || signature.length > 1024)
      return "HOLD_INVALID_MASTER_SIGNATURE";
    const signatureBytes = Buffer.from(signature, "base64");
    if (
      signatureBytes.length !== 64 ||
      signatureBytes.toString("base64") !== signature
    )
      return "HOLD_INVALID_MASTER_SIGNATURE";
    return verifySignature(
      null,
      Buffer.from(masterReceiptMessage(receipt), "utf8"),
      key,
      signatureBytes,
    )
      ? "SIGNED_RECEIPT_OBSERVED_NOT_OWNER_ACCEPTED"
      : "HOLD_INVALID_MASTER_SIGNATURE";
  } catch {
    return "HOLD_INVALID_MASTER_SIGNATURE";
  }
}

/** Input only from server-side protected configuration, never from the owner
 * browser. No receipt authorizes Master CONNECTED or owner acceptance. */
export function reconcileCrossMasterAcceptance({
  sourceRevision,
  receipts,
  pins,
  custodianEnrolled,
  asOf,
}) {
  const list = Array.isArray(receipts) ? receipts : [];
  const pinRows = Array.isArray(pins) ? pins : [];
  const evidence = [];
  const acceptedKeys = new Set();
  const acceptedNonces = new Set();
  for (const plane of PLANES) {
    const matchingReceipts = list.filter((r) => r?.plane === plane);
    const matchingPins = pinRows.filter((p) => p?.plane === plane);
    let status = "HOLD_ORIGINAL_MASTER_RECEIPT_MISSING";
    if (!REV.test(String(sourceRevision ?? "")))
      status = "HOLD_SOURCE_REVISION_UNAVAILABLE";
    else if (!custodianEnrolled)
      status = "HOLD_INDEPENDENT_MASTER_CUSTODIAN_UNENROLLED";
    else if (matchingReceipts.length > 1 || matchingPins.length > 1)
      status = "HOLD_AMBIGUOUS_MASTER_AUTHORITY";
    else if (!matchingPins.length) status = "HOLD_MASTER_PIN_MISSING";
    else if (matchingReceipts.length === 1) {
      status = validMasterReceipt({
        receipt: matchingReceipts[0],
        trust: matchingPins[0],
        sourceRevision,
        asOf,
      });
      if (status === "SIGNED_RECEIPT_OBSERVED_NOT_OWNER_ACCEPTED") {
        const authority =
          matchingPins[0].independentlyAuthenticatedSpkiFingerprint;
        const nonce = matchingPins[0].keyId + ":" + matchingReceipts[0].nonce;
        if (acceptedKeys.has(authority) || acceptedNonces.has(nonce))
          status = "HOLD_REUSED_MASTER_SIGNER_OR_NONCE";
        else {
          acceptedKeys.add(authority);
          acceptedNonces.add(nonce);
        }
      }
    }
    evidence.push({ plane, status });
  }
  const allIndependentlySigned = evidence.every(
    (item) => item.status === "SIGNED_RECEIPT_OBSERVED_NOT_OWNER_ACCEPTED",
  );
  return {
    schema: "icamp.master-source-evidence-reconciliation.v1",
    sourceId: "icamp",
    sourceRevision: REV.test(String(sourceRevision ?? ""))
      ? sourceRevision
      : null,
    evidence,
    allIndependentlySigned,
    sourceSignerAccepted: false,
    connected: false,
    ownerAccepted: false,
    decision: allIndependentlySigned
      ? "HOLD_SOURCE_SIGNER_AND_EXPLICIT_OWNER_DECISION"
      : "HOLD_UNVERIFIED_THREE_MASTER_RECEIPTS",
  };
}
