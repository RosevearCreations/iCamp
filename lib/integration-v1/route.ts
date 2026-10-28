import "server-only";
import { NextResponse } from "next/server";
import {
  INTEGRATION_CONTRACT_VERSION,
  loadIntegrationReadinessConfig,
  verifySignedReadiness,
} from "./readiness.mjs";
import {
  recordReadinessHandshake,
  recordReadinessDenial,
} from "./readiness-postgres.mjs";

function response(payload: Record<string, unknown>, status: number) {
  return NextResponse.json(payload, {
    status,
    headers: {
      "Cache-Control": "no-store, private",
      Vary: "X-Rosevear-Key-Id",
    },
  });
}

async function denied(path: string, code: string, status: number) {
  // Only enumerated denial metadata is persisted. No raw headers or secrets.
  try {
    await recordReadinessDenial(path, code);
  } catch {
    // Database outage still fails closed; a log without request data is the fallback.
    console.warn("iCamp integration denial receipt unavailable", code);
  }
  return response({ error: code, connection_state: "HOLD" }, status);
}

export function handleIntegrationMethodDenied(
  _request: Request,
  path: "/api/integration/v1/health" | "/api/integration/v1/capabilities",
) {
  return denied(path, "METHOD_NOT_ALLOWED", 405);
}

export async function handleIntegrationReadiness(
  request: Request,
  path: "/api/integration/v1/health" | "/api/integration/v1/capabilities",
) {
  const config = loadIntegrationReadinessConfig();
  const checkedAt = new Date();
  if (new URL(request.url).search)
    return denied(path, "QUERY_NOT_ALLOWED", 400);
  if (request.method !== "GET") return denied(path, "METHOD_NOT_ALLOWED", 405);
  const auth = verifySignedReadiness(request.headers, path, config, checkedAt);
  if (!auth.ok) return denied(path, auth.code, auth.httpStatus);
  if (!auth.allowed) return denied(path, "TENANT_HOLD", 403);
  let firstUse = false;
  try {
    firstUse = await recordReadinessHandshake({
      issuer: auth.issuer,
      keyId: auth.keyId,
      nonce: auth.nonce,
      tenantId: auth.tenantId,
      timestamp: auth.timestamp,
      path,
      allowed: auth.allowed,
    });
  } catch {
    // An unknown tenant is a denial, not an excuse to expose campgrounds.
    return denied(path, "HANDSHAKE_RECEIPT_UNAVAILABLE", 503);
  }
  if (!firstUse) return denied(path, "REPLAY_REJECTED", 409);

  const identity = {
    application_id: "icamp",
    application_version: config.applicationVersion,
    integration_contract: INTEGRATION_CONTRACT_VERSION,
    environment: config.environment,
    connection_state: "HOLD",
    checked_at: checkedAt.toISOString(),
    gateway_issuer: "ai-data-platform",
    tenant_id: auth.tenantId,
  };
  if (path.endsWith("/health"))
    return response(
      { ...identity, readiness: "authenticated_nonproduction_read_only_held" },
      200,
    );
  return response(
    {
      ...identity,
      capabilities: [],
      capability_scope: "campground_authenticated_no_reference_api_enabled",
      commands_enabled: false,
      events_enabled: false,
    },
    200,
  );
}
