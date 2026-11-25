import { createHash, createPublicKey, verify } from "node:crypto";
import { UUID276, SHA276 } from "../build276/core.mjs";
export const PROVIDER_CLOSURE_KIND280 = "icamp-isolated-provider-closure-v1";
const providerId = /^[a-z0-9_-]{8,64}$/u;
const keyId = /^[a-z0-9_-]{8,80}$/u;
const eventId = /^[A-Za-z0-9_-]{16,160}$/u;
const nonce = /^[A-Za-z0-9_-]{16,96}$/u;
const sig = /^[A-Za-z0-9_-]{86}$/u;
const canonicalKeys = Object.freeze(
  [
    "backupManifestSha256",
    "isolatedHostSha256",
    "keyId",
    "kind",
    "nonce",
    "observedAt",
    "providerEventId",
    "providerId",
    "scopeDigestSha256",
    "sourceHostSha256",
  ].sort(),
);
export const digest280 = (raw) =>
  createHash("sha256").update(raw).digest("hex");

export function validateProviderKey280(input) {
  if (
    !providerId.test(input?.providerId ?? "") ||
    !keyId.test(input?.keyId ?? "") ||
    !SHA276.test(input?.fingerprint ?? "") ||
    !SHA276.test(input?.evidenceDigest ?? "") ||
    typeof input?.publicKeyPem !== "string" ||
    input.publicKeyPem.length > 1200 ||
    !input.publicKeyPem.startsWith("-----BEGIN PUBLIC KEY-----") ||
    !input.publicKeyPem.trimEnd().endsWith("-----END PUBLIC KEY-----") ||
    input.publicKeyPem.includes("PRIVATE KEY")
  )
    throw Error("UNVERIFIED_EXTERNAL_PROVIDER_PUBLIC_KEY");
  let pub;
  try {
    pub = createPublicKey(input.publicKeyPem);
  } catch {
    throw Error("INVALID_PROVIDER_PUBLIC_KEY");
  }
  if (pub.asymmetricKeyType !== "ed25519")
    throw Error("EXTERNAL_ED25519_REQUIRED");
  const fingerprint = digest280(pub.export({ type: "spki", format: "der" }));
  if (fingerprint !== input.fingerprint)
    throw Error("PROVIDER_KEY_FINGERPRINT_MISMATCH");
  return {
    ...input,
    publicKeyPem: pub.export({ type: "spki", format: "pem" }).trim() + "\n",
  };
}
export function validateProviderKeyReview280(input) {
  if (
    !UUID276.test(input?.proposalId ?? "") ||
    !SHA276.test(input?.evidenceDigest ?? "")
  )
    throw Error("INVALID_EXTERNAL_PROVIDER_KEY_REVIEW");
  return input;
}
export function scopeDigest280(record) {
  const keys = [
    "original_backup_manifest_sha256",
    "tenant_isolation_sha256",
    "reservation_integrity_sha256",
    "payment_ledger_sha256",
    "service_health_sha256",
  ];
  if (!keys.every((k) => SHA276.test(record?.[k] ?? "")))
    throw Error("MISSING_ORIGINAL_FOUR_SCOPE_PROOF");
  return digest280(JSON.stringify(keys.map((k) => record[k])));
}
export function verifyProviderClosure280({
  body,
  signature,
  providerKey,
  original,
  now = Date.now(),
}) {
  if (
    typeof body !== "string" ||
    body.length > 3000 ||
    body.length < 120 ||
    typeof signature !== "string" ||
    !sig.test(signature)
  )
    throw Error("MALFORMED_SIGNED_PROVIDER_CLOSURE");
  let receipt;
  try {
    receipt = JSON.parse(body);
  } catch {
    throw Error("INVALID_SIGNED_PROVIDER_JSON");
  }
  if (
    !receipt ||
    typeof receipt !== "object" ||
    Array.isArray(receipt) ||
    Object.keys(receipt).sort().join("|") !== canonicalKeys.join("|") ||
    receipt.kind !== PROVIDER_CLOSURE_KIND280 ||
    !providerId.test(receipt.providerId ?? "") ||
    !keyId.test(receipt.keyId ?? "") ||
    !eventId.test(receipt.providerEventId ?? "") ||
    !nonce.test(receipt.nonce ?? "") ||
    ![
      receipt.sourceHostSha256,
      receipt.isolatedHostSha256,
      receipt.backupManifestSha256,
      receipt.scopeDigestSha256,
    ].every((x) => SHA276.test(x ?? "")) ||
    receipt.sourceHostSha256 === receipt.isolatedHostSha256
  )
    throw Error("UNVERIFIED_PROVIDER_IDENTITY_OR_HOST");
  const when = Date.parse(receipt.observedAt ?? "");
  if (!Number.isFinite(when) || when < now - 300000 || when > now + 30000)
    throw Error("STALE_OR_FUTURE_PROVIDER_CLOSURE");
  if (
    !providerKey ||
    receipt.providerId !== providerKey.providerId ||
    receipt.keyId !== providerKey.keyId ||
    receipt.providerId !== original?.providerId ||
    receipt.sourceHostSha256 !== original?.sourceHostSha256 ||
    receipt.isolatedHostSha256 !== original?.isolatedHostSha256 ||
    receipt.backupManifestSha256 !== original?.backupManifestSha256 ||
    receipt.scopeDigestSha256 !== original?.scopeDigestSha256
  )
    throw Error("PROVIDER_CLOSURE_NOT_TIED_TO_ORIGINAL_ISOLATED_EVIDENCE");
  let key;
  try {
    key = createPublicKey(providerKey.publicKeyPem);
    if (
      key.asymmetricKeyType !== "ed25519" ||
      Buffer.from(signature, "base64url").length !== 64 ||
      !verify(
        null,
        Buffer.from(body, "utf8"),
        key,
        Buffer.from(signature, "base64url"),
      )
    )
      throw Error("PROVIDER_SIGNATURE_INVALID");
  } catch {
    throw Error("PROVIDER_SIGNATURE_INVALID");
  }
  return { ...receipt, digest: digest280(body) };
}
export function validateOwnerCompletion280(input) {
  if (
    !UUID276.test(input?.ownerAuditId ?? "") ||
    !SHA276.test(input?.evidenceDigest ?? "")
  )
    throw Error("INVALID_OWNER_RECOVERY_COMPLETION");
  return input;
}
export function validateCertificate280(input) {
  if (
    !UUID276.test(input?.providerClosureId ?? "") ||
    !UUID276.test(input?.ownerWitnessId ?? "") ||
    !SHA276.test(input?.evidenceDigest ?? "")
  )
    throw Error("INVALID_ISOLATED_CERTIFICATE_REFERENCE");
  return input;
}
export function classifyCertificate280({
  admission,
  providerSigned,
  ownerWitness,
  sources,
  certificateStored,
}) {
  const prerequisites =
    admission?.adopted === true &&
    admission?.host?.pinned === true &&
    providerSigned === true &&
    ownerWitness === true &&
    sources === 7;
  return {
    status:
      prerequisites && certificateStored
        ? "INDEPENDENT_ISOLATED_REVIEW_CERTIFICATE_RECORDED_FINAL_EXTERNAL_ACK_PENDING"
        : "HOLD_ORIGINAL_PROVIDER_SIGNED_RECOVERY_CERTIFICATION",
    originalEvidenceReady: prerequisites,
    productionRestored: false,
    externalProviderFinalAck: false,
  };
}
