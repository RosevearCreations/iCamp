import { createHmac, timingSafeEqual } from "node:crypto";

import { normalizeDtmfProviderInput } from "./dtmf.mjs";

const SIGNATURE_PREFIX = "sha256=";
const DEFAULT_WEBHOOK_TOLERANCE_SECONDS = 300;

function normalizedProviderKey(value) {
  const provider = String(value ?? "mock")
    .trim()
    .toLowerCase();

  if (!/^[a-z][a-z0-9_-]{1,63}$/u.test(provider)) {
    throw new Error("Voice provider key is invalid.");
  }

  return provider;
}

function normalizedTolerance(value) {
  const parsed = Number(value ?? DEFAULT_WEBHOOK_TOLERANCE_SECONDS);

  if (!Number.isInteger(parsed) || parsed < 30 || parsed > 900) {
    throw new Error(
      "Voice webhook tolerance must be between 30 and 900 seconds.",
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

export function getVoiceProviderConfig(env = process.env) {
  const provider = normalizedProviderKey(
    env.ICAMP_VOICE_PROVIDER ?? env.ICAMP_COMMUNICATIONS_PROVIDER ?? "mock",
  );

  return {
    provider,
    mode: provider === "mock" ? "sandbox" : "external",
    webhookSecret: env.ICAMP_VOICE_WEBHOOK_SECRET?.trim() || null,
    webhookToleranceSeconds: normalizedTolerance(
      env.ICAMP_VOICE_WEBHOOK_TOLERANCE_SECONDS,
    ),
  };
}

export function signMockVoiceWebhook({ rawBody, timestamp, secret }) {
  const normalizedSecret = String(secret ?? "");

  if (normalizedSecret.length < 16) {
    throw new Error(
      "Mock voice webhook secret must be at least 16 characters.",
    );
  }

  return SIGNATURE_PREFIX + hmacHex(normalizedSecret, timestamp, rawBody);
}

export function verifyVoiceWebhookSignature({
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

function parseIsoDate(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Voice provider event timestamp is invalid.");
  }

  return date.toISOString();
}

function assertShortToken(value, label, max = 240) {
  const normalized = String(value ?? "").trim();

  if (normalized.length < 1 || normalized.length > max) {
    throw new Error(label + " is invalid.");
  }

  return normalized;
}

export function normalizeMockVoiceWebhook(rawBody) {
  let payload;

  try {
    payload = JSON.parse(rawBody);
  } catch {
    throw new Error("Voice webhook body must be valid JSON.");
  }

  const eventType = assertShortToken(payload.eventType, "Event type", 80);

  if (
    ![
      "call.initiated",
      "call.ringing",
      "call.answered",
      "call.completed",
      "call.failed",
      "dtmf.input",
      "dtmf.timeout",
    ].includes(eventType)
  ) {
    throw new Error("Unsupported voice webhook event type.");
  }

  const direction = payload.direction === "outbound" ? "outbound" : "inbound";
  const dtmf = eventType.startsWith("dtmf.")
    ? normalizeDtmfProviderInput({
        eventType,
        inputKind: payload.inputKind ?? "menu",
        digits: payload.digits ?? null,
      })
    : null;

  return {
    providerKey: "mock",
    providerEventId: assertShortToken(payload.eventId, "Provider event ID"),
    providerCallReference: assertShortToken(
      payload.callReference,
      "Provider call reference",
    ),
    providerNumberReference: assertShortToken(
      payload.numberReference,
      "Provider number reference",
    ),
    eventType,
    eventStatus: eventType.startsWith("dtmf.")
      ? eventType
      : assertShortToken(
          payload.eventStatus ?? eventType,
          "Provider event status",
          120,
        ),
    direction,
    occurredAt: parseIsoDate(payload.occurredAt),
    sandbox: true,
    dtmf,
  };
}

export function createMockVoiceProvider({ providerKey = "mock" } = {}) {
  const key = normalizedProviderKey(providerKey);

  return Object.freeze({
    providerKey: key,
    mode: "sandbox",

    async placeCall({
      dispatchId,
      providerNumberReference,
      destination,
      idempotencyKey,
    }) {
      if (
        !dispatchId ||
        !providerNumberReference ||
        !destination ||
        !idempotencyKey
      ) {
        throw new Error("Outbound voice call input is incomplete.");
      }

      return {
        providerCallReference: "mock-call:" + dispatchId,
        providerReference: "mock-attempt:" + dispatchId,
        state: "accepted",
      };
    },

    async transferCall({ providerCallReference, destination }) {
      if (!providerCallReference || !destination) {
        throw new Error("Voice transfer input is incomplete.");
      }

      return {
        state: "accepted",
        providerReference: "mock-transfer:" + providerCallReference,
      };
    },

    normalizeWebhook(rawBody) {
      return normalizeMockVoiceWebhook(rawBody);
    },
  });
}

export function createVoiceProviderAdapter(config = getVoiceProviderConfig()) {
  if (config.provider === "mock") {
    return createMockVoiceProvider();
  }

  throw new Error(
    "The configured external voice provider adapter is not installed.",
  );
}
