/** QL-364 source-owned adapter for a single, externally authorized private TEST GET.
 * Code distribution is not credential enrollment, issuer proof, or a live connection.
 * Source custody, original-owner approvals, atomic replay claims, and Ed25519
 * signing MUST be furnished by separate trusted source-server adapters.
 */
export const QL364_PATH = "/api/integration/v1/shell/health";
export const QL364_REQUEST_SCHEMA =
  "rosevear.hub.ql362.source-owner-one-get.v1";
export const QL364_HEALTH_SCHEMA =
  "rosevear.hub.ql362.source-health-receipt.v1";
export const QL364_ENVELOPE_SCHEMA =
  "rosevear.hub.ql363.source-health-envelope.v1";
export const QL364_RECEIPT_SCHEMA =
  "rosevear.hub.ql363.source-signed-health-receipt.v1";
export const QL364_CONTRACT_SCHEMA =
  "rosevear.hub.ql363.six-source-health-contract.v1";
const IDS = Object.freeze([
  "yw",
  "icamp",
  "rosiedazzlers",
  "devilndove",
  "ai-data-platform",
  "rosevear-ai-hub",
]);
const SHA = /^[a-f0-9]{64}$/;
const COMMIT = /^[a-f0-9]{40}$/;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SIG = /^[A-Za-z0-9_-]{86}$/;
const exact = (v, fields) =>
  v &&
  typeof v === "object" &&
  !Array.isArray(v) &&
  Object.keys(v).length === fields.length &&
  Object.keys(v).every((k) => fields.includes(k));
export function canonicalQl364(v) {
  if (Array.isArray(v)) return "[" + v.map(canonicalQl364).join(",") + "]";
  if (v && typeof v === "object")
    return (
      "{" +
      Object.keys(v)
        .sort()
        .map((k) => JSON.stringify(k) + ":" + canonicalQl364(v[k]))
        .join(",") +
      "}"
    );
  return JSON.stringify(v);
}
const encoder = new TextEncoder();
const hex = (bytes) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
export async function hashQl364(v) {
  return hex(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", encoder.encode(canonicalQl364(v))),
    ),
  );
}
function response(code, status = 503) {
  return new Response(
    JSON.stringify({
      schema: QL364_ENVELOPE_SCHEMA,
      state: code,
      connectionState: "DISCONNECTED / HOLD",
      connected: false,
      authenticated: false,
      customerDataAllowed: false,
      customerCommunications: false,
      deviceActions: false,
    }),
    {
      status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
        "Access-Control-Allow-Origin": "none",
      },
    },
  );
}
const requestFields = [
  "schema",
  "kind",
  "archiveId",
  "handoffSha256",
  "sourceId",
  "repository",
  "operationId",
  "sourceCommitSha",
  "manifestSha256",
  "sourceOrigin",
  "environment",
  "method",
  "path",
  "issuedAt",
  "expiresAt",
  "customerDataAllowed",
  "deviceActionsAllowed",
  "persistentConnectionAllowed",
];
function validOriginalRequest(v, sourceId, now) {
  const start = Date.parse(v?.issuedAt ?? ""),
    end = Date.parse(v?.expiresAt ?? "");
  return (
    exact(v, requestFields) &&
    v.schema === QL364_REQUEST_SCHEMA &&
    v.kind === "ONE_PRIVATE_HEALTH_GET_INTENT" &&
    v.sourceId === sourceId &&
    v.method === "GET" &&
    v.path === QL364_PATH &&
    v.environment === "TEST" &&
    v.customerDataAllowed === false &&
    v.deviceActionsAllowed === false &&
    v.persistentConnectionAllowed === false &&
    UUID.test(v.operationId ?? "") &&
    COMMIT.test(v.sourceCommitSha ?? "") &&
    SHA.test(v.handoffSha256 ?? "") &&
    SHA.test(v.manifestSha256 ?? "") &&
    typeof v.archiveId === "string" &&
    v.archiveId.length > 0 &&
    v.archiveId.length < 160 &&
    typeof v.sourceOrigin === "string" &&
    /^https:\/\/[^/?#]+$/.test(v.sourceOrigin) &&
    Number.isFinite(start) &&
    Number.isFinite(end) &&
    v.issuedAt === new Date(start).toISOString() &&
    v.expiresAt === new Date(end).toISOString() &&
    start <= now + 5_000 &&
    end > now &&
    end - start <= 90_000
  );
}
/** Independent callbacks are never populated from HTTP, tenant data or env secrets.
 * approveOriginalGet must independently validate pinned source/master signatures,
 * issuer custody, source revision and exact request authorization.
 * claimOperation must atomically persist the one-use key before any success.
 * signSourceReceipt must use an authenticated non-exportable source-owned key.
 */
export async function handleQl364SourceHealth({
  request,
  sourceId,
  repository,
  approveOriginalGet,
  claimOperation,
  signSourceReceipt,
  now = Date.now(),
} = {}) {
  if (!IDS.includes(sourceId) || !request)
    return response("DENY_UNKNOWN_SOURCE", 403);
  const url = new URL(request.url);
  if (request.method !== "GET") return response("DENY_METHOD", 405);
  if (url.pathname !== QL364_PATH || url.search || url.hash)
    return response("DENY_EXACT_READONLY_SCOPE", 403);
  if (
    [...request.headers.keys()].some((k) =>
      /^(x-rosevear-(business|tenant|child)|x-child-id)$/.test(k),
    )
  )
    return response("DENY_CHILD_IDENTITY_AS_SHELL", 403);
  if (
    typeof approveOriginalGet !== "function" ||
    typeof claimOperation !== "function" ||
    typeof signSourceReceipt !== "function"
  )
    return response(
      "HOLD_ORIGINAL_OWNERS_SIGNER_AND_DURABLE_NONCE_UNAVAILABLE",
    );
  const encoded = request.headers.get("x-rosevear-ql362-request");
  if (!encoded || encoded.length > 4096 || !/^[A-Za-z0-9_-]+$/.test(encoded))
    return response("DENY_SIGNED_TEST_REQUEST_MISSING", 403);
  try {
    const b64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(b64);
    const bytes = Uint8Array.from(json, (c) => c.charCodeAt(0));
    const intent = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    );
    if (
      !validOriginalRequest(intent, sourceId, now) ||
      intent.repository !== repository
    )
      return response("DENY_QL362_SCOPE_OR_EXPIRY", 403);
    const requestSha256 = await hashQl364(intent);
    const approved = await approveOriginalGet({
      sourceId,
      operationId: intent.operationId,
      requestSha256,
      intent,
    });
    if (
      approved?.state !==
        "INDEPENDENT_ORIGINAL_SOURCE_AND_MASTER_OWNER_TEST_AUTHORIZED" ||
      approved.sourceId !== sourceId ||
      approved.operationId !== intent.operationId ||
      approved.requestSha256 !== requestSha256 ||
      approved.revoked !== false ||
      approved.originalIssuerVerified !== true ||
      approved.sourceOwnerVerified !== true ||
      approved.masterOwnerVerified !== true ||
      approved.originalSignerCustodyVerified !== true ||
      approved.sourceCommitSha !== intent.sourceCommitSha ||
      approved.manifestSha256 !== intent.manifestSha256 ||
      approved.sourceOrigin !== intent.sourceOrigin ||
      !SHA.test(approved.sourceSignerSpkiSha256 ?? "")
    )
      return response("HOLD_INDEPENDENT_ORIGINAL_AUTHORIZATION_MISSING", 403);
    if (
      (await claimOperation({
        sourceId,
        operationId: intent.operationId,
        requestSha256,
        expiresAt: intent.expiresAt,
      })) !== true
    )
      return response("DENY_NONCE_REPLAY_OR_DURABLE_STORAGE_UNAVAILABLE", 409);
    const issuedAt = new Date(now).toISOString();
    const expiresAt = new Date(
      Math.min(Date.parse(intent.expiresAt), now + 90_000),
    ).toISOString();
    if (Date.parse(expiresAt) <= Date.parse(issuedAt))
      return response("DENY_TEST_EXPIRED", 403);
    const health = {
      schema: QL364_HEALTH_SCHEMA,
      sourceId,
      operationId: intent.operationId,
      health: "ok",
      connected: false,
      customerDataAllowed: false,
      deviceActions: false,
    };
    const receipt = {
      schema: QL364_RECEIPT_SCHEMA,
      sourceId,
      operationId: intent.operationId,
      requestSha256,
      receiptSha256: await hashQl364(health),
      sourceCommitSha: intent.sourceCommitSha,
      sourceOrigin: intent.sourceOrigin,
      environment: "TEST",
      method: "GET",
      path: QL364_PATH,
      scope: "HEALTH_METADATA_ONLY_NO_CUSTOMERS_OR_DEVICES",
      issuedAt,
      expiresAt,
    };
    const signed = await signSourceReceipt(
      encoder.encode(canonicalQl364(receipt)),
      { sourceId, operationId: intent.operationId, requestSha256 },
    );
    if (
      signed?.attested !== true ||
      signed.spkiSha256 !== approved.sourceSignerSpkiSha256 ||
      !SIG.test(signed.signature ?? "") ||
      !/^[A-Za-z0-9_-]{12,100}$/.test(signed.keyId ?? "")
    )
      return response("HOLD_ORIGINAL_SOURCE_SIGNER_UNATTESTED");
    const body = {
      schema: QL364_ENVELOPE_SCHEMA,
      health,
      receipt: {
        schema: QL364_RECEIPT_SCHEMA,
        payload: receipt,
        signature: signed.signature,
        keyId: signed.keyId,
      },
    };
    const responseJson = JSON.stringify(body);
    if (encoder.encode(responseJson).length > 4096)
      return response("DENY_OVERSIZED_HEALTH_RESPONSE", 503);
    return new Response(responseJson, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
        "Access-Control-Allow-Origin": "none",
      },
    });
  } catch {
    return response("HOLD_PRIVATE_AUTHORITY_OR_RECEIPT_UNAVAILABLE");
  }
}
