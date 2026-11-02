import assert from "node:assert/strict";
import test from "node:test";

import {
  COMMUNICATION_CHANNELS,
  COMMUNICATION_PURPOSES,
  createMockCommunicationsProvider,
  getCommunicationsProviderConfig,
} from "../lib/communications/provider.mjs";
import { communicationRetryDelaySeconds } from "../lib/communications/postgres.mjs";

test("Build 009 defines one channel and purpose vocabulary", () => {
  assert.deepEqual(COMMUNICATION_CHANNELS, [
    "web",
    "voice",
    "dtmf",
    "speech",
    "sms",
    "mms",
    "email",
    "push",
  ]);

  assert.deepEqual(COMMUNICATION_PURPOSES, [
    "transactional",
    "operational",
    "marketing",
  ]);
});

test("Build 009 mock provider is replaceable and content-neutral", async () => {
  const provider = createMockCommunicationsProvider();

  const result = await provider.dispatch({
    dispatchId: "11111111-1111-4111-8111-111111111111",
    channel: "email",
    purpose: "transactional",
    endpointHint: "email ending example.test",
    idempotencyKey: "build009-provider-test",
  });

  assert.equal(provider.providerKey, "mock");
  assert.equal(result.state, "accepted");
  assert.match(result.providerReference, /^mock:email:/);
});

test("Build 009 defaults to free mock mode and bounds retry backoff", () => {
  assert.deepEqual(getCommunicationsProviderConfig({}), {
    provider: "mock",
    mode: "mock",
  });

  assert.equal(communicationRetryDelaySeconds(1, 30), 30);
  assert.equal(communicationRetryDelaySeconds(4, 30), 240);
  assert.equal(communicationRetryDelaySeconds(20, 30), 3600);
});
