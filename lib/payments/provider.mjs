import { createHmac, timingSafeEqual } from "node:crypto";

const SIGNATURE_PREFIX = "sha256=";
const DEFAULT_WEBHOOK_TOLERANCE_SECONDS = 300;

function providerKey(value) {
  const normalized = String(value ?? "mock")
    .trim()
    .toLowerCase();
  if (!/^[a-z][a-z0-9_-]{1,63}$/u.test(normalized)) {
    throw new Error("Payment provider key is invalid.");
  }
  return normalized;
}

function toleranceSeconds(value) {
  const parsed = Number(value ?? DEFAULT_WEBHOOK_TOLERANCE_SECONDS);
  if (!Number.isInteger(parsed) || parsed < 30 || parsed > 900) {
    throw new Error(
      "Payment webhook tolerance must be between 30 and 900 seconds.",
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

function shortToken(value, label, max = 240) {
  const normalized = String(value ?? "").trim();
  if (normalized.length < 1 || normalized.length > max) {
    throw new Error(label + " is invalid.");
  }
  return normalized;
}

function amountCents(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 200_000_000) {
    throw new Error("Payment amount is invalid.");
  }
  return parsed;
}

function currencyCode(value) {
  const normalized = String(value ?? "")
    .trim()
    .toUpperCase();
  if (!/^[A-Z]{3}$/u.test(normalized)) {
    throw new Error("Payment currency is invalid.");
  }
  return normalized;
}

function isoTimestamp(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Payment provider event timestamp is invalid.");
  }
  return parsed.toISOString();
}

export function getPaymentProviderConfig(env = process.env) {
  const provider = providerKey(env.ICAMP_PAYMENT_PROVIDER ?? "mock");
  return {
    provider,
    mode: provider === "mock" ? "sandbox" : "external",
    webhookSecret: env.ICAMP_PAYMENT_WEBHOOK_SECRET?.trim() || null,
    webhookToleranceSeconds: toleranceSeconds(
      env.ICAMP_PAYMENT_WEBHOOK_TOLERANCE_SECONDS,
    ),
  };
}

export function signMockPaymentWebhook({ rawBody, timestamp, secret }) {
  const normalizedSecret = String(secret ?? "");
  if (normalizedSecret.length < 16) {
    throw new Error(
      "Mock payment webhook secret must be at least 16 characters.",
    );
  }
  return SIGNATURE_PREFIX + hmacHex(normalizedSecret, timestamp, rawBody);
}

export function verifyPaymentWebhookSignature({
  rawBody,
  timestamp,
  signature,
  secret,
  toleranceSeconds: tolerance = DEFAULT_WEBHOOK_TOLERANCE_SECONDS,
  nowSeconds = Math.floor(Date.now() / 1000),
}) {
  const parsedTimestamp = Number(timestamp);
  const normalizedSecret = String(secret ?? "");
  const normalizedTolerance = toleranceSeconds(tolerance);

  if (
    !Number.isInteger(parsedTimestamp) ||
    normalizedSecret.length < 16 ||
    typeof signature !== "string" ||
    !signature.startsWith(SIGNATURE_PREFIX)
  ) {
    return false;
  }

  if (Math.abs(nowSeconds - parsedTimestamp) > normalizedTolerance) {
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

export function normalizeMockPaymentWebhook(rawBody) {
  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    throw new Error("Payment webhook body must be valid JSON.");
  }

  const eventType = shortToken(payload.eventType, "Event type", 80);
  if (
    ![
      "payment.authorized",
      "payment.captured",
      "payment.failed",
      "payment.cancelled",
    ].includes(eventType)
  ) {
    throw new Error("Unsupported payment webhook event type.");
  }

  return {
    providerKey: "mock",
    providerEventId: shortToken(payload.eventId, "Provider event ID"),
    providerPaymentReference: shortToken(
      payload.paymentReference,
      "Provider payment reference",
    ),
    eventType,
    eventStatus: shortToken(
      payload.eventStatus ?? eventType,
      "Payment event status",
      120,
    ),
    amountCents: amountCents(payload.amountCents),
    currencyCode: currencyCode(payload.currencyCode),
    occurredAt: isoTimestamp(payload.occurredAt),
    sandbox: true,
  };
}

export function createMockPaymentProvider({ key = "mock" } = {}) {
  const normalizedKey = providerKey(key);

  return Object.freeze({
    providerKey: normalizedKey,
    mode: "sandbox",

    async createPayment({
      paymentId,
      amountCents: requestedAmount,
      currencyCode: requestedCurrency,
      idempotencyKey,
    }) {
      if (!paymentId || !idempotencyKey) {
        throw new Error("Sandbox payment input is incomplete.");
      }
      amountCents(requestedAmount);
      currencyCode(requestedCurrency);

      return {
        providerPaymentReference: "mock-payment:" + paymentId,
        state: "submitted",
      };
    },

    async capturePayment({
      paymentId,
      providerPaymentReference,
      amountCents: requestedAmount,
      currencyCode: requestedCurrency,
    }) {
      if (!paymentId || !providerPaymentReference) {
        throw new Error("Sandbox capture input is incomplete.");
      }

      return {
        providerKey: normalizedKey,
        providerEventId: "mock-capture:" + paymentId,
        providerPaymentReference,
        eventType: "payment.captured",
        eventStatus: "captured",
        amountCents: amountCents(requestedAmount),
        currencyCode: currencyCode(requestedCurrency),
        occurredAt: new Date().toISOString(),
        sandbox: true,
      };
    },

    normalizeWebhook(rawBody) {
      return normalizeMockPaymentWebhook(rawBody);
    },
  });
}

export function createPaymentProviderAdapter(
  config = getPaymentProviderConfig(),
) {
  if (config.provider === "mock") {
    return createMockPaymentProvider();
  }

  throw new Error(
    "The configured external payment provider adapter is not installed.",
  );
}
