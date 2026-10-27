import "server-only";
import { NextResponse } from "next/server";
import {
  INTEGRATION_CONTRACT_VERSION,
  loadIntegrationReadinessConfig,
  verifySignedReadiness,
} from "./readiness.mjs";
import { recordReadinessHandshake } from "./readiness-postgres.mjs";

function response(payload: Record<string, unknown>, status: number) {
  return NextResponse.json(payload, {
    status,
    headers: { "Cache-Control": "no-store, private", Vary: "Authorization" },
  });
}

export async function handleIntegrationReadiness(
  request: Request,
  path: "/api/integration/v1/health" | "/api/integration/v1/capabilities",
) {
  const config = loadIntegrationReadinessConfig();
  const checkedAt = new Date();
  const auth = verifySignedReadiness(request.headers, path, config, checkedAt);
  if (!auth.ok)
    return response(
      { error: auth.code, connection_state: "HOLD" },
      auth.httpStatus,
    );
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
  } catch (error) {
    // An unknown tenant is a denial, not an excuse to expose campgrounds.
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "23503"
    )
      return response({ error: "TENANT_HOLD", connection_state: "HOLD" }, 403);
    return response(
      { error: "HANDSHAKE_RECEIPT_UNAVAILABLE", connection_state: "HOLD" },
      503,
    );
  }
  if (!firstUse)
    return response(
      { error: "REPLAY_REJECTED", connection_state: "HOLD" },
      409,
    );
  if (!auth.allowed)
    return response({ error: "TENANT_HOLD", connection_state: "HOLD" }, 403);

  const identity = {
    application_id: "icamp",
    application_version: config.applicationVersion,
    integration_contract: INTEGRATION_CONTRACT_VERSION,
    environment: config.environment,
    connection_state: "TESTING",
    checked_at: checkedAt.toISOString(),
    gateway_issuer: "ai-data-platform",
  };
  if (path.endsWith("/health"))
    return response(
      { ...identity, readiness: "authenticated_no_customer_data" },
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
