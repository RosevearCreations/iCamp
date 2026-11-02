const uuidRx =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
export const stockKinds = Object.freeze([
  "opening_count",
  "receipt",
  "transfer",
  "damage",
  "return",
  "pos_sale",
]);
export const countDecisions = Object.freeze(["accept", "reject"]);
export const posDispositions = Object.freeze(["accepted", "exception_open"]);
const trim = (v) => String(v ?? "").trim();

export function stockUuid(input, label = "ID") {
  const value = trim(input);
  if (!uuidRx.test(value)) throw new Error(`${label} must be a valid UUID.`);
  return value.toLowerCase();
}
function optionalUuid(input, label) {
  return trim(input) ? stockUuid(input, label) : null;
}
function text(input, label, min, max) {
  const v = trim(input);
  if (v.length < min || v.length > max)
    throw new Error(`${label} must be ${min}–${max} characters.`);
  return v;
}
function integer(input, label, min, max) {
  if (trim(input) === "") throw new Error(`${label} is required.`);
  const v = Number(input);
  if (!Number.isSafeInteger(v) || v < min || v > max)
    throw new Error(`${label} must be ${min}–${max}.`);
  return v;
}
export function normalizeStockLocation(input) {
  const code = trim(input?.locationCode).toLowerCase();
  if (!/^[a-z0-9][a-z0-9_-]{1,39}$/u.test(code))
    throw new Error("Stock location code must be 2–40 lowercase characters.");
  return {
    id: stockUuid(input?.id, "Location ID"),
    locationCode: code,
    displayName: text(input?.displayName, "Location name", 3, 90),
  };
}
export function normalizeReorderRule(input) {
  const reorderPoint = integer(input?.reorderPoint, "Reorder point", 0, 999999);
  const targetQuantity = integer(
    input?.targetQuantity,
    "Reorder target",
    1,
    999999,
  );
  if (targetQuantity <= reorderPoint)
    throw new Error("Reorder target must exceed the reorder point.");
  return {
    productId: stockUuid(input?.productId, "Product ID"),
    expectedVersion: integer(
      input?.expectedVersion,
      "Rule version",
      0,
      99999999,
    ),
    reorderPoint,
    targetQuantity,
  };
}
export function normalizeStockOperation(input) {
  const kind = trim(input?.kind);
  if (!stockKinds.includes(kind))
    throw new Error("Stock movement type is invalid.");
  const targetLocationId = optionalUuid(
    input?.targetLocationId,
    "Transfer destination",
  );
  const targetVersion =
    kind === "transfer"
      ? integer(input?.targetVersion, "Destination stock version", 0, 99999999)
      : null;
  if ((kind === "transfer") !== Boolean(targetLocationId))
    throw new Error("Paired transfer requires a destination location.");
  const posSessionId = optionalUuid(input?.posSessionId, "POS session");
  const expectedCashCents =
    kind === "pos_sale"
      ? integer(
          input?.expectedCashCents,
          "Unsettled POS amount (cents)",
          1,
          100000000,
        )
      : null;
  if (kind === "pos_sale" && !posSessionId)
    throw new Error("POS sale requires an open register session.");
  if (kind !== "pos_sale" && (posSessionId || trim(input?.expectedCashCents)))
    throw new Error("Register bookkeeping is only valid for POS sale entries.");
  if (kind !== "transfer" && trim(input?.targetVersion))
    throw new Error("Destination version is only valid for paired transfers.");
  const locationId = stockUuid(input?.locationId, "Stock location");
  if (locationId === targetLocationId)
    throw new Error("Transfer destination must differ from source location.");
  return {
    id: stockUuid(input?.id, "Movement ID"),
    productId: stockUuid(input?.productId, "Product ID"),
    locationId,
    kind,
    quantity: integer(input?.quantity, "Quantity", 1, 9999),
    expectedVersion: integer(
      input?.expectedVersion,
      "Stock version",
      0,
      99999999,
    ),
    targetLocationId,
    targetVersion,
    posSessionId,
    expectedCashCents,
    sourceReference: text(input?.sourceReference, "Source reference", 8, 180),
    reasonNote: text(input?.reasonNote, "Movement explanation", 12, 800),
  };
}
export function normalizePosOpen(input) {
  const registerCode = trim(input?.registerCode).toLowerCase();
  if (!/^[a-z0-9][a-z0-9_-]{1,39}$/u.test(registerCode))
    throw new Error("Register code must be 2–40 lowercase characters.");
  return {
    id: stockUuid(input?.id, "POS session ID"),
    registerCode,
    openingCashCents: integer(
      input?.openingCashCents,
      "Opening observed cash (cents)",
      0,
      100000000,
    ),
  };
}
export function normalizePosClose(input) {
  return {
    sessionId: stockUuid(input?.sessionId, "POS session"),
    expectedVersion: integer(
      input?.expectedVersion,
      "Register version",
      1,
      99999999,
    ),
    observedCashCents: integer(
      input?.observedCashCents,
      "Observed closing cash (cents)",
      0,
      100000000,
    ),
    note: text(input?.note, "Closing observation", 12, 500),
  };
}
export function normalizeStockCount(input) {
  return {
    id: stockUuid(input?.id, "Count ID"),
    productId: stockUuid(input?.productId, "Product ID"),
    locationId: stockUuid(input?.locationId, "Stock location"),
    observedQuantity: integer(
      input?.observedQuantity,
      "Physical count",
      0,
      999999,
    ),
    sourceReference: text(input?.sourceReference, "Count source", 8, 180),
    reasonNote: text(input?.reasonNote, "Count explanation", 12, 800),
  };
}
export function normalizeCountReview(input) {
  const decision = trim(input?.decision);
  if (!countDecisions.includes(decision))
    throw new Error("Count review decision is invalid.");
  return {
    id: stockUuid(input?.id, "Review ID"),
    countId: stockUuid(input?.countId, "Physical count ID"),
    adjustmentEventId: stockUuid(
      input?.adjustmentEventId,
      "Adjustment event ID",
    ),
    decision,
    reasonNote: text(input?.reasonNote, "Review reasoning", 12, 800),
  };
}
export function normalizePosReview(input) {
  const disposition = trim(input?.disposition);
  if (!posDispositions.includes(disposition))
    throw new Error("POS review disposition is invalid.");
  return {
    id: stockUuid(input?.id, "Review ID"),
    sessionId: stockUuid(input?.sessionId, "POS session"),
    disposition,
    reasonNote: text(input?.reasonNote, "Review reasoning", 12, 800),
  };
}
export function reorderSuggestions(products, balances, rules) {
  const total = new Map();
  const initialized = new Set();
  for (const b of balances) {
    if (b.rowVersion > 0) {
      total.set(b.productId, (total.get(b.productId) ?? 0) + b.quantityOnHand);
      initialized.add(b.productId);
    }
  }
  const byId = new Map(products.map((p) => [p.id, p]));
  return rules.map((rule) => {
    const quantity = total.get(rule.productId) ?? 0;
    const hasLedger = initialized.has(rule.productId);
    return {
      ...rule,
      productName: byId.get(rule.productId)?.name ?? "Restricted product",
      quantity: hasLedger ? quantity : null,
      suggestedQuantity:
        hasLedger && quantity <= rule.reorderPoint
          ? rule.targetQuantity - quantity
          : 0,
      needsOpeningCount: !hasLedger,
    };
  });
}
