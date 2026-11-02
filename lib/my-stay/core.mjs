const URL_FIELDS = [
  "storeUrl",
  "rentalsUrl",
  "eventsUrl",
  "localInterestsUrl",
  "assistanceUrl",
];

function optionalText(value, label, max) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return null;
  if (normalized.length > max) {
    throw new Error(label + " must be " + max + " characters or fewer.");
  }
  return normalized;
}

export function normalizeMyStayHandoffUrl(value, label = "Link") {
  const normalized = optionalText(value, label, 2048);
  if (!normalized) return null;
  if (normalized.startsWith("/")) {
    if (normalized.startsWith("//")) {
      throw new Error(label + " must be an iCamp path or HTTPS URL.");
    }
    return normalized;
  }

  let parsed;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new Error(label + " must be an iCamp path or HTTP(S) URL.");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error(label + " must use HTTP or HTTPS.");
  }
  return parsed.toString();
}

export function normalizeMyStaySettingsInput(input = {}) {
  const normalized = {
    guestRulesSummary: optionalText(
      input.guestRulesSummary,
      "Guest rules summary",
      4000,
    ),
    wifiNetworkName: optionalText(
      input.wifiNetworkName,
      "Wi-Fi network name",
      120,
    ),
    wifiAccessInstructions: optionalText(
      input.wifiAccessInstructions,
      "Wi-Fi access instructions",
      2000,
    ),
    assistanceInstructions: optionalText(
      input.assistanceInstructions,
      "Assistance instructions",
      2000,
    ),
  };

  for (const field of URL_FIELDS) {
    const label = field
      .replace(/Url$/u, "")
      .replace(/([A-Z])/gu, " $1")
      .toLowerCase();
    normalized[field] = normalizeMyStayHandoffUrl(input[field], label);
  }

  return normalized;
}

export function myStayPhase({ status, arrivalDate, departureDate, localDate }) {
  if (status === "checked_in") return "in_stay";
  if (status === "confirmed") {
    if (localDate < arrivalDate) return "upcoming";
    if (localDate < departureDate) return "arrival_ready";
    return "departure_due";
  }
  if (status === "completed") return "completed";
  if (status === "pending") return "booking_pending";
  return "other";
}
