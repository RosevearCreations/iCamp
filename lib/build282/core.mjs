import { createHash, createPublicKey, verify } from "node:crypto";
import { SHA276, UUID276 } from "../build276/core.mjs";

export function recoveryReasons282(summary) {
  if (!summary?.admission?.adopted || !summary.admission.host?.pinned)
    return ["ORIGINAL_DATABASE_NOT_VERIFIED"];
  const reasons = [];
  if (!summary.monitoring?.ownerMfaCurrent)
    reasons.push("OWNER_RECOVERY_CONTINUITY_HOLD");
  if (!summary.monitoring?.signedProviderCurrent)
    reasons.push("PROVIDER_ACK_FRESHNESS_HOLD");
  if (summary.sourceCount !== 7) reasons.push("SOURCE_CONTINUITY_HOLD");
  if (!summary.monitoring?.independentReviewLive)
    reasons.push("INDEPENDENT_MONITOR_HOLD");
  return reasons;
}

export function verifyAlertDelivery282({
  body,
  signature,
  incident,
  key,
  now,
}) {
  if (
    typeof body !== "string" ||
    body.length > 2400 ||
    typeof signature !== "string" ||
    !/^[A-Za-z0-9_-]{86}$/u.test(signature)
  )
    throw Error("MALFORMED_ALERT_RECEIPT");
  const receipt = JSON.parse(body);
  if (
    !receipt ||
    typeof receipt !== "object" ||
    Array.isArray(receipt) ||
    Object.keys(receipt).sort().join("|") !==
      "alertId|deliveredAt|eventId|keyId|kind|priorAckDigest|providerId" ||
    receipt.kind !== "icamp-original-provider-alert-delivery-v1" ||
    !UUID276.test(receipt.alertId ?? "") ||
    !SHA276.test(receipt.priorAckDigest ?? "") ||
    !/^[A-Za-z0-9_-]{16,160}$/u.test(receipt.eventId ?? "") ||
    receipt.alertId !== incident.id ||
    receipt.priorAckDigest !== incident.ackDigest ||
    receipt.providerId !== key.providerId ||
    receipt.keyId !== key.keyId
  )
    throw Error("ALERT_RECEIPT_CONTEXT_MISMATCH");
  const delivered = Date.parse(receipt.deliveredAt);
  const opened = new Date(incident.openedAt).getTime();
  if (
    typeof receipt.deliveredAt !== "string" ||
    !Number.isFinite(delivered) ||
    new Date(delivered).toISOString() !== receipt.deliveredAt ||
    !Number.isFinite(opened) ||
    !Number.isFinite(now) ||
    delivered < opened ||
    delivered < now - 300000 ||
    delivered > now + 30000
  )
    throw Error("ALERT_RECEIPT_STALE");
  const publicKey = createPublicKey(key.publicKeyPem);
  const fingerprint = createHash("sha256")
    .update(publicKey.export({ type: "spki", format: "der" }))
    .digest("hex");
  if (
    publicKey.asymmetricKeyType !== "ed25519" ||
    fingerprint !== key.fingerprint ||
    Buffer.from(signature, "base64url").toString("base64url") !== signature ||
    !verify(
      null,
      Buffer.from(body),
      publicKey,
      Buffer.from(signature, "base64url"),
    )
  )
    throw Error("ALERT_RECEIPT_SIGNATURE_INVALID");
  return receipt;
}
