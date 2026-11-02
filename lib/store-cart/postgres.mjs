import pg from "pg";

import { appendAuditEvent } from "../audit/postgres.mjs";
import { hasCampgroundPermission } from "../authz/postgres.mjs";
import {
  normalizeStoreDelivery,
  normalizeStoreProduct,
  storeQuantity,
  storeUuid,
} from "./core.mjs";

const { Pool } = pg;
let pool;

function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL?.trim();
    if (!connectionString) throw new Error("Store database is unavailable.");
    pool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
  }
  return pool;
}

export async function closeStorePoolForTests() {
  if (pool) await pool.end();
  pool = undefined;
}

async function transaction(work) {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const result = await work(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

const day = (value) =>
  value == null
    ? null
    : value instanceof Date
      ? value.toISOString().slice(0, 10)
      : String(value).slice(0, 10);
const timestamp = (value) =>
  value == null ? null : new Date(value).toISOString();

function productRecord(row) {
  return {
    id: row.id,
    campgroundId: row.campground_id,
    campgroundName: row.campground_name,
    campgroundSlug: row.campground_slug,
    sku: row.sku,
    name: row.name,
    description: row.description,
    category: row.category,
    staffReportedStock:
      row.staff_reported_stock == null
        ? null
        : Number(row.staff_reported_stock),
    stockVerifiedAt: timestamp(row.stock_verified_at),
    isPublished: row.is_published,
    rowVersion: Number(row.row_version),
  };
}

function cartRecord(row, lines = []) {
  return {
    id: row.id,
    campgroundId: row.campground_id,
    campgroundName: row.campground_name,
    guestUserId: row.guest_user_id,
    reservationId: row.reservation_id,
    fulfillmentPreference: row.fulfillment_preference,
    deliveryDate: day(row.requested_delivery_date),
    deliveryNote: row.delivery_note,
    reviewState: row.review_state,
    reviewRequestedAt: timestamp(row.review_requested_at),
    reviewedAt: timestamp(row.reviewed_at),
    updatedAt: timestamp(row.updated_at),
    rowVersion: Number(row.row_version),
    lines,
  };
}

function lineRecord(row) {
  return {
    productId: row.product_id,
    quantity: Number(row.quantity),
    productName: row.product_name,
    sku: row.sku,
    isPublished: row.is_published,
    staffReportedStock:
      row.staff_reported_stock == null
        ? null
        : Number(row.staff_reported_stock),
    stockVerifiedAt: timestamp(row.stock_verified_at),
  };
}

async function requireGuest(client, userId) {
  storeUuid(userId, "Guest");
  const result = await client.query(
    `select 1 from icamp_private.user_accounts
     where id=$1 and account_type='guest' and account_state='active'`,
    [userId],
  );
  if (result.rowCount !== 1)
    throw new Error("An active guest account is required.");
}

async function requireManager(userId, campgroundId) {
  storeUuid(campgroundId, "Campground");
  if (
    !(await hasCampgroundPermission(userId, campgroundId, "inventory.manage"))
  )
    throw new Error(
      "Inventory management permission is required for this campground.",
    );
}

async function audit(
  client,
  {
    actorUserId,
    actorSessionId,
    organizationId,
    campgroundId,
    subjectType,
    subjectId,
    actionKey,
    beforeState,
    afterState,
    manager = false,
  },
) {
  await appendAuditEvent(client, {
    actorUserId,
    actorSessionId,
    organizationId,
    campgroundId,
    subjectType,
    subjectId,
    actionKey,
    permissionKey: manager ? "inventory.manage" : null,
    beforeState,
    afterState,
    metadata: { build: 183, billing: "held", omnichannel: "held" },
  });
}

export async function listStoreCampgrounds() {
  const result = await getPool().query(
    `select id,name,slug from public.campgrounds where lifecycle_state='active' order by name,id limit 200`,
  );
  return result.rows.map(({ id, name, slug }) => ({ id, name, slug }));
}

export async function listPublicStoreProducts({
  campgroundSlug = "",
  category = "",
  search = "",
} = {}) {
  const result = await getPool().query(
    `select p.*,c.name campground_name,c.slug campground_slug
     from icamp_private.store_catalog_products p
     join public.campgrounds c on c.id=p.campground_id
     where p.is_published and c.lifecycle_state='active'
       and ($1::text='' or c.slug=$1)
       and ($2::text='' or p.category=$2)
       and ($3::text='' or p.name ilike '%'||$3||'%' or p.description ilike '%'||$3||'%' or p.sku ilike '%'||$3||'%')
     order by c.name,p.name,p.id limit 100`,
    [
      String(campgroundSlug).slice(0, 100),
      String(category).slice(0, 30),
      String(search).trim().slice(0, 100),
    ],
  );
  return result.rows.map(productRecord);
}

export async function listManagedStoreProducts({ userId, campgroundId }) {
  await requireManager(userId, campgroundId);
  const result = await getPool().query(
    `select p.*,c.name campground_name,c.slug campground_slug
     from icamp_private.store_catalog_products p join public.campgrounds c on c.id=p.campground_id
     where p.campground_id=$1 order by p.name,p.id limit 200`,
    [campgroundId],
  );
  return result.rows.map(productRecord);
}

export async function saveStoreProduct({
  actorUserId,
  actorSessionId,
  campgroundId,
  productId,
  expectedRowVersion,
  input,
}) {
  await requireManager(actorUserId, campgroundId);
  if (productId) storeUuid(productId, "Product");
  if (!Number.isSafeInteger(expectedRowVersion) || expectedRowVersion < 0)
    throw new Error("Product version is invalid.");
  const product = normalizeStoreProduct(input);
  return transaction(async (client) => {
    const campground = await client.query(
      `select organization_id from public.campgrounds where id=$1 and lifecycle_state='active' for share`,
      [campgroundId],
    );
    if (campground.rowCount !== 1)
      throw new Error("Active campground was not found.");
    const organizationId = campground.rows[0].organization_id;
    const beforeResult = productId
      ? await client.query(
          `select * from icamp_private.store_catalog_products where id=$1 and campground_id=$2 for update`,
          [productId, campgroundId],
        )
      : null;
    const before = beforeResult?.rows[0] ?? null;
    if (
      (before ? Number(before.row_version) : 0) !== expectedRowVersion ||
      (productId && !before)
    )
      throw new Error(
        "Product changed; refresh and review the latest details.",
      );
    const params = [
      product.sku,
      product.name,
      product.description,
      product.category,
      product.stock,
      product.isPublished,
      actorUserId,
    ];
    const saved = before
      ? await client.query(
          `update icamp_private.store_catalog_products
       set sku=$1,name=$2,description=$3,category=$4,staff_reported_stock=$5,
           stock_verified_at=case when $5::integer is null then null else statement_timestamp() end,
           is_published=$6,reviewed_by_user_id=case when $6 then $7::uuid else null end,
           reviewed_at=case when $6 then statement_timestamp() else null end,updated_by_user_id=$7
       where id=$8 returning *`,
          [...params, productId],
        )
      : await client.query(
          `insert into icamp_private.store_catalog_products
       (organization_id,campground_id,sku,name,description,category,staff_reported_stock,stock_verified_at,
        is_published,reviewed_by_user_id,reviewed_at,created_by_user_id,updated_by_user_id)
       values($1,$2,$3,$4,$5,$6,$7,case when $7::integer is null then null else statement_timestamp() end,
              $8,case when $8 then $9::uuid else null end,case when $8 then statement_timestamp() else null end,$9,$9)
       returning *`,
          [organizationId, campgroundId, ...params],
        );
    const row = saved.rows[0];
    await audit(client, {
      actorUserId,
      actorSessionId,
      organizationId,
      campgroundId,
      actionKey: "store.product.saved",
      subjectType: "store_catalog_product",
      subjectId: row.id,
      manager: true,
      beforeState: before
        ? {
            published: before.is_published,
            rowVersion: Number(before.row_version),
          }
        : null,
      afterState: {
        published: row.is_published,
        stockReviewed: row.staff_reported_stock !== null,
        rowVersion: Number(row.row_version),
      },
    });
    return row.id;
  });
}

async function lockedOwnCart(client, userId, cartId) {
  const result = await client.query(
    `select * from icamp_private.guest_store_cart_drafts where id=$1 and guest_user_id=$2 for update`,
    [cartId, userId],
  );
  if (result.rowCount !== 1) throw new Error("Your saved cart was not found.");
  return result.rows[0];
}

async function resetCartForEditing(client, cartId) {
  await client.query(
    `update icamp_private.guest_store_cart_drafts
     set review_state='draft',review_requested_at=null,reviewed_at=null,reviewed_by_user_id=null,
         fulfillment_preference='office_pickup',reservation_id=null,requested_delivery_date=null
     where id=$1`,
    [cartId],
  );
}

export async function listOwnStoreCarts({ userId }) {
  storeUuid(userId, "Guest");
  return transaction(async (client) => {
    await requireGuest(client, userId);
    const carts = await client.query(
      `select d.*,c.name campground_name from icamp_private.guest_store_cart_drafts d
       join public.campgrounds c on c.id=d.campground_id
       where d.guest_user_id=$1 order by d.updated_at desc,d.id limit 100`,
      [userId],
    );
    const rows = await client.query(
      `select l.*,p.name product_name,p.sku,p.is_published,p.staff_reported_stock,p.stock_verified_at
       from icamp_private.guest_store_cart_lines l
       join icamp_private.store_catalog_products p on p.id=l.product_id
       join icamp_private.guest_store_cart_drafts d on d.id=l.cart_id
       where d.guest_user_id=$1 order by p.name,l.id limit 2000`,
      [userId],
    );
    const byCart = new Map();
    for (const row of rows.rows) {
      const line = lineRecord(row);
      const lines = byCart.get(row.cart_id) ?? [];
      lines.push(line);
      byCart.set(row.cart_id, lines);
    }
    return carts.rows.map((row) => cartRecord(row, byCart.get(row.id) ?? []));
  });
}

export async function addToStoreCart({
  userId,
  actorSessionId,
  campgroundId,
  productId,
  quantity,
}) {
  storeUuid(campgroundId, "Campground");
  storeUuid(productId, "Product");
  const count = storeQuantity(quantity);
  return transaction(async (client) => {
    await requireGuest(client, userId);
    const source = await client.query(
      `select p.organization_id from icamp_private.store_catalog_products p
       join public.campgrounds c on c.id=p.campground_id
       where p.id=$1 and p.campground_id=$2 and p.is_published and c.lifecycle_state='active'`,
      [productId, campgroundId],
    );
    if (source.rowCount !== 1)
      throw new Error(
        "This product is not currently published for this campground.",
      );
    const organizationId = source.rows[0].organization_id;
    await client.query(
      `insert into icamp_private.guest_store_cart_drafts(organization_id,campground_id,guest_user_id)
       values($1,$2,$3) on conflict(guest_user_id,campground_id) do nothing`,
      [organizationId, campgroundId, userId],
    );
    const cartResult = await client.query(
      `select id from icamp_private.guest_store_cart_drafts
       where guest_user_id=$1 and campground_id=$2 for update`,
      [userId, campgroundId],
    );
    const cartId = cartResult.rows[0].id;
    const countResult = await client.query(
      `select count(*)::integer count from icamp_private.guest_store_cart_lines where cart_id=$1`,
      [cartId],
    );
    const existing = await client.query(
      `select 1 from icamp_private.guest_store_cart_lines where cart_id=$1 and product_id=$2`,
      [cartId, productId],
    );
    if (!existing.rowCount && countResult.rows[0].count >= 20)
      throw new Error("A draft can include up to 20 different products.");
    await resetCartForEditing(client, cartId);
    await client.query(
      `insert into icamp_private.guest_store_cart_lines(organization_id,campground_id,cart_id,product_id,quantity)
       values($1,$2,$3,$4,$5)
       on conflict(cart_id,product_id) do update
       set quantity=least(20,icamp_private.guest_store_cart_lines.quantity+excluded.quantity)`,
      [organizationId, campgroundId, cartId, productId, count],
    );
    await audit(client, {
      actorUserId: userId,
      actorSessionId,
      organizationId,
      campgroundId,
      actionKey: "store.cart.item_added",
      subjectType: "store_cart_draft",
      subjectId: cartId,
      afterState: { productId, requestedQuantity: count, status: "draft" },
    });
    return cartId;
  });
}

export async function setStoreCartLineQuantity({
  userId,
  actorSessionId,
  cartId,
  productId,
  quantity,
}) {
  storeUuid(cartId, "Cart");
  storeUuid(productId, "Product");
  const count = storeQuantity(quantity, true);
  return transaction(async (client) => {
    await requireGuest(client, userId);
    const cart = await lockedOwnCart(client, userId, cartId);
    const current = await client.query(
      `select id from icamp_private.guest_store_cart_lines where cart_id=$1 and product_id=$2`,
      [cartId, productId],
    );
    if (!current.rowCount) throw new Error("Cart item was not found.");
    await resetCartForEditing(client, cartId);
    if (count === 0)
      await client.query(
        `delete from icamp_private.guest_store_cart_lines where id=$1`,
        [current.rows[0].id],
      );
    else
      await client.query(
        `update icamp_private.guest_store_cart_lines set quantity=$2 where id=$1`,
        [current.rows[0].id, count],
      );
    await audit(client, {
      actorUserId: userId,
      actorSessionId,
      organizationId: cart.organization_id,
      campgroundId: cart.campground_id,
      actionKey: "store.cart.item_updated",
      subjectType: "store_cart_draft",
      subjectId: cartId,
      afterState: { productId, quantity: count, status: "draft" },
    });
  });
}

export async function saveStoreDeliveryPlan({
  userId,
  actorSessionId,
  cartId,
  input,
  requestReview = false,
}) {
  storeUuid(cartId, "Cart");
  const normalized = normalizeStoreDelivery(input);
  return transaction(async (client) => {
    await requireGuest(client, userId);
    const cart = await lockedOwnCart(client, userId, cartId);
    if (requestReview) {
      const lines = await client.query(
        `select count(*)::integer count from icamp_private.guest_store_cart_lines where cart_id=$1`,
        [cartId],
      );
      if (lines.rows[0].count === 0)
        throw new Error("Add a product before requesting staff review.");
      const unpublished = await client.query(
        `select 1 from icamp_private.guest_store_cart_lines l
         join icamp_private.store_catalog_products p on p.id=l.product_id
         where l.cart_id=$1 and not p.is_published limit 1`,
        [cartId],
      );
      if (unpublished.rowCount)
        throw new Error(
          "A product is no longer published. Remove it before requesting review.",
        );
    }
    const result = await client.query(
      `update icamp_private.guest_store_cart_drafts
       set reservation_id=$2,fulfillment_preference=$3,requested_delivery_date=$4,delivery_note=$5,
           review_state=case when $6 then 'submitted' else 'draft' end,
           review_requested_at=case when $6 then statement_timestamp() else null end,
           reviewed_at=null,reviewed_by_user_id=null
       where id=$1 returning review_state`,
      [
        cartId,
        normalized.reservationId,
        normalized.fulfillmentPreference,
        normalized.deliveryDate,
        normalized.deliveryNote,
        requestReview,
      ],
    );
    await audit(client, {
      actorUserId: userId,
      actorSessionId,
      organizationId: cart.organization_id,
      campgroundId: cart.campground_id,
      actionKey: requestReview
        ? "store.cart.review_requested"
        : "store.cart.delivery_plan_saved",
      subjectType: "store_cart_draft",
      subjectId: cartId,
      afterState: {
        preference: normalized.fulfillmentPreference,
        reservationId: normalized.reservationId,
        deliveryDate: normalized.deliveryDate,
        status: result.rows[0].review_state,
      },
    });
  });
}

export async function listStoreReviewQueue({ userId, campgroundId }) {
  await requireManager(userId, campgroundId);
  const results = await getPool().query(
    `select d.*,c.name campground_name from icamp_private.guest_store_cart_drafts d
     join public.campgrounds c on c.id=d.campground_id
     where d.campground_id=$1 and d.review_state<>'draft'
     order by d.updated_at desc,d.id limit 100`,
    [campgroundId],
  );
  const ids = results.rows.map((row) => row.id);
  if (!ids.length) return [];
  const lines = await getPool().query(
    `select l.*,p.name product_name,p.sku,p.is_published,p.staff_reported_stock,p.stock_verified_at
     from icamp_private.guest_store_cart_lines l join icamp_private.store_catalog_products p on p.id=l.product_id
     where l.cart_id=any($1::uuid[]) order by p.name`,
    [ids],
  );
  const byCart = new Map();
  for (const row of lines.rows) {
    const items = byCart.get(row.cart_id) ?? [];
    items.push(lineRecord(row));
    byCart.set(row.cart_id, items);
  }
  return results.rows.map((row) => cartRecord(row, byCart.get(row.id) ?? []));
}

export async function reviewStoreCart({
  actorUserId,
  actorSessionId,
  campgroundId,
  cartId,
  decision,
}) {
  await requireManager(actorUserId, campgroundId);
  storeUuid(cartId, "Cart");
  if (!["reviewed", "declined"].includes(decision))
    throw new Error("Invalid staff review decision.");
  return transaction(async (client) => {
    const before = await client.query(
      `select * from icamp_private.guest_store_cart_drafts
       where id=$1 and campground_id=$2 for update`,
      [cartId, campgroundId],
    );
    if (before.rowCount !== 1 || before.rows[0].review_state !== "submitted")
      throw new Error("Only pending staff-review requests can be decided.");
    await client.query(
      `update icamp_private.guest_store_cart_drafts
       set review_state=$2,reviewed_by_user_id=$3,reviewed_at=statement_timestamp()
       where id=$1`,
      [cartId, decision, actorUserId],
    );
    await audit(client, {
      actorUserId,
      actorSessionId,
      organizationId: before.rows[0].organization_id,
      campgroundId,
      actionKey: "store.cart.staff_reviewed",
      subjectType: "store_cart_draft",
      subjectId: cartId,
      manager: true,
      beforeState: { status: "submitted" },
      afterState: {
        status: decision,
        fulfillment: false,
        payment: false,
        stockReserved: false,
      },
    });
  });
}
