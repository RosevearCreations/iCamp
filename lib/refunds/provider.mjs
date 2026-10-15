function token(value, label) {
  const normalized = String(value ?? "").trim();
  if (normalized.length < 1 || normalized.length > 240) {
    throw new Error(label + " is invalid.");
  }
  return normalized;
}

function amount(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 200000000) {
    throw new Error("Refund amount is invalid.");
  }
  return parsed;
}

function currency(value) {
  const normalized = String(value ?? "")
    .trim()
    .toUpperCase();
  if (!/^[A-Z]{3}$/u.test(normalized)) {
    throw new Error("Refund currency is invalid.");
  }
  return normalized;
}

function providerKey(value) {
  const normalized = String(value ?? "mock")
    .trim()
    .toLowerCase();
  if (!/^[a-z][a-z0-9_-]{1,63}$/u.test(normalized)) {
    throw new Error("Refund provider key is invalid.");
  }
  return normalized;
}

export function getRefundProviderConfig(env = process.env) {
  const provider = providerKey(env.ICAMP_PAYMENT_PROVIDER ?? "mock");
  return {
    provider,
    mode: provider === "mock" ? "sandbox" : "external",
  };
}

export function createMockRefundProvider({ key = "mock" } = {}) {
  const normalizedKey = providerKey(key);
  return Object.freeze({
    providerKey: normalizedKey,
    mode: "sandbox",
    async refundPayment({
      refundId,
      originalPaymentReference,
      amountCents,
      currencyCode,
      idempotencyKey,
    }) {
      token(refundId, "Refund ID");
      token(originalPaymentReference, "Original payment reference");
      token(idempotencyKey, "Refund idempotency key");
      return {
        providerKey: normalizedKey,
        providerEventId: "mock-refund-succeeded:" + refundId,
        providerRefundReference: "mock-refund:" + refundId,
        eventType: "refund.succeeded",
        eventStatus: "succeeded",
        amountCents: amount(amountCents),
        currencyCode: currency(currencyCode),
        occurredAt: new Date().toISOString(),
        sandbox: true,
      };
    },
  });
}

export function createRefundProviderAdapter(
  config = getRefundProviderConfig(),
) {
  if (config.provider === "mock") {
    return createMockRefundProvider();
  }
  throw new Error(
    "The configured external refund provider adapter is not installed.",
  );
}
