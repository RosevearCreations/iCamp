import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_MESSAGING_COMPLIANCE_RULE,
  classifyMessagingConsentKeyword,
  deriveMessagingPreferenceTransition,
  evaluateMessagingDispatchPermission,
} from "../lib/consent/core.mjs";

test("Build 014 recognizes normalized STOP/START/HELP keywords without partial matches", () => {
  assert.equal(classifyMessagingConsentKeyword(" stop ").action, "stop");
  assert.equal(classifyMessagingConsentKeyword("STOP ALL").action, "stop");
  assert.equal(classifyMessagingConsentKeyword("unsubscribe").action, "stop");
  assert.equal(classifyMessagingConsentKeyword("start").action, "start");
  assert.equal(classifyMessagingConsentKeyword("HELP").action, "help");
  assert.equal(classifyMessagingConsentKeyword("INFO").action, "help");
  assert.equal(classifyMessagingConsentKeyword("please stop"), null);
  assert.equal(classifyMessagingConsentKeyword("starter"), null);
});

test("Build 014 STOP suppresses transport while START does not silently restore marketing consent", () => {
  const stopped = deriveMessagingPreferenceTransition({
    action: "stop",
    currentlySuppressed: false,
  });
  assert.equal(stopped.providerSuppressed, true);
  assert.equal(stopped.marketingPreference, "disabled");
  assert.equal(stopped.marketingConsent, "withdrawn");

  const started = deriveMessagingPreferenceTransition({
    action: "start",
    currentlySuppressed: true,
  });
  assert.equal(started.providerSuppressed, false);
  assert.equal(started.marketingPreference, "unchanged");
  assert.equal(started.marketingConsent, "unchanged");
});

test("Build 014 blocks ordinary messages while provider-suppressed but permits compliance responses", () => {
  const normal = evaluateMessagingDispatchPermission({
    purpose: "operational",
    providerSuppressed: true,
  });
  assert.deepEqual(normal, {
    allowed: false,
    reason: "provider_suppressed",
  });

  const help = evaluateMessagingDispatchPermission({
    purpose: "operational",
    providerSuppressed: true,
    messageKind: "help_response",
  });
  assert.equal(help.allowed, true);
});

test("Build 014 requires current marketing consent under the conservative Canadian fallback", () => {
  const missing = evaluateMessagingDispatchPermission({
    purpose: "marketing",
    preferenceState: "enabled",
    consentState: null,
  });
  assert.equal(missing.allowed, false);
  assert.equal(missing.reason, "marketing_consent_required");

  const granted = evaluateMessagingDispatchPermission({
    purpose: "marketing",
    preferenceState: "enabled",
    consentState: "granted",
    consentOccurredAt: new Date(),
  });
  assert.equal(granted.allowed, true);
  assert.equal(DEFAULT_MESSAGING_COMPLIANCE_RULE.jurisdictionCode, "CA");

  const expired = evaluateMessagingDispatchPermission({
    purpose: "marketing",
    preferenceState: "enabled",
    consentState: "granted",
    consentOccurredAt: "2025-01-01T00:00:00.000Z",
    now: "2026-01-03T00:00:00.000Z",
    rule: {
      ...DEFAULT_MESSAGING_COMPLIANCE_RULE,
      marketingConsentExpiryDays: 365,
    },
  });
  assert.equal(expired.allowed, false);
  assert.equal(expired.reason, "marketing_consent_expired");
});

test("Build 014 purpose preferences remain separate from transport suppression", () => {
  const disabledOperational = evaluateMessagingDispatchPermission({
    purpose: "operational",
    preferenceState: "disabled",
  });
  assert.equal(disabledOperational.allowed, false);
  assert.equal(disabledOperational.reason, "preference_disabled");

  const transactional = evaluateMessagingDispatchPermission({
    purpose: "transactional",
    preferenceState: "enabled",
  });
  assert.equal(transactional.allowed, true);
});
