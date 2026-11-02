import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  normalizeCountReview,
  normalizePosClose,
  normalizePosOpen,
  normalizePosReview,
  normalizeReorderRule,
  normalizeStockCount,
  normalizeStockLocation,
  normalizeStockOperation,
  reorderSuggestions,
} from "../lib/store-operations/core.mjs";

const id = (v) => `00000192-0000-4000-8000-${String(v).padStart(12, "0")}`;
const movement = {
  id: id(1),
  productId: id(2),
  locationId: id(3),
  kind: "receipt",
  quantity: 5,
  expectedVersion: 0,
  sourceReference: "source-docket-192",
  reasonNote: "Staff physically checked incoming goods",
};
const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
test("Build192 normalizes source-backed stock movements with explicit versions", () => {
  assert.deepEqual(normalizeStockOperation(movement), {
    ...movement,
    targetLocationId: null,
    targetVersion: null,
    posSessionId: null,
    expectedCashCents: null,
  });
  assert.throws(
    () => normalizeStockOperation({ ...movement, quantity: -1 }),
    /Quantity/,
  );
  assert.throws(
    () => normalizeStockOperation({ ...movement, expectedVersion: "" }),
    /Stock version/,
  );
  assert.throws(
    () => normalizeStockOperation({ ...movement, reasonNote: "bad" }),
    /Movement explanation/,
  );
  assert.throws(
    () => normalizeStockOperation({ ...movement, kind: "settlement" }),
    /type is invalid/,
  );
  assert.throws(
    () =>
      normalizeStockOperation({
        ...movement,
        kind: "opening_count",
        quantity: 0,
      }),
    /Quantity/,
  );
});
test("Build192 transfers require two distinct locations and optimistic destination version", () => {
  const pair = normalizeStockOperation({
    ...movement,
    kind: "transfer",
    targetLocationId: id(4),
    targetVersion: 0,
  });
  assert.equal(pair.targetLocationId, id(4));
  assert.equal(pair.targetVersion, 0);
  assert.throws(
    () => normalizeStockOperation({ ...movement, kind: "transfer" }),
    /Destination stock version|Paired transfer/,
  );
  assert.throws(
    () =>
      normalizeStockOperation({
        ...movement,
        kind: "transfer",
        targetLocationId: id(3),
        targetVersion: 0,
      }),
    /must differ/,
  );
  assert.throws(
    () =>
      normalizeStockOperation({
        ...movement,
        kind: "receipt",
        targetLocationId: id(4),
      }),
    /Paired transfer/,
  );
});
test("Build192 POS stock issue requires session and explicitly unsettled amount", () => {
  const sale = normalizeStockOperation({
    ...movement,
    kind: "pos_sale",
    posSessionId: id(5),
    expectedCashCents: 1250,
  });
  assert.equal(sale.expectedCashCents, 1250);
  assert.throws(
    () =>
      normalizeStockOperation({
        ...movement,
        kind: "pos_sale",
        expectedCashCents: 1250,
      }),
    /open register/,
  );
  assert.throws(
    () =>
      normalizeStockOperation({
        ...movement,
        kind: "pos_sale",
        posSessionId: id(5),
        expectedCashCents: 0,
      }),
    /Unsettled POS amount/,
  );
  assert.throws(
    () =>
      normalizeStockOperation({
        ...movement,
        kind: "receipt",
        posSessionId: id(5),
      }),
    /Register bookkeeping/,
  );
  assert.deepEqual(
    normalizePosOpen({
      id: id(6),
      registerCode: "FRONT_DESK",
      openingCashCents: 0,
    }),
    { id: id(6), registerCode: "front_desk", openingCashCents: 0 },
  );
  assert.throws(
    () =>
      normalizePosOpen({ id: id(6), registerCode: "D", openingCashCents: 0 }),
    /Register code/,
  );
  assert.equal(
    normalizePosClose({
      sessionId: id(6),
      expectedVersion: 1,
      observedCashCents: 50,
      note: "Manually observed till",
    }).observedCashCents,
    50,
  );
});
test("Build192 physical counts and independent review decisions have strict boundaries", () => {
  assert.equal(
    normalizeStockCount({
      id: id(7),
      productId: id(2),
      locationId: id(3),
      observedQuantity: 0,
      sourceReference: "count-sheet-192",
      reasonNote: "Second counter checks zero",
    }).observedQuantity,
    0,
  );
  assert.throws(
    () =>
      normalizeStockCount({
        id: id(7),
        productId: id(2),
        locationId: id(3),
        observedQuantity: 1,
        sourceReference: "short",
        reasonNote: "Second counter checks zero",
      }),
    /Count source/,
  );
  assert.equal(
    normalizeCountReview({
      id: id(8),
      countId: id(7),
      adjustmentEventId: id(9),
      decision: "accept",
      reasonNote: "Independent source verified",
    }).decision,
    "accept",
  );
  assert.throws(
    () =>
      normalizeCountReview({
        id: id(8),
        countId: id(7),
        adjustmentEventId: id(9),
        decision: "auto_approve",
        reasonNote: "Independent source verified",
      }),
    /decision is invalid/,
  );
  assert.equal(
    normalizePosReview({
      id: id(10),
      sessionId: id(6),
      disposition: "exception_open",
      reasonNote: "Cash variance still unresolved",
    }).disposition,
    "exception_open",
  );
});
test("Build192 physical locations and reorder suggestions require actual ledger evidence", () => {
  assert.deepEqual(
    normalizeStockLocation({
      id: id(3),
      locationCode: "SALES_FLOOR",
      displayName: "Sales floor",
    }),
    { id: id(3), locationCode: "sales_floor", displayName: "Sales floor" },
  );
  const rule = normalizeReorderRule({
    productId: id(2),
    expectedVersion: 0,
    reorderPoint: 3,
    targetQuantity: 12,
  });
  assert.throws(
    () =>
      normalizeReorderRule({
        productId: id(2),
        expectedVersion: 0,
        reorderPoint: 12,
        targetQuantity: 12,
      }),
    /must exceed/,
  );
  const products = [{ id: id(2), name: "Firewood" }],
    rules = [rule];
  const missing = reorderSuggestions(products, [], rules)[0];
  assert.equal(missing.quantity, null);
  assert.equal(missing.needsOpeningCount, true);
  assert.equal(missing.suggestedQuantity, 0);
  const found = reorderSuggestions(
    products,
    [{ productId: id(2), rowVersion: 1, quantityOnHand: 2 }],
    rules,
  )[0];
  assert.equal(found.quantity, 2);
  assert.equal(found.suggestedQuantity, 10);
});
test("Build192 contracts require immutable, permission-scoped, no-settlement operations", () => {
  const migration = read(
    "../database/migrations/0205_build192_store_stock_pos_sessions.sql",
  );
  const backend = read("../lib/store-operations/postgres.mjs");
  const page = read(
    "../app/workspaces/management/campgrounds/store/operations/page.tsx",
  );
  const actions = read(
    "../app/workspaces/management/campgrounds/store/operations/actions.ts",
  );
  for (const fragment of [
    "force row level security",
    "pg_advisory_xact_lock",
    "Insufficient available stock",
    "store_pos_one_open_register_idx",
    "store_guard_immutable",
    "review_store_stock_count",
    "POS close requires a different authorized reviewer",
    "store_products_staff_stock_read",
  ])
    assert.ok(migration.includes(fragment), fragment);
  assert.ok(backend.includes("appendAuditEvent"));
  assert.ok(backend.includes("reset role"));
  assert.ok(
    page
      .replace(/\s+/gu, " ")
      .includes(
        "Billing, payments, supplier purchases and Omnichannel remain HELD",
      ),
  );
  assert.ok(actions.includes("requireStaff"));
  assert.equal(
    /stripe\.charges\.create|capturePayment|processPayment/iu.test(
      backend + actions,
    ),
    false,
  );
});
