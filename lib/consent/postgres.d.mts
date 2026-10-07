import type { MessagingComplianceRule } from "./core.d.mts";

export function configureMessagingComplianceRule(input: {
  actorUserId: string;
  organizationId: string;
  campgroundId: string;
  jurisdictionCode: string;
  isDefault?: boolean;
  marketingRequiresConsent?: boolean;
  marketingConsentExpiryDays?: number | null;
  stopSuppressesAll?: boolean;
  startGrantsMarketingConsent?: boolean;
  helpAllowedWhenSuppressed?: boolean;
  reason?: string;
}): Promise<MessagingComplianceRule & { id?: string }>;

export function applyMessagingPreferenceKeywordInTransaction(
  client: { query: (...args: any[]) => Promise<any> },
  input: {
    organizationId: string;
    campgroundId: string;
    endpointId: string;
    providerKey: string;
    providerEventId: string;
    action: "stop" | "start" | "help";
    occurredAt: string | Date;
    jurisdictionCode?: string | null;
  },
): Promise<{
  duplicate: boolean;
  action: "stop" | "start" | "help";
  providerSuppressed: boolean;
  jurisdictionCode: string;
}>;

export function applyMessagingPreferenceKeyword(input: {
  organizationId: string;
  campgroundId: string;
  endpointId: string;
  providerKey: string;
  providerEventId: string;
  action: "stop" | "start" | "help";
  occurredAt: string | Date;
  jurisdictionCode?: string | null;
}): Promise<{
  duplicate: boolean;
  action: "stop" | "start" | "help";
  providerSuppressed: boolean;
  jurisdictionCode: string;
}>;

export function recordMessagingMarketingConsent(input: {
  actorUserId: string;
  organizationId: string;
  campgroundId: string;
  endpointId: string;
  channel?: "sms" | "mms";
  consentState: "granted" | "withdrawn";
  evidenceSource?: "user" | "staff" | "import";
  evidenceReference?: string | null;
  reason?: string;
}): Promise<{
  id: string;
  consentState: "granted" | "withdrawn";
  channel: "sms" | "mms";
  occurredAt: string;
}>;

export function assertMessagingDispatchAllowed(input: {
  campgroundId: string;
  endpointId: string;
  purpose: "transactional" | "operational" | "marketing";
  channel: "sms" | "mms";
  messageKind?: "normal" | "help_response" | "consent_confirmation";
  now?: string | Date;
}): Promise<{
  allowed: true;
  reason: string;
  jurisdictionCode: string;
}>;

export function getMessagingConsentHealth(): Promise<{
  status: "operational";
  endpoints: { tracked: number; providerSuppressed: number };
  keywords24h: { stop: number; start: number; help: number };
  marketing: { granted: number; withdrawn: number };
  complianceRules: { active: number; safeFallbackJurisdiction: string };
  privacy: { endpointValuesExcluded: true; messageBodiesExcluded: true };
}>;

export function closeMessagingConsentPoolForTests(): Promise<void>;
