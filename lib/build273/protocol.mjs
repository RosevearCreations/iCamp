import { createHmac, timingSafeEqual } from "node:crypto";
export const UUID273 =
  /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/iu;
export const SHA273 = /^[a-f0-9]{64}$/u;
export const NONCE273 = /^[A-Za-z0-9_-]{16,96}$/u;
export const SOURCE273 = /^[a-z0-9_-]{8,64}$/u;
export function verifySignedBody273(body, signature, key) {
  if (
    typeof body !== "string" ||
    body.length > 3500 ||
    typeof key !== "string" ||
    key.length < 32 ||
    typeof signature !== "string" ||
    !SHA273.test(signature)
  )
    return false;
  return timingSafeEqual(
    createHmac("sha256", key).update(body, "utf8").digest(),
    Buffer.from(signature, "hex"),
  );
}
export function parseOriginalConsumer273(body, now = Date.now()) {
  const x = JSON.parse(body),
    keys = [
      "campgroundId",
      "sourcePairId",
      "kind",
      "subjectId",
      "sourceId",
      "providerEventId",
      "nonce",
      "evidenceSha256",
      "observedAt",
    ];
  if (
    !x ||
    typeof x !== "object" ||
    Array.isArray(x) ||
    Object.keys(x).sort().join("|") !== keys.sort().join("|")
  )
    throw Error("Invalid original consumer receipt shape");
  if (
    !UUID273.test(x.campgroundId) ||
    !UUID273.test(x.sourcePairId) ||
    !UUID273.test(x.subjectId) ||
    !["booking", "comms"].includes(x.kind) ||
    !SOURCE273.test(x.sourceId) ||
    !NONCE273.test(x.nonce) ||
    !SHA273.test(x.evidenceSha256) ||
    typeof x.providerEventId !== "string" ||
    x.providerEventId.trim().length < 16 ||
    x.providerEventId.length > 160
  )
    throw Error("Invalid original consumer receipt identity");
  const observed = Date.parse(x.observedAt ?? "");
  if (
    !Number.isFinite(observed) ||
    observed < now - 60000 ||
    observed > now + 60000
  )
    throw Error("Original consumer receipt not fresh");
  return { ...x, observedAt: new Date(observed).toISOString() };
}
export function parseOriginalRestore273(body, now = Date.now()) {
  const x = JSON.parse(body),
    keys = [
      "restoreReviewId",
      "providerId",
      "providerEventId",
      "nonce",
      "attestationSha256",
      "sourceHostSha256",
      "isolatedHostSha256",
      "observedAt",
    ];
  if (
    !x ||
    typeof x !== "object" ||
    Array.isArray(x) ||
    Object.keys(x).sort().join("|") !== keys.sort().join("|")
  )
    throw Error("Invalid original restore provider shape");
  if (
    !UUID273.test(x.restoreReviewId) ||
    !SOURCE273.test(x.providerId) ||
    !NONCE273.test(x.nonce) ||
    !SHA273.test(x.attestationSha256) ||
    !SHA273.test(x.sourceHostSha256) ||
    !SHA273.test(x.isolatedHostSha256) ||
    x.sourceHostSha256 === x.isolatedHostSha256 ||
    typeof x.providerEventId !== "string" ||
    x.providerEventId.trim().length < 16 ||
    x.providerEventId.length > 160
  )
    throw Error("Invalid restore independent host receipt");
  const observed = Date.parse(x.observedAt ?? "");
  if (
    !Number.isFinite(observed) ||
    observed < now - 60000 ||
    observed > now + 60000
  )
    throw Error("Restore provider attestation outside freshness window");
  return { ...x, observedAt: new Date(observed).toISOString() };
}
