export const COMMUNICATION_CHANNELS = Object.freeze([
  "web",
  "voice",
  "dtmf",
  "speech",
  "sms",
  "mms",
  "email",
  "push",
]);

export const COMMUNICATION_PURPOSES = Object.freeze([
  "transactional",
  "operational",
  "marketing",
]);

export function getCommunicationsProviderConfig(env = process.env) {
  const provider = String(env.ICAMP_COMMUNICATIONS_PROVIDER ?? "mock")
    .trim()
    .toLowerCase();

  if (!/^[a-z][a-z0-9_-]{1,63}$/u.test(provider)) {
    throw new Error("Communications provider key is invalid.");
  }

  return {
    provider,
    mode: provider === "mock" ? "mock" : "external",
  };
}

export function createMockCommunicationsProvider({
  providerKey = "mock",
} = {}) {
  return {
    providerKey,
    supportedChannels: [...COMMUNICATION_CHANNELS],
    async dispatch({
      dispatchId,
      channel,
      purpose,
      endpointHint = null,
      idempotencyKey,
    }) {
      if (!COMMUNICATION_CHANNELS.includes(channel)) {
        throw new Error("Unsupported communication channel.");
      }

      if (!COMMUNICATION_PURPOSES.includes(purpose)) {
        throw new Error("Unsupported communication purpose.");
      }

      if (!dispatchId || !idempotencyKey) {
        throw new Error("Dispatch ID and idempotency key are required.");
      }

      return {
        providerKey,
        providerReference:
          "mock:" + channel + ":" + String(dispatchId).slice(0, 36),
        state: "accepted",
        retryable: false,
        endpointHint,
      };
    },
  };
}
