import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  normalizeStoreDelivery,
  normalizeStoreProduct,
  storeDate,
  storeQuantity,
  storeStockLabel,
  storeUuid,
} from "../lib/store-cart/core.mjs";

const read = (name) => readFileSync(new URL(name, import.meta.url), "utf8");
const id = "67d45c46-7e55-4bb2-8c40-8c8daecc08c0";
const product = {
  sku: "FIREWOOD-1",
  name: "Firewood bundle",
  description: "Campground-reviewed firewood supplies",
  category: "firewood",
  stock: "5",
  isPublished: true,
};

test("Build183 product inputs require staff-attested SKU, category and bounded stock", () => {
  assert.deepEqual(normalizeStoreProduct(product), { ...product, stock: 5 });
  assert.equal(normalizeStoreProduct({ ...product, stock: "" }).stock, null);
  for (const change of [
    { sku: "no spaces" },
    { category: "hidden" },
    { stock: -1 },
    { stock: 10000 },
    { stock: 1.5 },
    { description: "short" },
  ]) {
    assert.throws(() => normalizeStoreProduct({ ...product, ...change }));
  }
});

test("Build183 cart quantities and delivery preference enforce no accidental reservations", () => {
  assert.equal(storeQuantity("20"), 20);
  assert.equal(storeQuantity(0, true), 0);
  for (const quantity of [-1, 0, 21, 1.2, "n/a"])
    assert.throws(() => storeQuantity(quantity));
  assert.deepEqual(
    normalizeStoreDelivery({
      fulfillmentPreference: "office_pickup",
      reservationId: "",
      deliveryDate: "",
      deliveryNote: "Ask at desk",
    }),
    {
      fulfillmentPreference: "office_pickup",
      reservationId: null,
      deliveryDate: null,
      deliveryNote: "Ask at desk",
    },
  );
  assert.deepEqual(
    normalizeStoreDelivery({
      fulfillmentPreference: "campsite_delivery",
      reservationId: id,
      deliveryDate: "2027-07-18",
      deliveryNote: "",
    }),
    {
      fulfillmentPreference: "campsite_delivery",
      reservationId: id,
      deliveryDate: "2027-07-18",
      deliveryNote: "",
    },
  );
  assert.throws(() => storeDate("2027-02-30"), /date/i);
  assert.throws(() => storeUuid("someone-elses-cart"), /invalid/i);
  assert.throws(
    () =>
      normalizeStoreDelivery({
        fulfillmentPreference: "campsite_delivery",
        reservationId: id,
        deliveryDate: "2027-07-18",
        deliveryNote: "x".repeat(401),
      }),
    /note/i,
  );
});

test("Build183 stock labels are explicitly non-guaranteed and unverified counts stay unknown", () => {
  assert.match(
    storeStockLabel({ staffReportedStock: null, stockVerifiedAt: null }),
    /not been verified/,
  );
  assert.match(
    storeStockLabel({
      staffReportedStock: 0,
      stockVerifiedAt: "2026-11-01T12:00:00Z",
    }),
    /Staff-reported: 0.*Not reserved or guaranteed/,
  );
});

test("Build183 schema scopes catalog and carts, confirms guest stay ownership and forces RLS", () => {
  const sql = read(
    "../database/migrations/0193_build183_store_catalog_cart_drafts.sql",
  );
  assert.match(sql, /store_product_sku_unique unique \(campground_id,sku\)/);
  assert.match(
    sql,
    /guest_store_cart_per_guest_unique unique \(guest_user_id,campground_id\)/,
  );
  assert.match(
    sql,
    /references public\.reservations\(organization_id,campground_id,id\)/,
  );
  assert.match(
    sql,
    /references icamp_private\.store_catalog_products\(organization_id,campground_id,id\)/,
  );
  assert.match(sql, /r\.guest_user_id=new\.guest_user_id/);
  assert.match(sql, /new\.requested_delivery_date>=r\.arrival_date/);
  assert.match(sql, /new\.requested_delivery_date<r\.departure_date/);
  assert.match(sql, /review_state='submitted'.*not exists/s);
  assert.equal((sql.match(/force row level security/g) ?? []).length, 3);
  assert.match(sql, /guest_store_lines_no_direct_access/);
  assert.match(sql, /revoke all on icamp_private\.store_catalog_products/);
  const indexes = read(
    "../database/migrations/0194_build183_store_fk_index_hardening.sql",
  );
  for (const index of [
    "store_products_created_by_fk_idx",
    "store_products_reviewed_by_fk_idx",
    "store_products_updated_by_fk_idx",
    "guest_store_carts_reviewed_by_fk_idx",
    "guest_store_cart_lines_scoped_cart_fk_idx",
  ])
    assert.match(indexes, new RegExp(index));
});

test("Build183 authorization, audited writes and no financial or external fulfillment calls", () => {
  const db = read("../lib/store-cart/postgres.mjs");
  const guest = read("../app/guest/store/actions.ts");
  const manager = read(
    "../app/workspaces/management/campgrounds/store/actions.ts",
  );
  assert.match(
    db,
    /hasCampgroundPermission\(userId, campgroundId, "inventory\.manage"\)/,
  );
  assert.match(db, /and guest_user_id=\$2 for update/);
  assert.match(db, /and p\.is_published/);
  assert.match(db, /appendAuditEvent/);
  assert.match(db, /on conflict\(guest_user_id,campground_id\) do nothing/);
  assert.match(guest, /requireSignedIn\(path\)/);
  assert.match(guest, /accountType !== "guest"/);
  assert.match(manager, /"inventory\.manage"/);
  assert.doesNotMatch(
    db,
    /fetch\(|stripe|capturePayment|sendEmail|sendSms|fulfillOrder|dispatchDelivery/i,
  );
});

test("Build183 public, guest and staff pages disclose draft-only boundaries", () => {
  const publicPage = read("../app/store/page.tsx");
  const guest = read("../app/guest/store/page.tsx");
  const staff = read("../app/workspaces/management/campgrounds/store/page.tsx");
  assert.match(
    publicPage,
    /nothing is purchased, charged,\s+reserved or scheduled/,
  );
  assert.match(guest, /Save preference as draft/);
  assert.match(guest, /Request internal staff review/);
  assert.match(
    staff,
    /This queue does not fulfill,\s+reserve, bill or message anyone/,
  );
});
