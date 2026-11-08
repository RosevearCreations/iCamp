export const SERVICE_PRESETS = Object.freeze([
  { code: "dump-station", name: "Dumping station use", unitLabel: "use" },
  { code: "pump-out", name: "On-site RV pump-out", unitLabel: "service" },
  { code: "fresh-water", name: "Freshwater fill", unitLabel: "fill" },
  { code: "propane", name: "Propane refill", unitLabel: "refill" },
  { code: "firewood", name: "Firewood bundle", unitLabel: "bundle" },
  { code: "ice", name: "Bag of ice", unitLabel: "bag" },
  { code: "equipment-rental", name: "Equipment rental", unitLabel: "rental" },
  { code: "extra-vehicle", name: "Additional vehicle", unitLabel: "vehicle" },
  {
    code: "extra-guest",
    name: "Additional overnight guest",
    unitLabel: "guest",
  },
]);

const bases = new Set(["per_stay", "per_night", "per_unit"]);

export function dollarsToCents(value) {
  const input = String(value ?? "").trim();
  if (!/^(?:0|[1-9][0-9]{0,5})(?:\.[0-9]{1,2})?$/u.test(input)) {
    throw new Error("Price must be a CAD amount with at most two decimals.");
  }
  const [whole, fractional = ""] = input.split(".");
  return Number(whole) * 100 + Number(fractional.padEnd(2, "0"));
}

export function centsToDollars(cents) {
  if (!Number.isInteger(Number(cents)) || Number(cents) < 0) {
    throw new Error("Price must be a non-negative integer number of cents.");
  }
  return (Number(cents) / 100).toFixed(2);
}

function cleanDate(value, label) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(text)) {
    throw new Error(`${label} must be a calendar date.`);
  }
  const parsed = new Date(text + "T00:00:00Z");
  if (
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== text
  ) {
    throw new Error(`${label} must be a real calendar date.`);
  }
  return text;
}

function quantity(value, label) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > 100) {
    throw new Error(`${label} must be between 1 and 100.`);
  }
  return number;
}

export function validateServiceCatalogEntry(input) {
  const preset = SERVICE_PRESETS.find((item) => item.code === input.preset);
  const code = (
    String(input.code ?? "").trim() ||
    preset?.code ||
    ""
  ).toLowerCase();
  const displayName =
    String(input.displayName ?? "").trim() || preset?.name || "";
  const description = String(input.description ?? "").trim();
  const pricingBasis = String(input.pricingBasis ?? "").trim();
  const unitLabel =
    String(input.unitLabel ?? "").trim() || preset?.unitLabel || "";
  const minimumQuantity = quantity(input.minimumQuantity, "Minimum quantity");
  const maximumQuantity = quantity(input.maximumQuantity, "Maximum quantity");
  const startsOn = cleanDate(input.startsOn, "Available from");
  const endsOn = cleanDate(input.endsOn, "Available until");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(code) || code.length > 80) {
    throw new Error(
      "Service code must use lowercase letters, numbers and hyphens.",
    );
  }
  if (!displayName || displayName.length > 120) {
    throw new Error("Service name must contain 1–120 characters.");
  }
  if (description.length > 1000) throw new Error("Description is too long.");
  if (!bases.has(pricingBasis)) throw new Error("Unsupported pricing basis.");
  if (!unitLabel || unitLabel.length > 40)
    throw new Error("Unit label must contain 1–40 characters.");
  if (maximumQuantity < minimumQuantity)
    throw new Error("Maximum quantity must be at least the minimum.");
  if (startsOn && endsOn && endsOn < startsOn)
    throw new Error("End date cannot precede start date.");
  return {
    code,
    displayName,
    description: description || null,
    pricingBasis,
    unitLabel,
    minimumQuantity,
    maximumQuantity,
    startsOn,
    endsOn,
    unitPriceCents: dollarsToCents(input.priceDollars),
    isPublic: input.isPublic === true,
  };
}
