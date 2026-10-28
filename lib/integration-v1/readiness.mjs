import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const INTEGRATION_CONTRACT_VERSION = "rosevear.integration.v1";
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const NONCE = /^np-[0-9a-f]{32}$/;
const READINESS_PATHS = new Set([
  "/api/integration/v1/health",
  "/api/integration/v1/capabilities",
]);
const EMPTY_DIGEST = createHash("sha256").update("").digest("hex");

// One server-only key per iCamp campground and nonproduction environment.
// A future central gateway registry can supply multiple isolated entries.
export function loadIntegrationReadinessConfig(env = process.env) {
  const keyId = String(env.ICAMP_INTEGRATION_V1_KEY_ID ?? "").trim();
  const tenantId = String(env.ICAMP_INTEGRATION_V1_TENANT_ID ?? "").trim();
  const base64 = String(env.ICAMP_INTEGRATION_V1_HMAC_KEY_B64 ?? "").trim();
  const secret = /^[A-Za-z0-9+/]{43}=$/.test(base64)
    ? Buffer.from(base64, "base64")
    : Buffer.alloc(0);
  const deployment = String(env.VERCEL_ENV ?? "").toLowerCase();
  const nonproductionHost =
    deployment === "preview" ||
    deployment === "development" ||
    (deployment === "" && env.NODE_ENV === "test");
  return {
    enabled:
      env.ICAMP_INTEGRATION_V1_ENABLED === "true" &&
      env.ICAMP_INTEGRATION_V1_ENVIRONMENT === "nonproduction" &&
      nonproductionHost &&
      keyId.length >= 3 &&
      keyId.length <= 80 &&
      UUID.test(tenantId) &&
      secret.length === 32 &&
      secret.toString("base64") === base64,
    keyId,
    tenantId,
    secret,
    environment: "nonproduction",
    applicationVersion: String(env.ICAMP_APPLICATION_VERSION ?? "build-141")
      .trim()
      .slice(0, 50),
  };
}

export function canonicalReadinessSignature({
  path,
  timestamp,
  nonce,
  tenantId,
  keyId,
}) {
  return [
    INTEGRATION_CONTRACT_VERSION,
    "GET",
    path,
    String(timestamp),
    nonce,
    "ai-data-platform",
    "icamp",
    "icamp",
    tenantId,
    "nonproduction",
    EMPTY_DIGEST,
    keyId,
  ].join("\n");
}

export function verifySignedReadiness(headers, path, config, now = new Date()) {
  if (!config.enabled)
    return { ok: false, httpStatus: 503, code: "INTEGRATION_HOLD" };
  if (!READINESS_PATHS.has(path))
    return { ok: false, httpStatus: 404, code: "INVALID_GATEWAY_IDENTITY" };
  const contract = headers.get("x-rosevear-contract") ?? "";
  const environment = headers.get("x-rosevear-environment") ?? "";
  const issuer = headers.get("x-rosevear-source") ?? "";
  const destination = headers.get("x-rosevear-destination") ?? "";
  const business = headers.get("x-rosevear-business") ?? "";
  const keyId = headers.get("x-rosevear-key-id") ?? "";
  const timestamp = headers.get("x-rosevear-timestamp") ?? "";
  const nonce = headers.get("x-rosevear-nonce") ?? "";
  const tenantId = headers.get("x-rosevear-tenant") ?? "";
  const signature = headers.get("x-rosevear-signature") ?? "";
  if (
    contract !== INTEGRATION_CONTRACT_VERSION ||
    environment !== "nonproduction" ||
    issuer !== "ai-data-platform" ||
    destination !== "icamp" ||
    business !== "icamp" ||
    keyId !== config.keyId ||
    !UUID.test(tenantId) ||
    !NONCE.test(nonce) ||
    !/^\d{13}$/.test(timestamp) ||
    (headers.has("content-length") && headers.get("content-length") !== "0")
  )
    return { ok: false, httpStatus: 401, code: "INVALID_GATEWAY_IDENTITY" };
  const issuedMs = Number(timestamp);
  if (
    !Number.isSafeInteger(issuedMs) ||
    !Number.isFinite(now.getTime()) ||
    Math.abs(now.getTime() - issuedMs) > 300_000
  )
    return { ok: false, httpStatus: 401, code: "EXPIRED_GATEWAY_SIGNATURE" };
  if (!/^[A-Za-z0-9_-]{43}$/.test(signature))
    return { ok: false, httpStatus: 401, code: "INVALID_GATEWAY_SIGNATURE" };
  const expected = createHmac("sha256", config.secret)
    .update(
      canonicalReadinessSignature({ path, timestamp, nonce, tenantId, keyId }),
      "utf8",
    )
    .digest();
  const supplied = Buffer.from(signature, "base64url");
  if (
    expected.length !== supplied.length ||
    !timingSafeEqual(expected, supplied)
  )
    return { ok: false, httpStatus: 401, code: "INVALID_GATEWAY_SIGNATURE" };
  return {
    ok: true,
    issuer,
    destination,
    business,
    environment,
    keyId,
    tenantId,
    nonce,
    timestamp,
    allowed: tenantId === config.tenantId,
  };
}
