/** Source-owned iCamp platform shell protocol, independent of campground tenancy. */
import { createHash, createPublicKey, verify } from "node:crypto";

export const SHELL_ID = "icamp";
export const CONTRACT = "rosevear.shell.nonproduction.v1";
export const PATHS = Object.freeze([
  "/api/integration/v1/shell/health",
  "/api/integration/v1/shell/capabilities",
]);
const HEX = /^[a-f0-9]{64}$/;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const FIELDS = [
  "status",
  "shell_id",
  "source_app_id",
  "contract",
  "environment",
  "method",
  "path",
  "issuer",
  "audience",
  "scope",
  "nonce",
  "issued_at",
  "expires_at",
  "manifest_sha256",
  "owner_receipt_sha256",
  "source_owner_receipt_sha256",
  "workload_id",
];
function canonical(value) {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value && typeof value === "object")
    return (
      "{" +
      Object.keys(value)
        .sort()
        .map((k) => JSON.stringify(k) + ":" + canonical(value[k]))
        .join(",") +
      "}"
    );
  return JSON.stringify(value);
}
const sha = (v) => createHash("sha256").update(v).digest("hex");
const deny = (code, httpStatus = 403) =>
  Object.freeze({
    code,
    httpStatus,
    status: "HOLD",
    authenticated: false,
    connected: false,
    tenantDataIncluded: false,
    commandsEnabled: false,
    eventsEnabled: false,
  });
const exact = (c) =>
  c &&
  typeof c === "object" &&
  !Array.isArray(c) &&
  Object.keys(c).length === FIELDS.length &&
  Object.keys(c).every((k) => FIELDS.includes(k));

/** Trust is read from independently authorized private infrastructure only.
 * Nonce claims must be atomic across all source regions and restarts.
 */
export async function verifyICampShellGet({
  method,
  path,
  query,
  headers = {},
  runtime,
  nowMs = Date.now(),
  trust,
  claimNonce,
  signWithSourceKms,
} = {}) {
  if (
    runtime !== "nonproduction" ||
    method !== "GET" ||
    !PATHS.includes(path) ||
    (query && Object.keys(query).length)
  )
    return deny("SHELL_METHOD_OR_ENVIRONMENT_DENIED", 405);
  if (
    !trust ||
    trust.originalSourceOwnerTest !== true ||
    trust.originalMasterOwnerTest !== true ||
    trust.verifiedWorkload !== true ||
    trust.verifiedIssuer !== true ||
    trust.manifestVerified !== true ||
    trust.keyHandleActive !== true ||
    trust.pinnedOriginVerified !== true ||
    typeof claimNonce !== "function" ||
    typeof signWithSourceKms !== "function"
  )
    return deny("SHELL_TEST_AUTHORITY_UNAVAILABLE", 503);
  const encoded = headers["x-rosevear-shell-envelope"];
  if (
    typeof encoded !== "string" ||
    encoded.length > 8192 ||
    !/^[A-Za-z0-9_-]+$/.test(encoded)
  )
    return deny("SHELL_CHALLENGE_MISSING");
  let envelope;
  try {
    envelope = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    return deny("SHELL_ENVELOPE_INVALID");
  }
  const c = envelope?.challenge;
  if (
    !exact(c) ||
    c.status !== "SHELL_TEST_CHALLENGE" ||
    c.contract !== CONTRACT ||
    c.shell_id !== SHELL_ID ||
    c.source_app_id !== SHELL_ID ||
    c.audience !== SHELL_ID ||
    c.issuer !== "ai-data-platform" ||
    c.scope !==
      (path.endsWith("/health")
        ? "read_shell_health"
        : "read_shell_capabilities") ||
    c.environment !== "nonproduction" ||
    c.method !== "GET" ||
    c.path !== path ||
    !/^[A-Za-z0-9_-]{43}$/.test(c.nonce ?? "") ||
    !Number.isSafeInteger(c.issued_at) ||
    !Number.isSafeInteger(c.expires_at) ||
    c.expires_at <= nowMs ||
    c.expires_at <= c.issued_at ||
    c.expires_at - c.issued_at > 120_000 ||
    c.issued_at > nowMs + 15_000 ||
    !HEX.test(c.manifest_sha256 ?? "") ||
    c.manifest_sha256 !== trust.manifestSha256 ||
    c.owner_receipt_sha256 !== trust.ownerReceiptSha256 ||
    c.source_owner_receipt_sha256 !== trust.sourceOwnerReceiptSha256 ||
    !UUID.test(c.workload_id ?? "") ||
    c.workload_id !== trust.workloadId ||
    !/^[A-Za-z0-9_-]{86}$/.test(envelope.signature ?? "") ||
    envelope.keyId !== trust.brokerKeyId
  )
    return deny("SHELL_SCOPE_OR_ORIGINAL_APPROVAL_DENIED");
  try {
    const brokerKey = createPublicKey(trust.pinnedBrokerPublicKeyPem);
    if (
      brokerKey.asymmetricKeyType !== "ed25519" ||
      !verify(
        null,
        Buffer.from(canonical(c)),
        brokerKey,
        Buffer.from(envelope.signature, "base64url"),
      )
    )
      return deny("SHELL_BROKER_SIGNATURE_INVALID");
    const challengeSha256 = sha(canonical(c));
    if (
      (await claimNonce({
        shellId: SHELL_ID,
        nonceSha256: sha(c.nonce),
        challengeSha256,
        expiresAt: c.expires_at,
      })) !== true
    )
      return deny("SHELL_REPLAY_OR_NONCE_STORE_UNAVAILABLE", 409);
    const receipt = {
      contract: CONTRACT,
      shell_id: SHELL_ID,
      source_app_id: SHELL_ID,
      environment: "nonproduction",
      status: "AUTHENTICATED_READONLY_TEST_HELD",
      capabilities_enabled: false,
      tenant_data_included: false,
      source_issuer: SHELL_ID,
      challenge_sha256: challengeSha256,
      nonce_sha256: sha(c.nonce),
      answered_at: nowMs,
      expires_at: c.expires_at,
    };
    const signature = await signWithSourceKms(Buffer.from(canonical(receipt)));
    if (
      signature?.attested !== true ||
      !/^[A-Za-z0-9_-]{86}$/.test(signature.signature ?? "") ||
      !/^[A-Za-z0-9_-]{12,100}$/.test(signature.keyId ?? "")
    )
      return deny("SHELL_SOURCE_KEY_UNATTESTED", 503);
    return {
      code: "SIGNED_TEST_ONLY",
      httpStatus: 200,
      status: "HOLD",
      authenticated: true,
      connected: false,
      tenantDataIncluded: false,
      commandsEnabled: false,
      eventsEnabled: false,
      envelope: {
        receipt,
        signature: signature.signature,
        keyId: signature.keyId,
      },
    };
  } catch {
    return deny("SHELL_SOURCE_KMS_OR_NONCE_UNAVAILABLE", 503);
  }
}
