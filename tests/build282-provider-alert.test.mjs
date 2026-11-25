import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import {
  recoveryReasons282,
  verifyAlertDelivery282,
} from "../lib/build282/core.mjs";

test("unverified database is not classified as owner compromise", () => {
  assert.deepEqual(recoveryReasons282({}), ["ORIGINAL_DATABASE_NOT_VERIFIED"]);
});

test("stale owner and provider evidence produce independent HOLD reasons", () => {
  assert.deepEqual(
    recoveryReasons282({
      admission: { adopted: true, host: { pinned: true } },
      monitoring: {},
      sourceCount: 0,
    }),
    [
      "OWNER_RECOVERY_CONTINUITY_HOLD",
      "PROVIDER_ACK_FRESHNESS_HOLD",
      "SOURCE_CONTINUITY_HOLD",
      "INDEPENDENT_MONITOR_HOLD",
    ],
  );
});

test("test-only delivery receipt rejects tampering and expired signatures", () => {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const now = Date.now();
  const key = {
    providerId: "provider-test",
    keyId: "test-key-id",
    publicKeyPem: publicKey.export({ type: "spki", format: "pem" }),
    fingerprint: createHash("sha256")
      .update(publicKey.export({ type: "spki", format: "der" }))
      .digest("hex"),
  };
  const incident = {
    id: "12345678-1234-4234-8234-123456789abc",
    ackDigest: "a".repeat(64),
    openedAt: new Date(now - 1000).toISOString(),
  };
  const body = JSON.stringify({
    kind: "icamp-original-provider-alert-delivery-v1",
    alertId: incident.id,
    priorAckDigest: incident.ackDigest,
    providerId: key.providerId,
    keyId: key.keyId,
    eventId: "test-event-123456789",
    deliveredAt: new Date(now).toISOString(),
  });
  const signature = sign(null, Buffer.from(body), privateKey).toString(
    "base64url",
  );
  assert.equal(
    verifyAlertDelivery282({ body, signature, incident, key, now }).alertId,
    incident.id,
  );
  assert.throws(() =>
    verifyAlertDelivery282({
      body: body.replace("test-event", "fake-event"),
      signature,
      incident,
      key,
      now,
    }),
  );
  assert.throws(() =>
    verifyAlertDelivery282({
      body,
      signature,
      incident,
      key,
      now: now + 300001,
    }),
  );
});
