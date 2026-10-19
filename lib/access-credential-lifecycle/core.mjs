const TYPES = new Set([
  "key_card",
  "fob",
  "keypad_pin",
  "qr_pass",
  "printed_pass",
  "wristband",
  "provider_reference",
]);

const CHANNELS = new Set(["web", "staff", "ivr", "sms", "system"]);

function clean(value, label, max, required = false) {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    if (required) throw new Error(label + " is required.");
    return null;
  }
  if (normalized.length > max) {
    throw new Error(label + " must be " + max + " characters or fewer.");
  }
  return normalized;
}

function choice(value, values, label) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  if (!values.has(normalized)) throw new Error(label + " is invalid.");
  return normalized;
}

export function normalizeCredentialLifecycleSourceChannel(value = "staff") {
  return choice(value, CHANNELS, "Credential lifecycle source channel");
}

export function normalizeReservationCredentialProvisionInput(input = {}) {
  const credentialType = choice(input.credentialType, TYPES, "Credential type");
  const providerCode = clean(input.providerCode, "Provider code", 64);
  const providerCredentialReference = clean(
    input.providerCredentialReference,
    "Provider credential reference",
    240,
  );

  if (
    credentialType === "provider_reference" &&
    (!providerCode || !providerCredentialReference)
  ) {
    throw new Error(
      "Provider credentials require provider code and provider reference.",
    );
  }

  if (
    credentialType !== "provider_reference" &&
    (providerCode || providerCredentialReference)
  ) {
    throw new Error(
      "Provider details are only allowed for provider-reference credentials.",
    );
  }

  return {
    credentialType,
    subjectLabel: clean(
      input.subjectLabel,
      "Credential subject label",
      240,
      true,
    ),
    providerCode,
    providerCredentialReference,
    syncWithStay: input.syncWithStay !== false,
  };
}

export function normalizeCredentialLifecycleReason(value, label = "Reason") {
  const reason = clean(value, label, 500, true);
  if (reason.length < 3) {
    throw new Error(label + " must be at least 3 characters.");
  }
  return reason;
}

export function classifyCredentialValidityChange(previousValue, nextValue) {
  const previous = new Date(previousValue);
  const next = new Date(nextValue);
  if (Number.isNaN(previous.getTime()) || Number.isNaN(next.getTime())) {
    throw new Error("Credential validity timestamp is invalid.");
  }
  if (next.getTime() === previous.getTime()) return "unchanged";
  return next > previous ? "validity_extended" : "validity_shortened";
}

export function credentialNeedsGeneratedSecret(credentialType) {
  const type = choice(credentialType, TYPES, "Credential type");
  return type === "keypad_pin" || type === "qr_pass";
}
