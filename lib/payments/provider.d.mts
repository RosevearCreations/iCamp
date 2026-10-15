export interface PaymentProviderConfig {
  provider: string;
  mode: "sandbox" | "external";
  webhookSecret: string | null;
  webhookToleranceSeconds: number;
}

export function getPaymentProviderConfig(
  env?: NodeJS.ProcessEnv,
): PaymentProviderConfig;
export function signMockPaymentWebhook(input: {
  rawBody: string;
  timestamp: number | string;
  secret: string;
}): string;
export function verifyPaymentWebhookSignature(input: any): boolean;
export function normalizeMockPaymentWebhook(rawBody: string): any;
export function createMockPaymentProvider(input?: { key?: string }): any;
export function createPaymentProviderAdapter(
  config?: PaymentProviderConfig,
): any;
