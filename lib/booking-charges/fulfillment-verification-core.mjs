import {
  createHash,
  createPublicKey,
  verify as verifySignature,
} from "node:crypto";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const SHA = /^[a-f0-9]{64}$/u;
const REV = /^[a-f0-9]{40}$/u;
const KEY = /^[a-zA-Z0-9_.:-]{8,96}$/u;
const B64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u;
const NONCE = /^[A-Za-z0-9_-]{22,96}$/u;
const digest = (data) => createHash("sha256").update(data).digest("hex");

function checkedId(value) {
  if (!UUID.test(String(value ?? "")))
    throw new Error("Source-bound UUID required.");
  return value;
}
function cleanReason(value) {
  const text = String(value ?? "")
    .trim()
    .replace(/\s+/gu, " ");
  if (text.length < 12 || text.length > 300)
    throw new Error("Provide a source explanation of 12–300 characters.");
  return text;
}
function decodeB64(value, max) {
  const text = String(value ?? "");
  if (!text.length || text.length > max || !B64.test(text))
    throw new Error("Invalid encoded signature material.");
  const result = Buffer.from(text, "base64");
  if (!result.length || result.toString("base64") !== text)
    throw new Error("Noncanonical signature encoding.");
  return result;
}
export function buildDeviceSigningMessage(packet) {
  return JSON.stringify([
    "icamp.fulfillment.device-original.v1",
    checkedId(packet.campgroundId),
    checkedId(packet.dispatchId),
    checkedId(packet.fieldReportId),
    checkedId(packet.originalReviewId),
    String(packet.sourceRevision),
    String(packet.evidenceDigestSha256),
    String(packet.keyId),
    String(packet.nonce),
    String(packet.issuedAt),
  ]);
}

/** Never trust a user-supplied key. The independent custodian's SPKI pin and
 * fingerprint must be supplied through separate protected configuration.
 * The resulting result is evidence validation, not Master acceptance.
 */
export function verifyOriginalDevicePacket({ packet, expected, trust, asOf }) {
  for (const key of [
    "campgroundId",
    "dispatchId",
    "fieldReportId",
    "originalReviewId",
  ])
    checkedId(expected?.[key]);
  if (
    !REV.test(String(expected?.sourceRevision ?? "")) ||
    !SHA.test(String(expected?.evidenceDigestSha256 ?? ""))
  )
    throw new Error("The current deployed source binding is unavailable.");
  if (
    !packet ||
    !trust ||
    !KEY.test(String(packet.keyId ?? "")) ||
    !SHA.test(String(packet.evidenceDigestSha256 ?? "")) ||
    !NONCE.test(String(packet.nonce ?? "")) ||
    !REV.test(String(packet.sourceRevision ?? ""))
  ) {
    return { status: "HOLD_INVALID_PACKET", accepted: false };
  }
  if (
    ["campgroundId", "dispatchId", "fieldReportId", "originalReviewId"].some(
      (k) => packet[k] !== expected[k],
    ) ||
    packet.sourceRevision !== expected.sourceRevision ||
    packet.evidenceDigestSha256 !== expected.evidenceDigestSha256
  ) {
    return { status: "HOLD_SOURCE_MISMATCH", accepted: false };
  }
  if (
    !KEY.test(String(trust.keyId ?? "")) ||
    packet.keyId !== trust.keyId ||
    !SHA.test(String(trust.independentlyAuthenticatedSpkiFingerprint ?? "")) ||
    !trust.publicKeySpkiBase64
  ) {
    return { status: "HOLD_INDEPENDENT_PIN_NOT_ENROLLED", accepted: false };
  }
  const now = Date.parse(asOf);
  const issued = Date.parse(packet.issuedAt);
  if (
    !Number.isFinite(now) ||
    !Number.isFinite(issued) ||
    Math.abs(now - issued) > 5 * 60 * 1000
  ) {
    return { status: "HOLD_STALE_CHALLENGE", accepted: false };
  }
  try {
    const pubDer = decodeB64(trust.publicKeySpkiBase64, 8192);
    const fingerprint = digest(pubDer);
    if (fingerprint !== trust.independentlyAuthenticatedSpkiFingerprint)
      return { status: "HOLD_PIN_FINGERPRINT_MISMATCH", accepted: false };
    const sig = decodeB64(packet.signatureBase64, 1024);
    if (sig.length !== 64)
      return { status: "HOLD_INVALID_SIGNATURE", accepted: false };
    const publicKey = createPublicKey({
      key: pubDer,
      format: "der",
      type: "spki",
    });
    if (publicKey.asymmetricKeyType !== "ed25519")
      return { status: "HOLD_WRONG_SIGNATURE_ALGORITHM", accepted: false };
    const message = buildDeviceSigningMessage(packet);
    if (!verifySignature(null, Buffer.from(message, "utf8"), publicKey, sig))
      return { status: "HOLD_INVALID_SIGNATURE", accepted: false };
    return {
      status: "SIGNATURE_VALID_SOURCE_BOUND",
      accepted: true,
      keyId: packet.keyId,
      fingerprint,
      nonceDigestSha256: digest(packet.nonce),
      messageDigestSha256: digest(message),
      sourceRevision: packet.sourceRevision,
      deviceAcceptance: "HOLD_OWNER_AND_ORIGINAL_DEVICE_AUTHORITY",
      masterConnection: "HOLD",
    };
  } catch {
    return { status: "HOLD_INVALID_SIGNATURE_MATERIAL", accepted: false };
  }
}

export function validateCalibrationClosure({
  checkpointId,
  followupId,
  previousClosureId,
  decision,
  explanation,
}) {
  checkedId(checkpointId);
  checkedId(followupId);
  const prev = String(previousClosureId ?? "").trim();
  if (prev) checkedId(prev);
  if (!["source_reconciled_unverified", "recheck_required"].includes(decision))
    throw new Error(
      "No owner acceptance or model-certification decision is permitted.",
    );
  return {
    checkpointId,
    followupId,
    previousClosureId: prev || null,
    decision,
    explanation: cleanReason(explanation),
  };
}

/** Chain an owner dossier digest without storing guest data or raw evidence. */
export function buildDossierContinuity({
  campgroundId,
  sourceRevision,
  evidenceSummary,
  previousSnapshot,
}) {
  checkedId(campgroundId);
  if (!REV.test(String(sourceRevision ?? "")))
    throw new Error("Exact source revision required.");
  if (
    !evidenceSummary ||
    evidenceSummary.campgroundId !== campgroundId ||
    evidenceSummary.ownerProductionAcceptance !== "HOLD" ||
    evidenceSummary.masterConnection !== "HOLD"
  )
    throw new Error(
      "Tenant-scoped unsigned evidence with explicit HOLD required.",
    );
  const previousId = previousSnapshot?.id ?? null;
  if (previousId) checkedId(previousId);
  const previousDigest = previousSnapshot?.digestSha256 ?? null;
  if (previousDigest !== null && !SHA.test(previousDigest))
    throw new Error("Previous continuity digest is invalid.");
  const content = {
    schema: "icamp.owner.dossier-continuity.v1",
    campgroundId,
    sourceRevision,
    evidenceSchema: evidenceSummary.schema,
    reportTrust: evidenceSummary.trust,
    witnessCount: evidenceSummary.witnessStatementCount,
    deviceReviewCount: evidenceSummary.originalDeviceReviews?.length ?? 0,
    forecastCount: evidenceSummary.forecastCalibration?.length ?? 0,
    auditedCount: evidenceSummary.ownerAuditDecisions?.length ?? 0,
    completeness: evidenceSummary.completeness,
    previousId,
    previousDigest,
    ownerAcceptance: "HOLD",
    masterConnection: "HOLD",
  };
  return { ...content, digestSha256: digest(JSON.stringify(content)) };
}
