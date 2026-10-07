export interface MessagingComplianceRule {
  jurisdictionCode: string;
  marketingRequiresConsent: boolean;
  marketingConsentExpiryDays: number | null;
  stopSuppressesAll: boolean;
  startGrantsMarketingConsent: boolean;
  helpAllowedWhenSuppressed: boolean;
}

export const MESSAGING_COMPLIANCE_MESSAGE_KINDS: readonly [
  "normal",
  "help_response",
  "consent_confirmation",
];

export const DEFAULT_MESSAGING_COMPLIANCE_RULE: Readonly<MessagingComplianceRule>;

export function classifyMessagingConsentKeyword(value: string): null | {
  action: "stop" | "start" | "help";
  normalizedKeyword: string;
};

export function deriveMessagingPreferenceTransition(input: {
  action: "stop" | "start" | "help";
  currentlySuppressed?: boolean;
  rule?: MessagingComplianceRule;
}): {
  providerSuppressed: boolean;
  marketingPreference: "enabled" | "disabled" | "unchanged";
  marketingConsent: "granted" | "withdrawn" | "unchanged";
};

export function evaluateMessagingDispatchPermission(input: {
  purpose: "transactional" | "operational" | "marketing";
  preferenceState?: "enabled" | "disabled" | null;
  consentState?: "granted" | "withdrawn" | "not_required" | null;
  consentOccurredAt?: string | Date | null;
  providerSuppressed?: boolean;
  messageKind?: "normal" | "help_response" | "consent_confirmation";
  rule?: MessagingComplianceRule;
  now?: string | Date;
}): { allowed: boolean; reason: string };
