import assert from "node:assert/strict";
import test from "node:test";

import {
  parseMessagingCommand,
  summarizeMessageForTelemetry,
  validateMessagingCommand,
} from "../lib/messaging/commands.mjs";
import {
  createMockMessagingProvider,
  normalizeMockMessagingWebhook,
  signMockMessagingWebhook,
  verifyMessagingWebhookSignature,
} from "../lib/messaging/provider.mjs";

test("Build 012 routes numbered menus and keywords without privileged side effects", () => {
  assert.deepEqual(parseMessagingCommand("1"), {
    kind: "menu.site",
    action: "prompt.site",
    source: "numbered",
    value: null,
    status: "parsed",
    requiresValidation: false,
  });

  assert.equal(parseMessagingCommand("help").kind, "help");
  assert.equal(parseMessagingCommand("staff").action, "transfer.staff");
  assert.equal(
    validateMessagingCommand(parseMessagingCommand("2")).accepted,
    true,
  );
});

test("Build 012 structured lookup commands require identity verification", () => {
  const command = parseMessagingCommand("RESERVATION 123456");
  const validation = validateMessagingCommand(command);

  assert.equal(command.kind, "lookup.reservation");
  assert.equal(command.value, "123456");
  assert.equal(command.source, "structured");
  assert.equal(validation.accepted, false);
  assert.equal(validation.state, "verification_required");
});

test("Build 012 natural-language intent can propose but cannot execute commands", () => {
  const command = parseMessagingCommand(
    "Can you check my site number 42 please?",
  );
  const validation = validateMessagingCommand(command);

  assert.equal(command.kind, "lookup.site");
  assert.equal(command.source, "natural_language");
  assert.equal(command.status, "proposed");
  assert.equal(validation.accepted, false);
  assert.equal(validation.state, "validation_required");
});

test("Build 012 telemetry summary excludes message text", () => {
  const command = parseMessagingCommand("PASS 55");
  const summary = summarizeMessageForTelemetry({
    text: "PASS 55",
    attachmentCount: 1,
    command,
  });

  assert.deepEqual(summary, {
    textLength: 7,
    attachmentCount: 1,
    commandKind: "lookup.pass",
    commandSource: "structured",
    rawTextExcluded: true,
  });
  assert.equal(Object.hasOwn(summary, "text"), false);
});

test("Build 012 verifies signed messaging webhooks with bounded freshness", () => {
  const rawBody = JSON.stringify({
    eventType: "message.received",
    eventId: "event-1",
    messageReference: "message-1",
    numberReference: "mock-number-1",
    from: "+15555551234",
    text: "HELP",
    occurredAt: "2026-10-07T12:00:00.000Z",
  });
  const secret = "build012-test-secret";
  const timestamp = 1791374400;
  const signature = signMockMessagingWebhook({
    rawBody,
    timestamp,
    secret,
  });

  assert.equal(
    verifyMessagingWebhookSignature({
      rawBody,
      timestamp,
      signature,
      secret,
      nowSeconds: timestamp,
    }),
    true,
  );
  assert.equal(
    verifyMessagingWebhookSignature({
      rawBody,
      timestamp,
      signature,
      secret,
      nowSeconds: timestamp + 301,
    }),
    false,
  );
});

test("Build 012 normalizes MMS photos without provider URLs or payloads", () => {
  const event = normalizeMockMessagingWebhook(
    JSON.stringify({
      eventType: "message.received",
      eventId: "event-mms-1",
      messageReference: "message-mms-1",
      numberReference: "mock-number-1",
      from: "+15555551234",
      channel: "mms",
      text: "HELP",
      attachments: [
        {
          mediaReference: "media-1",
          contentType: "image/jpeg",
          bytes: 4096,
        },
      ],
      occurredAt: "2026-10-07T12:00:00.000Z",
    }),
  );

  assert.equal(event.channel, "mms");
  assert.equal(event.attachments.length, 1);
  assert.deepEqual(event.attachments[0], {
    mediaReference: "media-1",
    contentType: "image/jpeg",
    bytes: 4096,
  });
  assert.equal(Object.hasOwn(event.attachments[0], "url"), false);
});

test("Build 012 mock provider sends SMS/MMS through a replaceable adapter", async () => {
  const provider = createMockMessagingProvider();
  const result = await provider.sendMessage({
    dispatchId: "11111111-1111-4111-8111-111111111111",
    destination: "+15555551234",
    text: "Your reservation is ready.",
    idempotencyKey: "build012-provider-test",
  });

  assert.equal(provider.providerKey, "mock");
  assert.equal(provider.mode, "sandbox");
  assert.equal(result.state, "accepted");
  assert.match(result.providerMessageReference, /^mock-message:/u);
});
