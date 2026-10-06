export type CommunicationChannel =
  "web" | "voice" | "dtmf" | "speech" | "sms" | "mms" | "email" | "push";

export type CommunicationPurpose =
  "transactional" | "operational" | "marketing";

export const COMMUNICATION_CHANNELS: readonly CommunicationChannel[];
export const COMMUNICATION_PURPOSES: readonly CommunicationPurpose[];

export function getCommunicationsProviderConfig(env?: NodeJS.ProcessEnv): {
  provider: string;
  mode: "mock" | "external";
};

export function createMockCommunicationsProvider(input?: {
  providerKey?: string;
}): {
  providerKey: string;
  supportedChannels: CommunicationChannel[];
  dispatch(input: {
    dispatchId: string;
    channel: CommunicationChannel;
    purpose: CommunicationPurpose;
    endpointHint?: string | null;
    idempotencyKey: string;
  }): Promise<{
    providerKey: string;
    providerReference: string;
    state: "accepted";
    retryable: false;
    endpointHint: string | null;
  }>;
};
