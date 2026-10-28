import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  INTEGRATION_CONTRACT_VERSION,
  loadIntegrationReadinessConfig,
  canonicalReadinessSignature,
  verifySignedReadiness,
} from "../lib/integration-v1/readiness.mjs";

const now = new Date("2026-10-27T17:00:00.000Z");
const tenantA = "c3333333-3333-4333-8333-333333333333";
const tenantB = "d4444444-4444-4444-8444-444444444444";
const nonce = `np-${"a".repeat(32)}`;
const secret = Buffer.alloc(32, 37);
const keyId = "icamp-np-tenant-a-key";
const config = loadIntegrationReadinessConfig({
  ICAMP_INTEGRATION_V1_ENABLED: "true",
  ICAMP_INTEGRATION_V1_ENVIRONMENT: "nonproduction",
  ICAMP_INTEGRATION_V1_KEY_ID: keyId,
  ICAMP_INTEGRATION_V1_TENANT_ID: tenantA,
  ICAMP_INTEGRATION_V1_HMAC_KEY_B64: secret.toString("base64"),
  VERCEL_ENV: "preview",
});
function signedHeaders(
  path,
  tenantId = tenantA,
  timestamp = String(now.getTime()),
) {
  const signature = createHmac("sha256", secret)
    .update(
      canonicalReadinessSignature({ path, timestamp, nonce, tenantId, keyId }),
    )
    .digest("base64url");
  return new Headers({
    "x-rosevear-contract": INTEGRATION_CONTRACT_VERSION,
    "x-rosevear-environment": "nonproduction",
    "x-rosevear-source": "ai-data-platform",
    "x-rosevear-destination": "icamp",
    "x-rosevear-business": "icamp",
    "x-rosevear-tenant": tenantId,
    "x-rosevear-key-id": keyId,
    "x-rosevear-timestamp": timestamp,
    "x-rosevear-nonce": nonce,
    "x-rosevear-signature": signature,
  });
}

test("QL-243 format matches exact 12-line UTF-8 GET canonical and excludes old format", () => {
  assert.equal(
    canonicalReadinessSignature({
      path: "/api/integration/v1/health",
      timestamp: String(now.getTime()),
      nonce,
      tenantId: tenantA,
      keyId,
    }).split("\n").length,
    12,
  );
  assert.equal(
    canonicalReadinessSignature({
      path: "/api/integration/v1/health",
      timestamp: String(now.getTime()),
      nonce,
      tenantId: tenantA,
      keyId,
    }).split("\n")[10],
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  );
  assert.equal(
    verifySignedReadiness(
      new Headers({ "x-rosevear-issuer": "ai-data-platform" }),
      "/api/integration/v1/health",
      config,
      now,
    ).httpStatus,
    401,
  );
});

test("Integration stays HOLD and will not activate on production hosting", () => {
  assert.equal(loadIntegrationReadinessConfig({}).enabled, false);
  assert.equal(config.enabled, true);
  assert.equal(
    loadIntegrationReadinessConfig({
      ICAMP_INTEGRATION_V1_ENABLED: "true",
      ICAMP_INTEGRATION_V1_ENVIRONMENT: "nonproduction",
      ICAMP_INTEGRATION_V1_KEY_ID: keyId,
      ICAMP_INTEGRATION_V1_TENANT_ID: tenantA,
      ICAMP_INTEGRATION_V1_HMAC_KEY_B64: secret.toString("base64"),
      VERCEL_ENV: "production",
    }).enabled,
    false,
  );
  assert.equal(
    verifySignedReadiness(
      new Headers(),
      "/api/integration/v1/health",
      loadIntegrationReadinessConfig({}),
      now,
    ).code,
    "INTEGRATION_HOLD",
  );
});

test("QL-243 signed GET authenticates exact app and isolated nonproduction campground", () => {
  for (const path of [
    "/api/integration/v1/health",
    "/api/integration/v1/capabilities",
  ]) {
    assert.deepEqual(
      verifySignedReadiness(signedHeaders(path), path, config, now),
      {
        ok: true,
        issuer: "ai-data-platform",
        destination: "icamp",
        business: "icamp",
        environment: "nonproduction",
        keyId,
        tenantId: tenantA,
        nonce,
        timestamp: String(now.getTime()),
        allowed: true,
      },
    );
    const wrongTenant = verifySignedReadiness(
      signedHeaders(path, tenantB),
      path,
      config,
      now,
    );
    assert.equal(wrongTenant.ok, true);
    assert.equal(wrongTenant.allowed, false);
    const forgedTenant = signedHeaders(path);
    forgedTenant.set("x-rosevear-tenant", tenantB);
    assert.equal(
      verifySignedReadiness(forgedTenant, path, config, now).code,
      "INVALID_GATEWAY_SIGNATURE",
    );
    const wrongScope = signedHeaders(path);
    wrongScope.set("x-rosevear-business", "devilndove");
    assert.equal(
      verifySignedReadiness(wrongScope, path, config, now).code,
      "INVALID_GATEWAY_IDENTITY",
    );
    const wrongEnv = signedHeaders(path);
    wrongEnv.set("x-rosevear-environment", "production");
    assert.equal(
      verifySignedReadiness(wrongEnv, path, config, now).httpStatus,
      401,
    );
  }
});

test("QL-243 signature, stale time, rotation, source, method and query denials", () => {
  const path = "/api/integration/v1/health";
  const rotated = signedHeaders(path);
  rotated.set("x-rosevear-key-id", "revoked-key");
  assert.equal(
    verifySignedReadiness(rotated, path, config, now).code,
    "INVALID_GATEWAY_IDENTITY",
  );
  assert.equal(
    verifySignedReadiness(
      signedHeaders(path, tenantA, String(now.getTime() - 301000)),
      path,
      config,
      now,
    ).code,
    "EXPIRED_GATEWAY_SIGNATURE",
  );
  const forged = signedHeaders(path);
  forged.set("x-rosevear-signature", "x".repeat(43));
  assert.equal(
    verifySignedReadiness(forged, path, config, now).code,
    "INVALID_GATEWAY_SIGNATURE",
  );
  const alteredSource = signedHeaders(path);
  alteredSource.set("x-rosevear-source", "rosevear-comms-hub");
  assert.equal(
    verifySignedReadiness(alteredSource, path, config, now).code,
    "INVALID_GATEWAY_IDENTITY",
  );
  const route = readFileSync(
    new URL("../lib/integration-v1/route.ts", import.meta.url),
    "utf8",
  );
  for (const assertion of [
    "QUERY_NOT_ALLOWED",
    "METHOD_NOT_ALLOWED",
    "REPLAY_REJECTED",
    "TENANT_HOLD",
    'connection_state: "HOLD"',
    "capabilities: []",
    "commands_enabled: false",
    "events_enabled: false",
  ])
    assert.ok(
      route.includes(assertion),
      `Missing gateway protection ${assertion}`,
    );
});

test("QL-243 has private durable atomic replay and sanitized denial receipts", () => {
  const sql = readFileSync(
    new URL(
      "../database/migrations/0169_continuity_evidence_recurrence_owner_reconciliation.sql",
      import.meta.url,
    ),
    "utf8",
  );
  const postgres = readFileSync(
    new URL("../lib/integration-v1/readiness-postgres.mjs", import.meta.url),
    "utf8",
  );
  for (const required of [
    "icamp_private.integration_ql243_request_receipts",
    "icamp_private.integration_ql243_denial_receipts",
    "unique(source_system,business_id,campground_id,key_id,nonce)",
    "force row level security",
    "winterization_append_only",
  ])
    assert.ok(
      sql.includes(required),
      `Missing QL-243 durable protection ${required}`,
    );
  assert.ok(
    postgres.includes(
      "on conflict(source_system,business_id,campground_id,key_id,nonce) do nothing",
    ),
  );
  assert.ok(postgres.includes("recordReadinessDenial"));
});
