export interface RefundProviderConfig {
  provider: string;
  mode: "sandbox" | "external";
}

export interface RefundProviderEvent {
  providerKey: string;
  providerEventId: string;
  providerRefundReference: string;
  eventType: "refund.succeeded" | "refund.failed";
  eventStatus: string;
  amountCents: number;
  currencyCode: string;
  occurredAt: string;
  sandbox: boolean;
}

export interface RefundProviderAdapter {
  providerKey: string;
  mode: "sandbox" | "external";
  refundPayment(input: {
    refundId: string;
    originalPaymentReference: string;
    amountCents: number;
    currencyCode: string;
    idempotencyKey: string;
  }): Promise<RefundProviderEvent>;
}

export function getRefundProviderConfig(
  env?: NodeJS.ProcessEnv,
): RefundProviderConfig;
export function createMockRefundProvider(input?: {
  key?: string;
}): RefundProviderAdapter;
export function createRefundProviderAdapter(
  config?: RefundProviderConfig,
): RefundProviderAdapter;
