import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const INTEGRATION_CONTRACT_VERSION = "rosevear.integration.v1";
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const READINESS_PATHS = new Set([
  "/api/integration/v1/health",
  "/api/integration/v1/capabilities",
]);
const DIGEST_EMPTY_BODY = createHash("sha256").update("").digest("hex");

export function loadIntegrationReadinessConfig(env = process.env) {
  const keyId = String(env.ICAMP_INTEGRATION_V1_KEY_ID ?? "").trim();
  const secret = String(env.ICAMP_INTEGRATION_V1_HMAC_SECRET ?? "");
  const allowedCampgrounds = new Set(
    String(env.ICAMP_INTEGRATION_V1_ALLOWED_CAMPGROUNDS ?? "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter((value) => UUID.test(value)),
  );
  return {
    enabled:
      env.ICAMP_INTEGRATION_V1_ENABLED === "true" &&
      keyId.length >= 3 &&
      keyId.length <= 80 &&
      secret.length >= 32,
    keyId,
    secret,
    allowedCampgrounds,
    environment: String(env.VERCEL_ENV ?? env.NODE_ENV ?? "unknown")
      .trim()
      .slice(0, 40),
    applicationVersion: String(env.ICAMP_APPLICATION_VERSION ?? "build-134")
      .trim()
      .slice(0, 50),
  };
}

export function canonicalReadinessSignature({
  path,
  timestamp,
  nonce,
  tenantId,
}) {
  return [
    "GET",
    path,
    timestamp,
    nonce,
    "ai-data-platform",
    tenantId,
    DIGEST_EMPTY_BODY,
  ].join("\n");
}

export function verifySignedReadiness(headers, path, config, now = new Date()) {
  if (!config.enabled)
    return { ok: false, httpStatus: 503, code: "INTEGRATION_HOLD" };
  if (!READINESS_PATHS.has(path))
    return { ok: false, httpStatus: 404, code: "UNKNOWN_CAPABILITY" };
  const issuer = headers.get("x-rosevear-issuer") ?? "";
  const keyId = headers.get("x-rosevear-key-id") ?? "";
  const timestamp = headers.get("x-rosevear-timestamp") ?? "";
  const nonce = headers.get("x-rosevear-nonce") ?? "";
  const tenantId = (headers.get("x-rosevear-tenant-id") ?? "").toLowerCase();
  const signature = headers.get("x-rosevear-signature") ?? "";
  if (
    issuer !== "ai-data-platform" ||
    keyId !== config.keyId ||
    !UUID.test(tenantId) ||
    !UUID.test(nonce) ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(timestamp)
  )
    return { ok: false, httpStatus: 401, code: "INVALID_GATEWAY_IDENTITY" };
  const issuedAt = new Date(timestamp);
  if (
    !Number.isFinite(issuedAt.getTime()) ||
    issuedAt.toISOString() !== timestamp ||
    !Number.isFinite(now.getTime()) ||
    Math.abs(now.getTime() - issuedAt.getTime()) > 300_000
  )
    return { ok: false, httpStatus: 401, code: "EXPIRED_GATEWAY_SIGNATURE" };
  if (!/^sha256=[a-f0-9]{64}$/.test(signature))
    return { ok: false, httpStatus: 401, code: "INVALID_GATEWAY_SIGNATURE" };
  const expected = createHmac("sha256", config.secret)
    .update(canonicalReadinessSignature({ path, timestamp, nonce, tenantId }))
    .digest();
  const supplied = Buffer.from(signature.slice(7), "hex");
  if (
    expected.length !== supplied.length ||
    !timingSafeEqual(expected, supplied)
  )
    return { ok: false, httpStatus: 401, code: "INVALID_GATEWAY_SIGNATURE" };
  return {
    ok: true,
    issuer,
    keyId,
    tenantId,
    nonce,
    timestamp,
    allowed: config.allowedCampgrounds.has(tenantId),
  };
}
