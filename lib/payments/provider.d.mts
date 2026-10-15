export interface PaymentProviderConfig {
  provider: string;
  mode: "sandbox" | "external";
  webhookSecret: string | null;
  webhookToleranceSeconds: number;
}

export interface PaymentProviderEvent {
  providerKey: string;
  providerEventId: string;
  providerPaymentReference: string;
  eventType:
    | "payment.authorized"
    | "payment.captured"
    | "payment.failed"
    | "payment.cancelled";
  eventStatus: string;
  amountCents: number;
  currencyCode: string;
  occurredAt: string;
  sandbox: boolean;
}

export interface PaymentProviderAdapter {
  providerKey: string;
  mode: "sandbox" | "external";
  createPayment(input: {
    paymentId: string;
    amountCents: number;
    currencyCode: string;
    idempotencyKey: string;
  }): Promise<{
    providerPaymentReference: string;
    state: string;
  }>;
  capturePayment(input: {
    paymentId: string;
    providerPaymentReference: string;
    amountCents: number;
    currencyCode: string;
  }): Promise<PaymentProviderEvent>;
  normalizeWebhook(rawBody: string): PaymentProviderEvent;
}

export function getPaymentProviderConfig(
  env?: NodeJS.ProcessEnv,
): PaymentProviderConfig;
export function signMockPaymentWebhook(input: {
  rawBody: string;
  timestamp: number | string;
  secret: string;
}): string;
export function verifyPaymentWebhookSignature(input: {
  rawBody: string;
  timestamp: number | string;
  signature: string | null;
  secret: string;
  toleranceSeconds?: number;
  nowSeconds?: number;
}): boolean;
export function normalizeMockPaymentWebhook(
  rawBody: string,
): PaymentProviderEvent;
export function createMockPaymentProvider(input?: {
  key?: string;
}): PaymentProviderAdapter;
export function createPaymentProviderAdapter(
  config?: PaymentProviderConfig,
): PaymentProviderAdapter;
