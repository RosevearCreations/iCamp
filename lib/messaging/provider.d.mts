export interface MessagingProviderConfig {
  provider: string;
  mode: "sandbox" | "external";
  webhookSecret: string | null;
  webhookToleranceSeconds: number;
}

export interface MessagingAttachmentInput {
  mediaReference: string;
  contentType: string;
  bytes: number;
}

export interface NormalizedMessagingWebhook {
  providerKey: string;
  providerEventId: string;
  providerMessageReference: string;
  providerNumberReference: string;
  remoteAddress: string | null;
  eventType:
    | "message.received"
    | "message.sent"
    | "message.delivered"
    | "message.read"
    | "message.failed";
  eventStatus: string;
  direction: "inbound" | "outbound";
  channel: "sms" | "mms";
  text: string;
  attachments: MessagingAttachmentInput[];
  occurredAt: string;
  sandbox: boolean;
}

export interface MessagingProviderAdapter {
  providerKey: string;
  mode: "sandbox";
  sendMessage(input: {
    dispatchId: string;
    destination: string;
    text: string;
    mediaReferences?: string[];
    idempotencyKey: string;
  }): Promise<{
    providerMessageReference: string;
    providerReference: string;
    state: "accepted";
  }>;
  normalizeWebhook(rawBody: string): NormalizedMessagingWebhook;
}

export function getMessagingProviderConfig(
  env?: NodeJS.ProcessEnv,
): MessagingProviderConfig;

export function signMockMessagingWebhook(input: {
  rawBody: string;
  timestamp: number;
  secret: string;
}): string;

export function verifyMessagingWebhookSignature(input: {
  rawBody: string;
  timestamp: string | number;
  signature: string | null;
  secret: string | null;
  toleranceSeconds?: number;
  nowSeconds?: number;
}): boolean;

export function normalizeMockMessagingWebhook(
  rawBody: string,
): NormalizedMessagingWebhook;

export function createMockMessagingProvider(input?: {
  providerKey?: string;
}): MessagingProviderAdapter;

export function createMessagingProviderAdapter(
  config?: MessagingProviderConfig,
): MessagingProviderAdapter;
