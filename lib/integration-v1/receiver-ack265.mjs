import { createHash, createPublicKey, verify } from "node:crypto";

export const ROSEVEAR_PEER_APPS265 = Object.freeze([
  "ai-data-platform",
  "rosevear-comms-hub",
  "rosevear-ai-hub",
  "icamp",
  "yw",
  "rosiedazzlers",
  "devilndove-site",
]);
const SHA = /^[a-f0-9]{40}$/u;
const HEX = /^[a-f0-9]{32,128}$/u;
const REF = /^[A-Za-z0-9:._/-]{8,160}$/u;
function fingerprint(key) {
  return createHash("sha256")
    .update(key.export({ format: "der", type: "spki" }))
    .digest("hex");
}
export function verifyOriginalReceiverAck265({
  envelopeJson,
  appId,
  publicKeyPem,
  expectedSourceSha,
  expectedReceiverSha,
  independentlyEnrolled,
  now = new Date(),
}) {
  if (
    !ROSEVEAR_PEER_APPS265.includes(appId) ||
    !independentlyEnrolled ||
    !SHA.test(expectedSourceSha ?? "") ||
    !SHA.test(expectedReceiverSha ?? "")
  )
    throw Error(
      "HOLD: independent receiver enrollment, exact source and receiver SHAs required.",
    );
  if (
    typeof envelopeJson !== "string" ||
    envelopeJson.length > 8000 ||
    typeof publicKeyPem !== "string" ||
    publicKeyPem.length > 6000
  )
    throw Error("HOLD: original signed receiver ACK is missing.");
  const key = createPublicKey(publicKeyPem);
  if (key.asymmetricKeyType !== "ed25519")
    throw Error("HOLD: Ed25519 receiver key required.");
  let envelope;
  try {
    envelope = JSON.parse(envelopeJson);
  } catch {
    throw Error("HOLD: malformed original receiver ACK");
  }
  const payload = envelope?.payload;
  if (
    !payload ||
    typeof payload !== "object" ||
    Array.isArray(payload) ||
    payload.schema !== "rosevear.peer.receiver-ack.v1" ||
    payload.appId !== appId ||
    payload.status !== "ACK" ||
    payload.sourceSha !== expectedSourceSha ||
    payload.receiverSha !== expectedReceiverSha ||
    !REF.test(payload.originalReceiptReference ?? "") ||
    !HEX.test(payload.nonce ?? "") ||
    !/^[a-f0-9]{64}$/u.test(payload.sourceAggregateDigestSha256 ?? "") ||
    payload.receiverFingerprintSha256 !== fingerprint(key) ||
    payload.authorizesAction !== false
  )
    throw Error(
      "HOLD: receiver identity, source or original receipt scope differs.",
    );
  const issued = Date.parse(payload.issuedAt);
  const expires = Date.parse(payload.expiresAt);
  if (
    !Number.isFinite(issued) ||
    !Number.isFinite(expires) ||
    issued > now.getTime() + 60000 ||
    issued < now.getTime() - 60000 ||
    expires <= now.getTime() ||
    expires - issued > 60000
  )
    throw Error("HOLD: receiver ACK is stale, expired or future dated.");
  const sig = envelope.receiverSignatureBase64;
  if (
    typeof sig !== "string" ||
    !/^[A-Za-z0-9+/]+={0,2}$/u.test(sig) ||
    sig.length > 160
  )
    throw Error("HOLD: original receiver signature missing.");
  const bytes = Buffer.from(sig, "base64");
  if (
    bytes.length !== 64 ||
    !verify(null, Buffer.from(JSON.stringify(payload)), key, bytes)
  )
    throw Error("HOLD: receiver signature mismatch.");
  return {
    appId,
    status: "SIGNED_ORIGINAL_RECEIVER_ACK_OBSERVED",
    sourceSha: payload.sourceSha,
    receiverSha: payload.receiverSha,
    originalReceiptReference: payload.originalReceiptReference,
    expiresAt: payload.expiresAt,
    remoteLiveTransportProven: false,
    permitsRemoteReboot: false,
    permitsSendingMessages: false,
    permitsPayments: false,
  };
}
export function readReceiverMatrix265(env = process.env, now = new Date()) {
  let matrix = {};
  try {
    const json = JSON.parse(
      String(env.ROSEVEAR_RECEIVER_ACK265_MATRIX_JSON ?? "{}"),
    );
    if (json && typeof json === "object" && !Array.isArray(json)) matrix = json;
  } catch {}
  const records = ROSEVEAR_PEER_APPS265.map((appId) => {
    const item = matrix[appId];
    if (!item)
      return {
        appId,
        status: "HOLD_NO_ORIGINAL_RECEIVER_ACK",
        originalReceiptReference: null,
      };
    try {
      const verified = verifyOriginalReceiverAck265({
        envelopeJson: item.envelopeJson,
        appId,
        publicKeyPem: item.publicKeyPem,
        expectedSourceSha: item.expectedSourceSha,
        expectedReceiverSha: item.expectedReceiverSha,
        independentlyEnrolled: item.independentlyEnrolled === true,
        now,
      });
      return {
        appId,
        status: verified.status,
        originalReceiptReference: verified.originalReceiptReference,
      };
    } catch {
      return {
        appId,
        status: "HOLD_UNVERIFIED_RECEIVER_ACK",
        originalReceiptReference: null,
      };
    }
  });
  return {
    status: "NO_REALTIME_SEVEN_APP_CONNECTION_CERTIFICATION",
    records,
    verifiedOriginalAckCount: records.filter(
      (r) => r.status === "SIGNED_ORIGINAL_RECEIVER_ACK_OBSERVED",
    ).length,
    independentlyConnected: false,
    rebootAcknowledged: false,
    automaticallyAuthorizedActions: false,
  };
}
