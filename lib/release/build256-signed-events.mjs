import {
  createHash,
  createPublicKey,
  verify as verifySignature,
} from "node:crypto";

import {
  APPLICATIONS,
  validateSourceEnvelope,
} from "./build255-contract-registry.mjs";

export const SIGNED_PACKET_SCHEMA = "rosevear.seven-app-signed-event.v1";
export const REVOCATION_EVENT_SCHEMA = "rosevear.seven-app-revocation.v1";
export const OUTBOX_SCHEMA = "rosevear.seven-app-revocation-handoff.v1";
const SHA64 = /^[a-f0-9]{64}$/u;
const B64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u;
const KEY_ID = /^[A-Za-z0-9_.:-]{8,96}$/u;
const digest = (value) => createHash("sha256").update(value).digest("hex");
const iso = (value) => new Date(value).toISOString();
const knownApp = (appId) => APPLICATIONS.some((a) => a.id === appId);
const blocked = (status) => ({
  status,
  verified: false,
  receiverConnected: false,
  ownerAcceptance: "HOLD",
});

export function signedEventMessage(packet) {
  const e = packet.envelope;
  return JSON.stringify([
    SIGNED_PACKET_SCHEMA,
    e.schema,
    e.contractVersion,
    e.sourceAppId,
    e.targetAppId,
    e.sourceRevision,
    e.eventType,
    e.issuedAt,
    e.nonce,
    e.tenantId,
    e.dataClassification,
    packet.expiresAt,
    packet.keyId,
    packet.revokesReceiptDigestSha256 ?? null,
  ]);
}

/**
 * Independent Ed25519 source verification only. No browser-supplied pin,
 * signing key, network grant or production acceptance is permitted.
 */
export function verifyOriginalSignedEvent({
  packet,
  pin,
  asOf,
  custodianEnrolled = false,
  revocations = [],
}) {
  const time = Date.parse(asOf);
  if (
    !packet ||
    packet.schema !== SIGNED_PACKET_SCHEMA ||
    !pin ||
    !custodianEnrolled ||
    !Number.isFinite(time)
  )
    return blocked("HOLD_ORIGINAL_SIGNER_NOT_ENROLLED");
  const allowed = new Set([
    "schema",
    "envelope",
    "keyId",
    "signatureBase64",
    "expiresAt",
    "revokesReceiptDigestSha256",
  ]);
  if (Object.keys(packet).some((key) => !allowed.has(key)))
    return blocked("HOLD_UNAPPROVED_SIGNED_PACKET_FIELDS");
  const structural = validateSourceEnvelope(packet.envelope, { asOf });
  if (!structural.valid) return blocked(structural.status);
  const envelope = packet.envelope;
  const issuedAt = Date.parse(envelope.issuedAt);
  const expiresAt = Date.parse(packet.expiresAt);
  if (
    !Number.isFinite(expiresAt) ||
    expiresAt <= issuedAt ||
    expiresAt - issuedAt > 15 * 60_000 ||
    time >= expiresAt
  )
    return blocked("HOLD_EXPIRED_OR_INVALID_SIGNED_EVENT");
  if (
    packet.revokesReceiptDigestSha256 !== undefined &&
    (envelope.eventType !== "security_exception.v1" ||
      !SHA64.test(String(packet.revokesReceiptDigestSha256)))
  )
    return blocked("HOLD_INVALID_REVOCATION_TARGET");
  if (
    pin.appId !== envelope.sourceAppId ||
    pin.sourceRevision !== envelope.sourceRevision ||
    pin.keyId !== packet.keyId ||
    !KEY_ID.test(String(packet.keyId ?? "")) ||
    pin.custodianAttested !== true ||
    pin.revoked === true ||
    !SHA64.test(String(pin.fingerprintSha256 ?? "")) ||
    !knownApp(pin.appId)
  )
    return blocked("HOLD_UNKNOWN_OR_REVOKED_ISSUER_PIN");
  const pinStart = Date.parse(pin.notBefore);
  const pinEnd = Date.parse(pin.notAfter);
  if (
    !Number.isFinite(pinStart) ||
    !Number.isFinite(pinEnd) ||
    pinStart > issuedAt ||
    pinEnd <= time ||
    pinEnd <= pinStart
  )
    return blocked("HOLD_EXPIRED_ISSUER_PIN");
  if (
    !Array.isArray(revocations) ||
    revocations.some(
      (r) =>
        r?.appId === pin.appId &&
        (r.keyId === pin.keyId ||
          r.fingerprintSha256 === pin.fingerprintSha256) &&
        Date.parse(r.revokedAt) <= time,
    )
  )
    return blocked("HOLD_ORIGINAL_ISSUER_REVOKED");
  try {
    const encoded = String(pin.publicKeySpkiBase64 ?? "");
    const signature = String(packet.signatureBase64 ?? "");
    if (
      !B64.test(encoded) ||
      !B64.test(signature) ||
      encoded.length > 8192 ||
      signature.length > 1024
    )
      return blocked("HOLD_INVALID_SIGNED_EVENT_BYTES");
    const keyBytes = Buffer.from(encoded, "base64");
    const sigBytes = Buffer.from(signature, "base64");
    if (
      keyBytes.toString("base64") !== encoded ||
      sigBytes.toString("base64") !== signature ||
      sigBytes.length !== 64 ||
      digest(keyBytes) !== pin.fingerprintSha256
    )
      return blocked("HOLD_PIN_OR_SIGNATURE_INTEGRITY");
    const key = createPublicKey({
      key: keyBytes,
      format: "der",
      type: "spki",
    });
    if (key.asymmetricKeyType !== "ed25519")
      return blocked("HOLD_NON_ED25519_ISSUER");
    const message = signedEventMessage(packet);
    if (!verifySignature(null, Buffer.from(message), key, sigBytes))
      return blocked("HOLD_ORIGINAL_SIGNATURE_INVALID");
    const receiptDigestSha256 = digest(message + ":" + signature);
    if (
      revocations.some(
        (r) => r?.receiptDigestSha256 === receiptDigestSha256,
      )
    )
      return blocked("HOLD_RECEIPT_ALREADY_REVOKED");
    const dueAt = expiresAt - 5 * 60_000;
    return {
      status:
        time >= dueAt
          ? "SIGNED_ORIGINAL_RENEWAL_DUE_HOLD"
          : "SIGNED_ORIGINAL_OBSERVED_HOLD",
      verified: true,
      sourceOnly: true,
      issuerAppId: envelope.sourceAppId,
      targetAppId: envelope.targetAppId,
      sourceRevision: envelope.sourceRevision,
      tenantId: envelope.tenantId,
      eventType: envelope.eventType,
      nonceDigestSha256: digest(
        envelope.sourceAppId + ":" + (envelope.tenantId ?? "global") + ":" + envelope.nonce,
      ),
      receiptDigestSha256,
      signerFingerprintSha256: pin.fingerprintSha256,
      issuedAt: iso(envelope.issuedAt),
      expiresAt: iso(packet.expiresAt),
      revokesReceiptDigestSha256:
        packet.revokesReceiptDigestSha256 ?? null,
      receiverConnected: false,
      ownerAcceptance: "HOLD",
    };
  } catch {
    return blocked("HOLD_INVALID_ORIGINAL_SIGNED_EVENT");
  }
}

export function inspectExpiry({ expiresAt, asOf }) {
  const expiry = Date.parse(expiresAt);
  const now = Date.parse(asOf);
  if (!Number.isFinite(expiry) || !Number.isFinite(now))
    return { status: "HOLD_UNVERIFIABLE_EXPIRY", renewalDue: true };
  if (now >= expiry)
    return { status: "HOLD_ORIGINAL_RECEIPT_EXPIRED", renewalDue: true };
  if (expiry - now <= 5 * 60_000)
    return { status: "HOLD_RENEWAL_REQUIRED_SOON", renewalDue: true };
  return { status: "ORIGINAL_CURRENT_REVIEW_ONLY", renewalDue: false };
}

/** Source-only outbox plan. A queue record is not delivery or recipient ACK. */
export function planRevocationHandoffs({ verifiedRevocation, sourceAppId }) {
  if (
    !verifiedRevocation?.verified ||
    verifiedRevocation.eventType !== "security_exception.v1" ||
    !SHA64.test(String(verifiedRevocation.revokesReceiptDigestSha256)) ||
    sourceAppId !== verifiedRevocation.issuerAppId
  )
    return { status: "HOLD_REVOCATION_ORIGIN_UNVERIFIED", targets: [] };
  const masters = [
    "ai-data-platform",
    "rosevear-ai-hub",
    "rosevear-comms-hub",
  ];
  // No direct iCamp customer/worker/brand events or media cross company lines.
  const targets = masters.filter((app) => app !== sourceAppId);
  return {
    schema: OUTBOX_SCHEMA,
    status: "SOURCE_VERIFIED_UNDELIVERED_HOLD",
    targets,
    receiverConnected: false,
    ownerAcceptance: "HOLD",
  };
}
