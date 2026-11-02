import { createHmac, timingSafeEqual } from "node:crypto";

import {
  MESSAGE_MMS_MAX_ATTACHMENTS,
  MESSAGE_TEXT_MAX_CHARS,
} from "./commands.mjs";

const SIGNATURE_PREFIX = "sha256=";
const DEFAULT_WEBHOOK_TOLERANCE_SECONDS = 300;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

function normalizedProviderKey(value) {
  const provider = String(value ?? "mock")
    .trim()
    .toLowerCase();

  if (!/^[a-z][a-z0-9_-]{1,63}$/u.test(provider)) {
    throw new Error("Messaging provider key is invalid.");
  }

  return provider;
}

function normalizedTolerance(value) {
  const parsed = Number(value ?? DEFAULT_WEBHOOK_TOLERANCE_SECONDS);

  if (!Number.isInteger(parsed) || parsed < 30 || parsed > 900) {
    throw new Error(
      "Messaging webhook tolerance must be between 30 and 900 seconds.",
    );
  }

  return parsed;
}

function hmacHex(secret, timestamp, rawBody) {
  return createHmac("sha256", secret)
    .update(String(timestamp))
    .update(".")
    .update(rawBody)
    .digest("hex");
}

function parseIsoDate(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Messaging provider event timestamp is invalid.");
  }

  return date.toISOString();
}

function shortToken(value, label, max = 240) {
  const token = String(value ?? "").trim();

  if (token.length < 1 || token.length > max) {
    throw new Error(label + " is invalid.");
  }

  return token;
}

function normalizedAddress(value) {
  const address = String(value ?? "").trim();

  if (!/^\+[1-9][0-9]{7,14}$/u.test(address)) {
    throw new Error("Messaging address must be normalized E.164.");
  }

  return address;
}

function normalizedAttachment(input) {
  const contentType = String(input?.contentType ?? "")
    .trim()
    .toLowerCase();
  const bytes = Number(input?.bytes);
  const mediaReference = shortToken(
    input?.mediaReference,
    "Provider media reference",
  );

  if (!/^image\/(jpeg|png|webp|gif)$/u.test(contentType)) {
    throw new Error("Unsupported MMS attachment type.");
  }

  if (!Number.isInteger(bytes) || bytes < 1 || bytes > MAX_IMAGE_BYTES) {
    throw new Error("MMS attachment size is invalid.");
  }

  return {
    mediaReference,
    contentType,
    bytes,
  };
}

export function getMessagingProviderConfig(env = process.env) {
  const provider = normalizedProviderKey(
    env.ICAMP_MESSAGING_PROVIDER ?? env.ICAMP_COMMUNICATIONS_PROVIDER ?? "mock",
  );

  return {
    provider,
    mode: provider === "mock" ? "sandbox" : "external",
    webhookSecret: env.ICAMP_MESSAGING_WEBHOOK_SECRET?.trim() || null,
    webhookToleranceSeconds: normalizedTolerance(
      env.ICAMP_MESSAGING_WEBHOOK_TOLERANCE_SECONDS,
    ),
  };
}

export function signMockMessagingWebhook({ rawBody, timestamp, secret }) {
  const normalizedSecret = String(secret ?? "");

  if (normalizedSecret.length < 16) {
    throw new Error(
      "Mock messaging webhook secret must be at least 16 characters.",
    );
  }

  return SIGNATURE_PREFIX + hmacHex(normalizedSecret, timestamp, rawBody);
}

export function verifyMessagingWebhookSignature({
  rawBody,
  timestamp,
  signature,
  secret,
  toleranceSeconds = DEFAULT_WEBHOOK_TOLERANCE_SECONDS,
  nowSeconds = Math.floor(Date.now() / 1000),
}) {
  const parsedTimestamp = Number(timestamp);
  const tolerance = normalizedTolerance(toleranceSeconds);
  const normalizedSecret = String(secret ?? "");

  if (
    !Number.isInteger(parsedTimestamp) ||
    normalizedSecret.length < 16 ||
    typeof signature !== "string" ||
    !signature.startsWith(SIGNATURE_PREFIX)
  ) {
    return false;
  }

  if (Math.abs(nowSeconds - parsedTimestamp) > tolerance) {
    return false;
  }

  const suppliedHex = signature.slice(SIGNATURE_PREFIX.length);

  if (!/^[0-9a-f]{64}$/iu.test(suppliedHex)) {
    return false;
  }

  const expected = Buffer.from(
    hmacHex(normalizedSecret, parsedTimestamp, rawBody),
    "hex",
  );
  const supplied = Buffer.from(suppliedHex, "hex");

  return (
    supplied.length === expected.length && timingSafeEqual(supplied, expected)
  );
}

export function normalizeMockMessagingWebhook(rawBody) {
  let payload;

  try {
    payload = JSON.parse(rawBody);
  } catch {
    throw new Error("Messaging webhook body must be valid JSON.");
  }

  const eventType = shortToken(payload.eventType, "Event type", 80);

  if (
    ![
      "message.received",
      "message.sent",
      "message.delivered",
      "message.read",
      "message.failed",
    ].includes(eventType)
  ) {
    throw new Error("Unsupported messaging webhook event type.");
  }

  const direction = eventType === "message.received" ? "inbound" : "outbound";
  const channel = payload.channel === "mms" ? "mms" : "sms";
  const attachments = Array.isArray(payload.attachments)
    ? payload.attachments.map(normalizedAttachment)
    : [];

  if (attachments.length > MESSAGE_MMS_MAX_ATTACHMENTS) {
    throw new Error("Too many MMS attachments.");
  }

  if (channel === "sms" && attachments.length > 0) {
    throw new Error("SMS provider event cannot include MMS attachments.");
  }

  const text = payload.text == null ? "" : String(payload.text).trim();

  if (
    eventType === "message.received" &&
    (text.length < 1 || text.length > MESSAGE_TEXT_MAX_CHARS)
  ) {
    throw new Error("Inbound messaging text length is invalid.");
  }

  return {
    providerKey: "mock",
    providerEventId: shortToken(payload.eventId, "Provider event ID"),
    providerMessageReference: shortToken(
      payload.messageReference,
      "Provider message reference",
    ),
    providerNumberReference: shortToken(
      payload.numberReference,
      "Provider number reference",
    ),
    remoteAddress:
      eventType === "message.received"
        ? normalizedAddress(payload.from)
        : payload.to
          ? normalizedAddress(payload.to)
          : null,
    eventType,
    eventStatus: shortToken(
      payload.eventStatus ?? eventType,
      "Provider event status",
      120,
    ),
    direction,
    channel,
    text,
    attachments,
    occurredAt: parseIsoDate(payload.occurredAt),
    sandbox: true,
  };
}

export function createMockMessagingProvider({ providerKey = "mock" } = {}) {
  const key = normalizedProviderKey(providerKey);

  return Object.freeze({
    providerKey: key,
    mode: "sandbox",

    async sendMessage({
      dispatchId,
      destination,
      text,
      mediaReferences = [],
      idempotencyKey,
    }) {
      if (!dispatchId || !destination || !idempotencyKey) {
        throw new Error("Outbound messaging input is incomplete.");
      }

      normalizedAddress(destination);

      const normalizedText = String(text ?? "").trim();
      if (
        normalizedText.length < 1 ||
        normalizedText.length > MESSAGE_TEXT_MAX_CHARS
      ) {
        throw new Error("Outbound messaging text length is invalid.");
      }

      if (
        !Array.isArray(mediaReferences) ||
        mediaReferences.length > MESSAGE_MMS_MAX_ATTACHMENTS
      ) {
        throw new Error("Outbound MMS attachment list is invalid.");
      }

      return {
        providerMessageReference: "mock-message:" + dispatchId,
        providerReference: "mock-attempt:" + dispatchId,
        state: "accepted",
      };
    },

    normalizeWebhook(rawBody) {
      return normalizeMockMessagingWebhook(rawBody);
    },
  });
}

export function createMessagingProviderAdapter(
  config = getMessagingProviderConfig(),
) {
  if (config.provider === "mock") {
    return createMockMessagingProvider();
  }

  throw new Error(
    "The configured external messaging provider adapter is not installed.",
  );
}
