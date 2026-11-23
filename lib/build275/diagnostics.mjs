import { createHash, createPublicKey, verify } from "node:crypto";

export const SOURCES275 = Object.freeze([
  "ai-data-platform",
  "rosevear-comms-hub",
  "rosevear-ai-hub",
  "yard-workers",
  "rosie-dazzlers",
  "devil-n-dove",
  "icamp",
]);
const hex40 = /^[a-f0-9]{40}$/u;
const id = /^[a-z0-9_-]{8,80}$/u;
const nonce = /^[A-Za-z0-9_-]{16,96}$/u;
const sig64 = /^[A-Za-z0-9_-]{86}$/u;

export function pins275(raw) {
  try {
    const source = JSON.parse(raw ?? "{}");
    if (!source || typeof source !== "object" || Array.isArray(source))
      return {};
    const valid = {};
    for (const name of SOURCES275) {
      const item = source[name];
      if (
        item &&
        id.test(item.keyId ?? "") &&
        hex40.test(item.commitSha ?? "") &&
        typeof item.publicKeyPem === "string" &&
        item.publicKeyPem.includes("BEGIN PUBLIC KEY")
      )
        valid[name] = item;
    }
    return valid;
  } catch {
    return {};
  }
}

export function verifySigned275({ body, signature, pins, now = Date.now() }) {
  if (
    typeof body !== "string" ||
    body.length > 2400 ||
    typeof signature !== "string" ||
    !sig64.test(signature)
  )
    throw Error("INVALID_SIGNED_RECEIPT");
  let x;
  try {
    x = JSON.parse(body);
  } catch {
    throw Error("INVALID_JSON");
  }
  const keys = [
    "source",
    "keyId",
    "commitSha",
    "challengeId",
    "nonce",
    "observedAt",
  ];
  if (
    !x ||
    typeof x !== "object" ||
    Array.isArray(x) ||
    Object.keys(x).sort().join("|") !== keys.sort().join("|") ||
    !SOURCES275.includes(x.source) ||
    !id.test(x.keyId ?? "") ||
    !hex40.test(x.commitSha ?? "") ||
    !nonce.test(x.challengeId ?? "") ||
    !nonce.test(x.nonce ?? "")
  )
    throw Error("INVALID_SOURCE_IDENTITY");
  const observed = Date.parse(x.observedAt ?? "");
  if (
    !Number.isFinite(observed) ||
    observed < now - 120000 ||
    observed > now + 30000
  )
    throw Error("STALE_RECEIPT");
  const p = pins[x.source];
  if (!p || p.keyId !== x.keyId || p.commitSha !== x.commitSha)
    throw Error("UNPINNED_SOURCE");
  const bytes = Buffer.from(signature, "base64url");
  if (bytes.length !== 64) throw Error("INVALID_SIGNATURE_SIZE");
  let valid = false;
  try {
    valid = verify(
      null,
      Buffer.from(body, "utf8"),
      createPublicKey(p.publicKeyPem),
      bytes,
    );
  } catch {
    valid = false;
  }
  if (!valid) throw Error("SIGNATURE_REJECTED");
  return {
    ...x,
    observedAt: new Date(observed).toISOString(),
    body,
    signature,
    digest: createHash("sha256").update(body).digest("hex"),
  };
}

export function classify275({
  host,
  owner,
  session,
  ledger,
  configured = [],
  now = Date.now(),
}) {
  const pinnedHost = host?.hostPinned === true && host?.adopted === true;
  const ownerReady =
    pinnedHost &&
    owner?.identifiedOriginalHost === true &&
    owner?.accountFound === true &&
    owner?.accountActive === true &&
    owner?.credentialPresent === true &&
    owner?.mfaVerified === true &&
    owner?.recoveryEmailVerified === true &&
    owner?.platformGrantActive === true &&
    owner?.independentOwnerBinding === true &&
    session?.originalRosevear === true &&
    session?.aal2 === true;
  const checks = SOURCES275.map((source) => {
    const item = ledger.receipts.find((r) => r.source === source);
    const observed = Date.parse(item?.observedAt ?? "");
    const fresh =
      item &&
      Number.isFinite(observed) &&
      observed <= now + 30000 &&
      observed >= now - 300000;
    return {
      source,
      status:
        pinnedHost && ledger.schemaReady && configured.includes(source) && fresh
          ? "SIGNED_REVIEW_REQUIRED"
          : "HOLD",
    };
  });
  const signedCount = checks.filter(
    (x) => x.status === "SIGNED_REVIEW_REQUIRED",
  ).length;
  return {
    hostStatus: pinnedHost
      ? "ORIGINAL_HOST_SCHEMA_PRESENT"
      : "HOLD_HOST_OR_0248",
    ownerStatus: ownerReady
      ? "ORIGINAL_AAL2_EVIDENCE_PRESENT"
      : "HOLD_OWNER_RECOVERY",
    handshakeStatus:
      signedCount === 7
        ? "SEVEN_SIGNED_RECEIPTS_REVIEW_REQUIRED"
        : "HOLD_SEVEN_SIGNED_SOURCES",
    signedCount,
    checks,
    closureStatus:
      ownerReady && signedCount === 7
        ? "PENDING_INDEPENDENT_RESTORE_REVIEW"
        : "HOLD_PRODUCTION_RECOVERY",
  };
}
