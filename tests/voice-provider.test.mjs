import assert from "node:assert/strict";
import test from "node:test";

import {
  createMockVoiceProvider,
  getVoiceProviderConfig,
  normalizeMockVoiceWebhook,
  signMockVoiceWebhook,
  verifyVoiceWebhookSignature,
} from "../lib/voice/provider.mjs";

test("Build 010 verifies signed voice webhooks and rejects replay/tampering", () => {
  const rawBody = JSON.stringify({
    eventId: "evt-voice-1",
    eventType: "call.initiated",
    eventStatus: "ringing",
    callReference: "call-voice-1",
    numberReference: "mock-number-1001",
    direction: "inbound",
    occurredAt: "2026-10-06T18:00:00.000Z",
  });
  const secret = "build010-test-webhook-secret";
  const timestamp = 1791324000;
  const signature = signMockVoiceWebhook({
    rawBody,
    timestamp,
    secret,
  });

  assert.equal(
    verifyVoiceWebhookSignature({
      rawBody,
      timestamp,
      signature,
      secret,
      nowSeconds: timestamp + 20,
    }),
    true,
  );

  assert.equal(
    verifyVoiceWebhookSignature({
      rawBody: rawBody + " ",
      timestamp,
      signature,
      secret,
      nowSeconds: timestamp + 20,
    }),
    false,
  );

  assert.equal(
    verifyVoiceWebhookSignature({
      rawBody,
      timestamp,
      signature,
      secret,
      nowSeconds: timestamp + 301,
    }),
    false,
  );
});

test("Build 010 normalizes mock provider events without exposing raw bodies", () => {
  const event = normalizeMockVoiceWebhook(
    JSON.stringify({
      eventId: "evt-voice-2",
      eventType: "call.answered",
      eventStatus: "answered",
      callReference: "call-voice-2",
      numberReference: "mock-number-1002",
      direction: "outbound",
      occurredAt: "2026-10-06T18:01:00.000Z",
    }),
  );

  assert.equal(event.providerKey, "mock");
  assert.equal(event.eventType, "call.answered");
  assert.equal(event.direction, "outbound");
  assert.equal(event.sandbox, true);
  assert.equal(Object.hasOwn(event, "rawBody"), false);
});

test("Build 010 mock voice provider supports outbound and transfer sandbox flows", async () => {
  const provider = createMockVoiceProvider();

  const placed = await provider.placeCall({
    dispatchId: "11111111-1111-4111-8111-111111111111",
    providerNumberReference: "mock-number-1001",
    destination: "+15555551003",
    idempotencyKey: "build010-place-call",
  });

  assert.equal(placed.state, "accepted");
  assert.match(placed.providerCallReference, /^mock-call:/);

  const transfer = await provider.transferCall({
    providerCallReference: placed.providerCallReference,
    destination: "+15555551002",
  });

  assert.equal(transfer.state, "accepted");
  assert.match(transfer.providerReference, /^mock-transfer:/);
});

test("Build 010 voice config defaults to sandbox and bounds webhook tolerance", () => {
  assert.deepEqual(getVoiceProviderConfig({}), {
    provider: "mock",
    mode: "sandbox",
    webhookSecret: null,
    webhookToleranceSeconds: 300,
  });

  assert.throws(
    () =>
      getVoiceProviderConfig({
        ICAMP_VOICE_WEBHOOK_TOLERANCE_SECONDS: "10",
      }),
    /between 30 and 900 seconds/,
  );
});
