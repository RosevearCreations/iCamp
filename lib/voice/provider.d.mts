export interface VoiceProviderConfig {
  provider: string;
  mode: "sandbox" | "external";
  webhookSecret: string | null;
  webhookToleranceSeconds: number;
}

export interface NormalizedVoiceWebhook {
  providerKey: string;
  providerEventId: string;
  providerCallReference: string;
  providerNumberReference: string;
  eventType:
    | "call.initiated"
    | "call.ringing"
    | "call.answered"
    | "call.completed"
    | "call.failed";
  eventStatus: string;
  direction: "inbound" | "outbound";
  occurredAt: string;
  sandbox: boolean;
}

export function getVoiceProviderConfig(env?: NodeJS.ProcessEnv): VoiceProviderConfig;

export function signMockVoiceWebhook(input: {
  rawBody: string;
  timestamp: number;
  secret: string;
}): string;

export function verifyVoiceWebhookSignature(input: {
  rawBody: string;
  timestamp: number | string;
  signature: string | null;
  secret: string | null;
  toleranceSeconds?: number;
  nowSeconds?: number;
}): boolean;

export function normalizeMockVoiceWebhook(
  rawBody: string,
): NormalizedVoiceWebhook;

export interface VoiceProviderAdapter {
  providerKey: string;
  mode: "sandbox";
  placeCall(input: {
    dispatchId: string;
    providerNumberReference: string;
    destination: string;
    idempotencyKey: string;
  }): Promise<{
    providerCallReference: string;
    providerReference: string;
    state: "accepted";
  }>;
  transferCall(input: {
    providerCallReference: string;
    destination: string;
  }): Promise<{
    state: "accepted";
    providerReference: string;
  }>;
  normalizeWebhook(rawBody: string): NormalizedVoiceWebhook;
}

export function createMockVoiceProvider(input?: {
  providerKey?: string;
}): VoiceProviderAdapter;

export function createVoiceProviderAdapter(
  config?: VoiceProviderConfig,
): VoiceProviderAdapter;
