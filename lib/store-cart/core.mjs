export const storeCategories = Object.freeze([
  "essentials",
  "food",
  "camping",
  "firewood",
  "souvenirs",
  "other",
]);

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export function storeUuid(value, label = "Identifier") {
  const parsed = String(value ?? "").trim();
  if (!UUID.test(parsed)) throw new Error(`${label} is invalid.`);
  return parsed;
}

function readable(value, label, min, max) {
  const parsed = String(value ?? "").trim();
  if (parsed.length < min || parsed.length > max || /\p{Cc}/u.test(parsed))
    throw new Error(`${label} must have ${min}–${max} readable characters.`);
  return parsed;
}

export function storeDate(value) {
  const candidate = String(value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(candidate))
    throw new Error("Delivery date must be YYYY-MM-DD.");
  const [year, month, day] = candidate.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.toISOString().slice(0, 10) !== candidate)
    throw new Error("Delivery date is invalid.");
  return candidate;
}

export function normalizeStoreProduct(input) {
  const sku = readable(input?.sku, "SKU", 1, 64);
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u.test(sku))
    throw new Error(
      "SKU must use letters, numbers, periods, dashes or underscores.",
    );
  const category = String(input?.category ?? "").trim();
  if (!storeCategories.includes(category))
    throw new Error("Product category is invalid.");
  const stockText = String(input?.stock ?? "").trim();
  const stock = stockText === "" ? null : Number(stockText);
  if (
    stock !== null &&
    (!Number.isSafeInteger(stock) || stock < 0 || stock > 9999)
  )
    throw new Error(
      "A staff-reported stock count must be 0–9999, or blank if unknown.",
    );
  return {
    sku,
    name: readable(input?.name, "Product name", 2, 160),
    description: readable(input?.description, "Description", 10, 1200),
    category,
    stock,
    isPublished: input?.isPublished === true,
  };
}

export function storeQuantity(value, allowRemove = false) {
  const parsed = Number(value);
  if (
    !Number.isSafeInteger(parsed) ||
    parsed < (allowRemove ? 0 : 1) ||
    parsed > 20
  )
    throw new Error(
      "Cart item quantity must be between 1 and 20 (0 removes an item).",
    );
  return parsed;
}

export function normalizeStoreDelivery(input) {
  const fulfillmentPreference = String(
    input?.fulfillmentPreference ?? "",
  ).trim();
  if (!["office_pickup", "campsite_delivery"].includes(fulfillmentPreference))
    throw new Error(
      "Choose campground office pickup or campsite delivery preference.",
    );
  const deliveryNote = readable(input?.deliveryNote, "Delivery note", 0, 400);
  if (fulfillmentPreference === "office_pickup") {
    return {
      fulfillmentPreference,
      reservationId: null,
      deliveryDate: null,
      deliveryNote,
    };
  }
  return {
    fulfillmentPreference,
    reservationId: storeUuid(input?.reservationId, "Stay"),
    deliveryDate: storeDate(input?.deliveryDate),
    deliveryNote,
  };
}

export function storeStockLabel(product) {
  if (product.staffReportedStock == null || !product.stockVerifiedAt)
    return "Stock has not been verified; ask the office";
  const count = product.staffReportedStock;
  return `Staff-reported: ${count} at last review (${product.stockVerifiedAt}). Not reserved or guaranteed.`;
}
