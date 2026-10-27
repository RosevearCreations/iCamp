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
const nonce = "e5555555-5555-4555-8555-555555555555";
const secret = Array.from({ length: 48 }, (_, i) =>
  String.fromCharCode(97 + (i % 26)),
).join("");
const config = loadIntegrationReadinessConfig({
  ICAMP_INTEGRATION_V1_ENABLED: "true",
  ICAMP_INTEGRATION_V1_KEY_ID: "gateway-test-key",
  ICAMP_INTEGRATION_V1_HMAC_SECRET: secret,
  ICAMP_INTEGRATION_V1_ALLOWED_CAMPGROUNDS: tenantA,
  NODE_ENV: "test",
});
function signedHeaders(
  path,
  tenantId = tenantA,
  timestamp = now.toISOString(),
) {
  const signature = createHmac("sha256", secret)
    .update(canonicalReadinessSignature({ path, timestamp, nonce, tenantId }))
    .digest("hex");
  return new Headers({
    "x-rosevear-issuer": "ai-data-platform",
    "x-rosevear-key-id": "gateway-test-key",
    "x-rosevear-timestamp": timestamp,
    "x-rosevear-nonce": nonce,
    "x-rosevear-tenant-id": tenantId,
    "x-rosevear-signature": `sha256=${signature}`,
  });
}

test("Integration Contract v1 stays disconnected without server-only configuration", () => {
  assert.equal(INTEGRATION_CONTRACT_VERSION, "rosevear.integration.v1");
  const absent = loadIntegrationReadinessConfig({});
  assert.equal(absent.enabled, false);
  assert.equal(
    verifySignedReadiness(
      new Headers(),
      "/api/integration/v1/health",
      absent,
      now,
    ).httpStatus,
    503,
  );
  assert.equal(
    loadIntegrationReadinessConfig({
      ICAMP_INTEGRATION_V1_ENABLED: "true",
      ICAMP_INTEGRATION_V1_HMAC_SECRET: "short",
    }).enabled,
    false,
  );
});

test("Signed health and capabilities require gateway identity, scoped tenant, and freshness", () => {
  for (const path of [
    "/api/integration/v1/health",
    "/api/integration/v1/capabilities",
  ]) {
    assert.deepEqual(
      verifySignedReadiness(signedHeaders(path), path, config, now),
      {
        ok: true,
        issuer: "ai-data-platform",
        keyId: "gateway-test-key",
        nonce,
        tenantId: tenantA,
        timestamp: now.toISOString(),
        allowed: true,
      },
    );
    const b = verifySignedReadiness(
      signedHeaders(path, tenantB),
      path,
      config,
      now,
    );
    assert.equal(b.ok, true);
    assert.equal(
      b.allowed,
      false,
      "Campground B cannot reuse the access granted to A",
    );
    const changedPath = verifySignedReadiness(
      signedHeaders(path),
      "/api/integration/v1/nonexistent",
      config,
      now,
    );
    assert.equal(changedPath.httpStatus, 404);
  }
});

test("Reject forged, expired, wrong-key and revoked gateway readiness requests", () => {
  const path = "/api/integration/v1/health";
  const forged = signedHeaders(path);
  forged.set("x-rosevear-tenant-id", tenantB);
  assert.equal(
    verifySignedReadiness(forged, path, config, now).httpStatus,
    401,
  );
  const wrongKey = signedHeaders(path);
  wrongKey.set("x-rosevear-key-id", "rotated-key");
  assert.equal(
    verifySignedReadiness(wrongKey, path, config, now).httpStatus,
    401,
  );
  assert.equal(
    verifySignedReadiness(
      signedHeaders(path, tenantA, "2026-10-27T16:40:00.000Z"),
      path,
      config,
      now,
    ).code,
    "EXPIRED_GATEWAY_SIGNATURE",
  );
  assert.equal(
    verifySignedReadiness(
      signedHeaders(path),
      path,
      { ...config, enabled: false },
      now,
    ).code,
    "INTEGRATION_HOLD",
  );
});

test("Durable nonce receipt, negative tenant hold and no live cross-app operations", () => {
  const sql = readFileSync(
    new URL(
      "../database/migrations/0164_independent_reopening_followup_replay_oversight.sql",
      import.meta.url,
    ),
    "utf8",
  );
  const route = readFileSync(
    new URL("../lib/integration-v1/route.ts", import.meta.url),
    "utf8",
  );
  const postgres = readFileSync(
    new URL("../lib/integration-v1/readiness-postgres.mjs", import.meta.url),
    "utf8",
  );
  for (const required of [
    "icamp_private.integration_handshake_receipts",
    "unique(issuer,key_id,nonce)",
    "force row level security",
    "winterization_append_only",
    "grant insert on icamp_private.integration_handshake_receipts to icamp_app",
  ])
    assert.ok(
      sql.includes(required),
      `Missing durable tenant-protected readiness receipt: ${required}`,
    );
  assert.ok(postgres.includes("on conflict(issuer,key_id,nonce) do nothing"));
  assert.ok(route.includes("REPLAY_REJECTED"));
  assert.ok(route.includes("TENANT_HOLD"));
  assert.ok(route.includes("capabilities: []"));
  assert.ok(route.includes("commands_enabled: false"));
  assert.ok(route.includes("events_enabled: false"));
});
