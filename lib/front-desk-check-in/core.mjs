const SOURCE_CHANNELS = new Set(["web", "staff", "ivr", "sms", "system"]);
const REQUEST_KINDS = new Set(["rental", "store_add_on"]);
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function cleanText(value, label, max, required = false) {
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

function wholeNumber(value, label, minimum, maximum) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(
      label +
        " must be a whole number between " +
        minimum +
        " and " +
        maximum +
        ".",
    );
  }
  return parsed;
}

function asBoolean(value) {
  if (value === true || value === "true" || value === "on" || value === "1") {
    return true;
  }
  return false;
}

function uniqueUuidList(value, label) {
  const raw = Array.isArray(value)
    ? value
    : String(value ?? "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

  const unique = [...new Set(raw.map((item) => String(item).trim()))];
  if (unique.length > 20) {
    throw new Error(label + " may contain at most 20 saved items.");
  }

  for (const id of unique) {
    if (!UUID_PATTERN.test(id)) {
      throw new Error(label + " contains an invalid saved-item ID.");
    }
  }

  return unique;
}

function requestCode(label) {
  const code = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 70);

  return code || "front-desk-request";
}

export function normalizeCheckInSourceChannel(value) {
  const channel = String(value ?? "staff")
    .trim()
    .toLowerCase();

  if (!SOURCE_CHANNELS.has(channel)) {
    throw new Error("Check-in source channel is invalid.");
  }

  return channel;
}

export function parseArrivalRequests(value, requestKind) {
  const kind = String(requestKind ?? "").trim();
  if (!REQUEST_KINDS.has(kind)) {
    throw new Error("Arrival request kind is invalid.");
  }

  const source = Array.isArray(value) ? value.join("\n") : String(value ?? "");
  const entries = source
    .split(/[\n,]+/u)
    .map((item) => item.trim())
    .filter(Boolean);

  if (entries.length > 12) {
    throw new Error("Each arrival request category may contain at most 12 items.");
  }

  return entries.map((entry) => {
    const match = entry.match(/^(.*?)(?::\s*(\d+))?$/u);
    const label = cleanText(match?.[1], "Arrival request", 160, true);
    const quantity = wholeNumber(match?.[2] ?? 1, "Arrival request quantity", 1, 100);

    return {
      requestKind: kind,
      requestCode: requestCode(label),
      displayName: label,
      quantity,
    };
  });
}

export function normalizeFrontDeskCheckInInput(input = {}) {
  const rulesAcknowledged = asBoolean(input.rulesAcknowledged);
  if (!rulesAcknowledged) {
    throw new Error("Arrival rules must be acknowledged before check-in.");
  }

  const balanceOverrideRequested = asBoolean(input.balanceOverrideRequested);
  const balanceOverrideReason = cleanText(
    input.balanceOverrideReason,
    "Balance override reason",
    1000,
    balanceOverrideRequested,
  );

  const credentialRequestCount = wholeNumber(
    input.credentialRequestCount ?? 0,
    "Access credential request count",
    0,
    20,
  );

  return {
    occupantCount: wholeNumber(input.occupantCount, "Occupants", 1, 80),
    visitorCount: wholeNumber(input.visitorCount ?? 0, "Visitors", 0, 80),
    petCount: wholeNumber(input.petCount ?? 0, "Pets", 0, 20),
    vehicleCount: wholeNumber(input.vehicleCount ?? 0, "Vehicles", 0, 20),
    vehicleProfileIds: uniqueUuidList(
      input.vehicleProfileIds,
      "Saved vehicle selection",
    ),
    petProfileIds: uniqueUuidList(input.petProfileIds, "Saved pet selection"),
    rulesAcknowledged,
    credentialRequestCount,
    balanceOverrideRequested,
    balanceOverrideReason,
    notes: cleanText(input.notes, "Check-in notes", 2000),
    rentalRequests: parseArrivalRequests(input.rentalRequests, "rental"),
    storeRequests: parseArrivalRequests(
      input.storeRequests,
      "store_add_on",
    ),
  };
}
