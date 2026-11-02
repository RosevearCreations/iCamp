export type ChannelSupportLevel =
  "full" | "guided" | "secure-link" | "staff-transfer" | "not-applicable";

export type ChannelKey = "web" | "ivr" | "sms";

export interface ChannelSupport {
  web: ChannelSupportLevel;
  ivr: ChannelSupportLevel;
  sms: ChannelSupportLevel;
  fallback?: "secure-link" | "staff-transfer";
  note?: string;
}

export function defineChannelSupport(
  support: ChannelSupport,
): Readonly<ChannelSupport> {
  return Object.freeze({ ...support });
}

export const shellChannelSupport = defineChannelSupport({
  web: "full",
  ivr: "guided",
  sms: "guided",
  fallback: "staff-transfer",
  note: "Build 001 defines the channel contract; domain actions arrive in later builds.",
});

export const channelLabels: Record<ChannelKey, string> = {
  web: "Web / PWA",
  ivr: "Phone / DTMF",
  sms: "SMS / MMS",
};

export const supportLabels: Record<ChannelSupportLevel, string> = {
  full: "Full",
  guided: "Guided equivalent",
  "secure-link": "Secure-link handoff",
  "staff-transfer": "Staff transfer",
  "not-applicable": "Not applicable",
};
