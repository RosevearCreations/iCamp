export const MESSAGING_COMPLIANCE_MESSAGE_KINDS = Object.freeze([
  "normal",
  "help_response",
  "consent_confirmation",
]);

export const DEFAULT_MESSAGING_COMPLIANCE_RULE = Object.freeze({
  jurisdictionCode: "CA",
  marketingRequiresConsent: true,
  marketingConsentExpiryDays: null,
  stopSuppressesAll: true,
  startGrantsMarketingConsent: false,
  helpAllowedWhenSuppressed: true,
});

const STOP_KEYWORDS = new Set([
  "STOP",
  "STOPALL",
  "STOP ALL",
  "UNSUBSCRIBE",
  "CANCEL",
  "END",
  "QUIT",
]);

const START_KEYWORDS = new Set(["START", "UNSTOP"]);
const HELP_KEYWORDS = new Set(["HELP", "INFO"]);

function normalizeKeywordText(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/gu, " ")
    .toUpperCase();
}

export function classifyMessagingConsentKeyword(value) {
  const normalized = normalizeKeywordText(value);

  if (STOP_KEYWORDS.has(normalized)) {
    return { action: "stop", normalizedKeyword: normalized };
  }

  if (START_KEYWORDS.has(normalized)) {
    return { action: "start", normalizedKeyword: normalized };
  }

  if (HELP_KEYWORDS.has(normalized)) {
    return { action: "help", normalizedKeyword: normalized };
  }

  return null;
}

export function deriveMessagingPreferenceTransition({
  action,
  currentlySuppressed = false,
  rule = DEFAULT_MESSAGING_COMPLIANCE_RULE,
}) {
  if (!["stop", "start", "help"].includes(action)) {
    throw new Error("Messaging preference action is invalid.");
  }

  if (action === "stop") {
    return {
      providerSuppressed: Boolean(rule.stopSuppressesAll),
      marketingPreference: "disabled",
      marketingConsent: "withdrawn",
    };
  }

  if (action === "start") {
    return {
      providerSuppressed: false,
      marketingPreference: rule.startGrantsMarketingConsent
        ? "enabled"
        : "unchanged",
      marketingConsent: rule.startGrantsMarketingConsent
        ? "granted"
        : "unchanged",
    };
  }

  return {
    providerSuppressed: Boolean(currentlySuppressed),
    marketingPreference: "unchanged",
    marketingConsent: "unchanged",
  };
}

function consentIsCurrent({ consentState, consentOccurredAt, rule, now }) {
  if (consentState !== "granted") return false;

  if (!rule.marketingConsentExpiryDays) return true;
  if (!consentOccurredAt) return false;

  const occurred = new Date(consentOccurredAt).getTime();
  const current = new Date(now).getTime();

  if (!Number.isFinite(occurred) || !Number.isFinite(current)) return false;

  return (
    current - occurred <=
    Number(rule.marketingConsentExpiryDays) * 24 * 60 * 60 * 1000
  );
}

export function evaluateMessagingDispatchPermission({
  purpose,
  preferenceState = null,
  consentState = null,
  consentOccurredAt = null,
  providerSuppressed = false,
  messageKind = "normal",
  rule = DEFAULT_MESSAGING_COMPLIANCE_RULE,
  now = new Date(),
}) {
  if (!["transactional", "operational", "marketing"].includes(purpose)) {
    throw new Error("Messaging purpose is invalid.");
  }

  if (!MESSAGING_COMPLIANCE_MESSAGE_KINDS.includes(messageKind)) {
    throw new Error("Messaging compliance message kind is invalid.");
  }

  const complianceResponse =
    messageKind === "help_response" || messageKind === "consent_confirmation";

  if (providerSuppressed && !complianceResponse) {
    return { allowed: false, reason: "provider_suppressed" };
  }

  if (
    providerSuppressed &&
    complianceResponse &&
    !rule.helpAllowedWhenSuppressed
  ) {
    return { allowed: false, reason: "suppressed_response_not_allowed" };
  }

  if (preferenceState === "disabled" && !complianceResponse) {
    return { allowed: false, reason: "preference_disabled" };
  }

  if (purpose !== "marketing") {
    return { allowed: true, reason: "purpose_allowed" };
  }

  if (!rule.marketingRequiresConsent) {
    return { allowed: true, reason: "consent_not_required" };
  }

  const current = consentIsCurrent({
    consentState,
    consentOccurredAt,
    rule,
    now,
  });

  return current
    ? { allowed: true, reason: "marketing_consent_current" }
    : {
        allowed: false,
        reason:
          consentState === "granted"
            ? "marketing_consent_expired"
            : "marketing_consent_required",
      };
}
