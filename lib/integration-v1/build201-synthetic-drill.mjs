import { createHmac, randomBytes, randomUUID } from "node:crypto";

import {
  INTEGRATION_CONTRACT_VERSION,
  canonicalReadinessSignature,
  loadIntegrationReadinessConfig,
  verifySignedReadiness,
} from "./readiness.mjs";

const HEALTH = "/api/integration/v1/health";

/** Isolated fixture only: ai-data-platform legacy endpoint, NOT the Comms Hub peer. */
export function runBuild201SyntheticHandshake() {
  const isolatedTenant = randomUUID();
  const keyId = "build201-fixture-key";
  const secret = randomBytes(32);
  const config = loadIntegrationReadinessConfig({
    NODE_ENV: "test",
    VERCEL_ENV: "",
    ICAMP_INTEGRATION_V1_ENABLED: "true",
    ICAMP_INTEGRATION_V1_ENVIRONMENT: "nonproduction",
    ICAMP_INTEGRATION_V1_KEY_ID: keyId,
    ICAMP_INTEGRATION_V1_TENANT_ID: isolatedTenant,
    ICAMP_INTEGRATION_V1_HMAC_KEY_B64: secret.toString("base64"),
  });
  if (!config.enabled) throw new Error("Fixture gateway disabled unexpectedly");
  const timestamp = String(Date.now());
  const nonce = `np-${randomBytes(16).toString("hex")}`;
  const headersFor = (tenantId) => {
    const signature = createHmac("sha256", config.secret)
      .update(
        canonicalReadinessSignature({
          path: HEALTH,
          timestamp,
          nonce,
          tenantId,
          keyId,
        }),
      )
      .digest("base64url");
    return new Headers({
      "x-rosevear-contract": INTEGRATION_CONTRACT_VERSION,
      "x-rosevear-environment": "nonproduction",
      "x-rosevear-source": "ai-data-platform",
      "x-rosevear-destination": "icamp",
      "x-rosevear-business": "icamp",
      "x-rosevear-key-id": keyId,
      "x-rosevear-timestamp": timestamp,
      "x-rosevear-nonce": nonce,
      "x-rosevear-tenant": tenantId,
      "x-rosevear-signature": signature,
    });
  };
  const accepted = verifySignedReadiness(
    headersFor(isolatedTenant),
    HEALTH,
    config,
  );
  const crossTenant = verifySignedReadiness(
    headersFor(randomUUID()),
    HEALTH,
    config,
  );
  const forgedIssuerHeaders = headersFor(isolatedTenant);
  forgedIssuerHeaders.set("x-rosevear-source", "rosevear-comms-hub");
  const wrongIssuer = verifySignedReadiness(
    forgedIssuerHeaders,
    HEALTH,
    config,
  );
  const tamperedHeaders = headersFor(isolatedTenant);
  tamperedHeaders.set(
    "x-rosevear-signature",
    randomBytes(32).toString("base64url"),
  );
  const tampered = verifySignedReadiness(tamperedHeaders, HEALTH, config);
  const expired = verifySignedReadiness(
    headersFor(isolatedTenant),
    HEALTH,
    config,
    new Date(Number(timestamp) + 300_001),
  );
  const productionDisabled = loadIntegrationReadinessConfig({
    NODE_ENV: "production",
    VERCEL_ENV: "production",
    ICAMP_INTEGRATION_V1_ENABLED: "true",
    ICAMP_INTEGRATION_V1_ENVIRONMENT: "nonproduction",
    ICAMP_INTEGRATION_V1_KEY_ID: keyId,
    ICAMP_INTEGRATION_V1_TENANT_ID: isolatedTenant,
    ICAMP_INTEGRATION_V1_HMAC_KEY_B64: secret.toString("base64"),
  });
  if (
    !accepted.ok ||
    !accepted.allowed ||
    !crossTenant.ok ||
    crossTenant.allowed ||
    wrongIssuer.ok ||
    tampered.ok ||
    expired.ok ||
    productionDisabled.enabled
  )
    throw new Error("Legacy isolated fixture security invariant failed");

  return Object.freeze({
    schema: "icamp.build201.local-synthetic-nonproduction-drill.v1",
    fixture_only: true,
    actual_comms_hub_signed_handshake: "NOT_ATTEMPTED",
    source_issuer: "ai-data-platform_TEST_FIXTURE_NOT_HUB",
    isolated_test_signature: "PASS",
    cross_tenant_denial: "PASS",
    wrong_issuer_denial: "PASS",
    signature_tamper_denial: "PASS",
    signature_expiry_denial: "PASS",
    production_enablement_denial: "PASS",
    replay_database_receipt: "NOT_TESTED_DB_REQUIRED",
    external_witness: "MISSING",
    live_connection: "DISCONNECTED / HOLD",
    external_requests: false,
    external_writes: false,
  });
}
