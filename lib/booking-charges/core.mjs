import { formatMoney } from "../pricing/core.mjs";

function integer(value, label, { minimum = 0 } = {}) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < minimum) {
    throw new Error(label + " must be an integer of at least " + minimum + ".");
  }
  return number;
}

function moneyInteger(value, label) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) {
    throw new Error(label + " must be a non-negative integer amount in cents.");
  }
  return number;
}

function normalizedCode(value) {
  return String(value ?? "").trim();
}

function itemApplies(item, accommodationId, accommodationKind) {
  if (item.isActive === false) return false;
  if (item.scopeKind === "campground") return true;
  if (item.scopeKind === "accommodation_type") {
    return item.accommodationKind === accommodationKind;
  }
  if (item.scopeKind === "accommodation") {
    return String(item.accommodationId ?? "") === String(accommodationId ?? "");
  }
  return false;
}

export function listApplicableBookingCharges({
  catalog = [],
  accommodationId,
  accommodationKind,
  publicOnly = false,
}) {
  return catalog
    .filter((item) => itemApplies(item, accommodationId, accommodationKind))
    .filter((item) => !publicOnly || item.isPublic !== false)
    .sort((a, b) => {
      const mode = String(a.applicationMode).localeCompare(
        String(b.applicationMode),
      );
      if (mode !== 0) return mode;
      const kind = String(a.chargeKind).localeCompare(String(b.chargeKind));
      if (kind !== 0) return kind;
      return String(a.displayName).localeCompare(String(b.displayName));
    });
}

function priceLine({ item, quantity, nights, staySubtotalCents }) {
  if (item.pricingBasis === "percent_of_stay") {
    const basisPoints = integer(
      item.percentageBasisPoints,
      "Percentage basis points",
    );
    return Math.round((staySubtotalCents * basisPoints) / 10000);
  }

  const unitPrice = moneyInteger(item.unitPriceCents, "Unit price");
  if (item.pricingBasis === "per_night") {
    return unitPrice * quantity * nights;
  }
  if (item.pricingBasis === "per_stay" || item.pricingBasis === "per_unit") {
    return unitPrice * quantity;
  }

  throw new Error("Unsupported booking charge pricing basis.");
}

function selectedQuantities(selections) {
  const values = new Map();
  for (const selection of selections) {
    const code = normalizedCode(selection.code);
    if (!code) throw new Error("Booking charge selection code is required.");
    if (values.has(code)) {
      throw new Error("Duplicate booking charge selection: " + code + ".");
    }
    values.set(code, integer(selection.quantity, "Quantity", { minimum: 1 }));
  }
  return values;
}

export function quoteBookingCharges({
  catalog = [],
  selections = [],
  accommodationId,
  accommodationKind,
  nights,
  staySubtotalCents = 0,
  currencyCode = "CAD",
}) {
  const stayNights = integer(nights, "Nights", { minimum: 1 });
  const staySubtotal = moneyInteger(staySubtotalCents, "Stay subtotal");
  const currency = String(currencyCode ?? "")
    .trim()
    .toUpperCase();
  if (!/^[A-Z]{3}$/u.test(currency)) {
    throw new Error("Currency code must use three uppercase letters.");
  }

  const applicable = listApplicableBookingCharges({
    catalog,
    accommodationId,
    accommodationKind,
  });
  const byCode = new Map(applicable.map((item) => [item.code, item]));
  const quantities = selectedQuantities(selections);

  for (const code of quantities.keys()) {
    const item = byCode.get(code);
    if (!item) {
      throw new Error(
        "Booking charge is unavailable for this accommodation: " + code + ".",
      );
    }
    if (item.applicationMode === "automatic") {
      throw new Error(
        "Automatic service fees cannot be selected manually: " + code + ".",
      );
    }
  }

  const lines = [];
  for (const item of applicable) {
    let quantity = null;
    if (item.applicationMode === "automatic") {
      quantity = 1;
    } else if (quantities.has(item.code)) {
      quantity = quantities.get(item.code);
    }
    if (quantity === null) continue;

    const minimum = integer(item.minimumQuantity ?? 1, "Minimum quantity", {
      minimum: 1,
    });
    const maximum = integer(
      item.maximumQuantity ?? minimum,
      "Maximum quantity",
      {
        minimum,
      },
    );
    if (quantity < minimum || quantity > maximum) {
      throw new Error(
        item.displayName +
          " quantity must be between " +
          minimum +
          " and " +
          maximum +
          ".",
      );
    }

    const itemCurrency = String(item.currencyCode ?? currency).toUpperCase();
    if (itemCurrency !== currency) {
      throw new Error(
        "Booking charges must use the same currency as the stay quote.",
      );
    }

    const lineTotalCents = priceLine({
      item,
      quantity,
      nights: stayNights,
      staySubtotalCents: staySubtotal,
    });

    lines.push({
      id: item.id ?? null,
      code: item.code,
      displayName: item.displayName,
      chargeKind: item.chargeKind,
      applicationMode: item.applicationMode,
      quantity,
      lineTotalCents,
      currencyCode: currency,
      taxCategoryCode: item.taxCategoryCode ?? null,
      feeCategoryCode: item.feeCategoryCode ?? null,
    });
  }

  return {
    currencyCode: currency,
    totalCents: lines.reduce((sum, line) => sum + line.lineTotalCents, 0),
    automaticTotalCents: lines
      .filter((line) => line.applicationMode === "automatic")
      .reduce((sum, line) => sum + line.lineTotalCents, 0),
    optionalTotalCents: lines
      .filter((line) => line.applicationMode === "optional")
      .reduce((sum, line) => sum + line.lineTotalCents, 0),
    lines,
  };
}

export function bookingChargePriceLabel(item, currencyCode = "CAD") {
  if (item.pricingBasis === "percent_of_stay") {
    const basisPoints = integer(
      item.percentageBasisPoints,
      "Percentage basis points",
    );
    const percent = basisPoints / 100;
    return (
      percent.toLocaleString("en-CA", {
        maximumFractionDigits: 2,
      }) + "% of stay"
    );
  }

  const amount = formatMoney(
    item.unitPriceCents,
    item.currencyCode ?? currencyCode,
  );
  if (item.pricingBasis === "per_night") return amount + " / night";
  if (item.pricingBasis === "per_stay") return amount + " / stay";

  const unit = String(item.unitLabel ?? "item").trim();
  return amount + " / " + unit;
}
