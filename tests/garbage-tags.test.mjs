import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  normalizeTagCode,
  normalizeTagSale,
} from "../lib/garbage-tags/core.mjs";

const id = "67cc6908-d944-44a5-a346-fbba4b75c08a";
test("staff sale must include verified receipt evidence and bounded CAD amount", () => {
  assert.equal(
    normalizeTagSale({
      stream: "garbage",
      priceCents: 400,
      receiptReference: "POS-0091",
      saleId: id,
    }).priceCents,
    400,
  );
  assert.throws(() =>
    normalizeTagSale({
      stream: "garbage",
      priceCents: 0,
      receiptReference: "POS-0091",
      saleId: id,
    }),
  );
  assert.throws(() =>
    normalizeTagSale({
      stream: "garbage",
      priceCents: 400,
      receiptReference: "",
      saleId: id,
    }),
  );
  assert.throws(() =>
    normalizeTagSale({
      stream: "unknown",
      priceCents: 400,
      receiptReference: "POS-0091",
      saleId: id,
    }),
  );
});
test("serial codes validate for barcode entry", () => {
  assert.equal(
    normalizeTagCode("gt-abcdef012345abcdef012345"),
    "GT-ABCDEF012345ABCDEF012345",
  );
  assert.throws(() => normalizeTagCode("GT-unverified"));
});
test("schema enforces one redemption and immutable sale evidence with forced RLS", () => {
  const sql = fs.readFileSync(
    new URL(
      "../database/migrations/0106_paid_garbage_tags.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(sql, /garbage_paid_tags_pickup_once_idx/u);
  assert.match(sql, /force row level security/u);
  assert.match(sql, /guard_garbage_tag_update/u);
  assert.match(sql, /garbage\.tags\.sell/u);
  assert.match(sql, /garbage\.tags\.redeem/u);
});
test("redemption is scoped to the matching open pickup and does not invent a charge", () => {
  const code = fs.readFileSync(
    new URL("../lib/garbage-tags/postgres.mjs", import.meta.url),
    "utf8",
  );
  assert.match(code, /for update/u);
  assert.match(code, /p\.accommodation_id !== tag\.accommodation_id/u);
  assert.match(code, /p\.reservation_id !== tag\.reservation_id/u);
  assert.doesNotMatch(
    code,
    /payment\.capture|insert into public\.reservation_payments/u,
  );
});
