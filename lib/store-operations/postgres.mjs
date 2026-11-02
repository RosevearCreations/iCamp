import pg from "pg";
import { appendAuditEvent } from "../audit/postgres.mjs";
import { hasCampgroundPermission } from "../authz/postgres.mjs";
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
  stockUuid,
} from "./core.mjs";

const { Pool } = pg;
let pool;
function database() {
  if (!pool) {
    if (!process.env.DATABASE_URL?.trim())
      throw new Error("Store operations database unavailable.");
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
    });
  }
  return pool;
}
export async function closeStoreOperationsPoolForTests() {
  if (pool) await pool.end();
  pool = undefined;
}
export async function storeOperationsPermissions(actor, camp) {
  const [read, manage, audit] = await Promise.all(
    ["inventory.read", "inventory.manage", "inventory.audit"].map((key) =>
      hasCampgroundPermission(actor, camp, key),
    ),
  );
  return { read, manage, audit };
}
async function authorize(actor, camp, permissionKey) {
  if (!(await hasCampgroundPermission(actor, camp, permissionKey)))
    throw new Error(
      "Inventory operation requires campground-scoped permission.",
    );
}
async function withActor(actor, camp, fn) {
  stockUuid(actor, "Actor");
  stockUuid(camp, "Campground");
  const client = await database().connect();
  try {
    await client.query("begin");
    const r = await client.query(
      "select id,organization_id,name,timezone from public.campgrounds where id=$1 and lifecycle_state='active'",
      [camp],
    );
    if (r.rowCount !== 1) throw new Error("Active campground unavailable.");
    await client.query("set local role icamp_app");
    await client.query("select set_config('icamp.user_id',$1,true)", [actor]);
    const result = await fn(client, r.rows[0]);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
async function mutate(
  {
    actorUserId,
    actorSessionId,
    campgroundId,
    permissionKey,
    actionKey,
    subjectType,
  },
  fn,
) {
  await authorize(actorUserId, campgroundId, permissionKey);
  return withActor(actorUserId, campgroundId, async (client, campground) => {
    const result = await fn(client, campground);
    if (result.created !== false) {
      await client.query("reset role");
      await appendAuditEvent(client, {
        actorUserId,
        actorSessionId,
        organizationId: campground.organization_id,
        campgroundId,
        actionKey,
        permissionKey,
        subjectType,
        subjectId: result.id,
        riskLevel:
          permissionKey === "inventory.audit" ? "elevated" : "standard",
        metadata: {
          build: 192,
          billing: "held",
          omnichannel: "held",
          ...result.audit,
        },
      });
    }
    return { id: result.id };
  });
}
const iso = (v) => (v ? new Date(v).toISOString() : null);
export async function getStoreOperationsDashboard(actorUserId, campgroundId) {
  const permissions = await storeOperationsPermissions(
    actorUserId,
    campgroundId,
  );
  if (!Object.values(permissions).some(Boolean))
    throw new Error("Inventory read permission required.");
  return withActor(actorUserId, campgroundId, async (client, campground) => {
    const queries = [
      "select id,sku,name,staff_reported_stock from icamp_private.store_catalog_products where campground_id=$1 order by name limit 250",
      "select * from icamp_private.store_stock_locations where campground_id=$1 order by display_name limit 150",
      "select * from icamp_private.store_stock_balances where campground_id=$1 limit 800",
      "select * from icamp_private.store_stock_reorder_rules where campground_id=$1 limit 250",
      "select * from icamp_private.store_stock_events where campground_id=$1 order by recorded_at desc,id limit 200",
      "select * from icamp_private.store_pos_sessions where campground_id=$1 order by opened_at desc,id limit 150",
      "select * from icamp_private.store_stock_counts where campground_id=$1 order by counted_at desc,id limit 150",
      "select * from icamp_private.store_stock_count_reviews where campground_id=$1 order by reviewed_at desc limit 150",
      "select * from icamp_private.store_pos_session_reviews where campground_id=$1 order by reviewed_at desc limit 150",
    ];
    const results = [];
    for (const q of queries)
      results.push((await client.query(q, [campgroundId])).rows);
    const [
      productRows,
      locationRows,
      balanceRows,
      ruleRows,
      eventRows,
      sessionRows,
      countRows,
      countReviewRows,
      posReviewRows,
    ] = results;
    const products = productRows.map((r) => ({
      id: r.id,
      sku: r.sku,
      name: r.name,
      staffReportedStock: r.staff_reported_stock,
    }));
    const locations = locationRows.map((r) => ({
      id: r.id,
      locationCode: r.location_code,
      displayName: r.display_name,
    }));
    const balances = balanceRows.map((r) => ({
      productId: r.product_id,
      locationId: r.location_id,
      quantityOnHand: r.quantity_on_hand,
      rowVersion: Number(r.row_version),
      updatedAt: iso(r.updated_at),
    }));
    const rules = ruleRows.map((r) => ({
      productId: r.product_id,
      reorderPoint: r.reorder_point,
      targetQuantity: r.target_quantity,
      rowVersion: Number(r.row_version),
    }));
    const events = eventRows.map((r) => ({
      id: r.id,
      productId: r.product_id,
      locationId: r.location_id,
      kind: r.kind,
      quantityChange: r.quantity_change,
      quantityBefore: r.quantity_before,
      quantityAfter: r.quantity_after,
      transferGroupId: r.transfer_group_id,
      posSessionId: r.pos_session_id,
      expectedCashCents: r.expected_cash_cents,
      sourceReference: r.source_reference,
      reasonNote: r.reason_note,
      actorUserId: r.actor_user_id,
      recordedAt: iso(r.recorded_at),
    }));
    const sessions = sessionRows.map((r) => ({
      id: r.id,
      registerCode: r.register_code,
      status: r.status,
      openedByUserId: r.opened_by_user_id,
      closedByUserId: r.closed_by_user_id,
      openingCashCents: r.opening_cash_cents,
      expectedCashCents: r.expected_cash_cents,
      observedCashCents: r.observed_cash_cents,
      openedAt: iso(r.opened_at),
      closedAt: iso(r.closed_at),
      rowVersion: Number(r.row_version),
      closingNote: r.closing_note,
    }));
    const counts = countRows.map((r) => ({
      id: r.id,
      productId: r.product_id,
      locationId: r.location_id,
      expectedQuantity: r.expected_quantity,
      expectedVersion: Number(r.expected_version),
      observedQuantity: r.observed_quantity,
      sourceReference: r.source_reference,
      reasonNote: r.reason_note,
      countedByUserId: r.counted_by_user_id,
      countedAt: iso(r.counted_at),
    }));
    const countReviews = countReviewRows.map((r) => ({
      id: r.id,
      countId: r.count_id,
      decision: r.decision,
      reasonNote: r.reason_note,
      adjustmentEventId: r.adjustment_event_id,
      reviewedByUserId: r.reviewed_by_user_id,
    }));
    const posReviews = posReviewRows.map((r) => ({
      id: r.id,
      sessionId: r.session_id,
      disposition: r.disposition,
      reasonNote: r.reason_note,
      reviewedByUserId: r.reviewed_by_user_id,
    }));
    return {
      campground: {
        id: campground.id,
        name: campground.name,
        timezone: campground.timezone,
      },
      permissions,
      products,
      locations,
      balances,
      rules,
      events,
      sessions,
      counts,
      countReviews,
      posReviews,
      suggestions: reorderSuggestions(products, balances, rules),
    };
  });
}

export async function createStockLocation({
  actorUserId,
  actorSessionId,
  campgroundId,
  input,
}) {
  const value = normalizeStockLocation(input);
  return mutate(
    {
      actorUserId,
      actorSessionId,
      campgroundId,
      permissionKey: "inventory.manage",
      actionKey: "store.stock.location.create",
      subjectType: "store_stock_location",
    },
    async (client, camp) => {
      const r = await client.query(
        `insert into icamp_private.store_stock_locations(id,organization_id,campground_id,location_code,display_name,created_by_user_id)
      values($1,$2,$3,$4,$5,$6) returning id`,
        [
          value.id,
          camp.organization_id,
          campgroundId,
          value.locationCode,
          value.displayName,
          actorUserId,
        ],
      );
      return { id: r.rows[0].id, audit: { locationCode: value.locationCode } };
    },
  );
}
export async function setStockReorderRule({
  actorUserId,
  actorSessionId,
  campgroundId,
  input,
}) {
  const value = normalizeReorderRule(input);
  return mutate(
    {
      actorUserId,
      actorSessionId,
      campgroundId,
      permissionKey: "inventory.manage",
      actionKey: "store.stock.reorder.rule",
      subjectType: "store_stock_reorder_rule",
    },
    async (client, camp) => {
      const r =
        value.expectedVersion === 0
          ? await client.query(
              `insert into icamp_private.store_stock_reorder_rules(product_id,organization_id,campground_id,reorder_point,target_quantity,updated_by_user_id)
      select p.id,$2,$3,$4,$5,$6 from icamp_private.store_catalog_products p
      where p.id=$1 and p.organization_id=$2 and p.campground_id=$3
      on conflict(product_id) do nothing returning product_id`,
              [
                value.productId,
                camp.organization_id,
                campgroundId,
                value.reorderPoint,
                value.targetQuantity,
                actorUserId,
              ],
            )
          : await client.query(
              `update icamp_private.store_stock_reorder_rules set reorder_point=$1,target_quantity=$2,
      updated_by_user_id=$3,updated_at=statement_timestamp(),row_version=row_version+1
      where product_id=$4 and campground_id=$5 and row_version=$6 returning product_id`,
              [
                value.reorderPoint,
                value.targetQuantity,
                actorUserId,
                value.productId,
                campgroundId,
                value.expectedVersion,
              ],
            );
      if (r.rowCount !== 1)
        throw new Error(
          "Reorder rule changed or product is outside this campground; refresh.",
        );
      return {
        id: r.rows[0].product_id,
        audit: {
          reorderPoint: value.reorderPoint,
          targetQuantity: value.targetQuantity,
        },
      };
    },
  );
}
export async function openStorePosSession({
  actorUserId,
  actorSessionId,
  campgroundId,
  input,
}) {
  const value = normalizePosOpen(input);
  return mutate(
    {
      actorUserId,
      actorSessionId,
      campgroundId,
      permissionKey: "inventory.manage",
      actionKey: "store.pos.session.open",
      subjectType: "store_pos_session",
    },
    async (client, camp) => {
      const r = await client.query(
        `insert into icamp_private.store_pos_sessions(id,organization_id,campground_id,register_code,opening_cash_cents,opened_by_user_id)
      values($1,$2,$3,$4,$5,$6) returning id`,
        [
          value.id,
          camp.organization_id,
          campgroundId,
          value.registerCode,
          value.openingCashCents,
          actorUserId,
        ],
      );
      return { id: r.rows[0].id, audit: { registerCode: value.registerCode } };
    },
  );
}
export async function recordStoreStockOperation({
  actorUserId,
  actorSessionId,
  campgroundId,
  input,
}) {
  const value = normalizeStockOperation(input);
  return mutate(
    {
      actorUserId,
      actorSessionId,
      campgroundId,
      permissionKey: "inventory.manage",
      actionKey: "store.stock.movement.post",
      subjectType: "store_stock_event",
    },
    async (client) => {
      const r = await client.query(
        `select * from icamp_private.post_store_stock_operation($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [
          campgroundId,
          value.id,
          value.productId,
          value.locationId,
          value.kind,
          value.quantity,
          value.expectedVersion,
          value.sourceReference,
          value.reasonNote,
          value.targetLocationId,
          value.targetVersion,
          value.posSessionId,
          value.expectedCashCents,
        ],
      );
      return {
        id: r.rows[0].event_id,
        created: r.rows[0].created,
        audit: {
          kind: value.kind,
          quantity: value.quantity,
          sourceReference: value.sourceReference,
        },
      };
    },
  );
}
export async function recordStoreStockCount({
  actorUserId,
  actorSessionId,
  campgroundId,
  input,
}) {
  const value = normalizeStockCount(input);
  return mutate(
    {
      actorUserId,
      actorSessionId,
      campgroundId,
      permissionKey: "inventory.manage",
      actionKey: "store.stock.count.record",
      subjectType: "store_stock_count",
    },
    async (client, camp) => {
      const r = await client.query(
        `insert into icamp_private.store_stock_counts(id,organization_id,campground_id,product_id,location_id,
      expected_quantity,expected_version,observed_quantity,source_reference,reason_note,counted_by_user_id)
      values($1,$2,$3,$4,$5,0,1,$6,$7,$8,$9) returning id,expected_quantity,expected_version`,
        [
          value.id,
          camp.organization_id,
          campgroundId,
          value.productId,
          value.locationId,
          value.observedQuantity,
          value.sourceReference,
          value.reasonNote,
          actorUserId,
        ],
      );
      return {
        id: r.rows[0].id,
        audit: {
          sourceReference: value.sourceReference,
          expectedVersion: Number(r.rows[0].expected_version),
        },
      };
    },
  );
}
export async function reviewStoreStockCount({
  actorUserId,
  actorSessionId,
  campgroundId,
  input,
}) {
  const value = normalizeCountReview(input);
  return mutate(
    {
      actorUserId,
      actorSessionId,
      campgroundId,
      permissionKey: "inventory.audit",
      actionKey: "store.stock.count.review",
      subjectType: "store_stock_count_review",
    },
    async (client) => {
      const r = await client.query(
        `select * from icamp_private.review_store_stock_count($1,$2,$3,$4,$5,$6)`,
        [
          campgroundId,
          value.countId,
          value.id,
          value.decision,
          value.reasonNote,
          value.adjustmentEventId,
        ],
      );
      return {
        id: r.rows[0].review_id,
        audit: {
          decision: value.decision,
          countId: value.countId,
          adjustmentId: r.rows[0].adjustment_id,
        },
      };
    },
  );
}
export async function closeStorePosSession({
  actorUserId,
  actorSessionId,
  campgroundId,
  input,
}) {
  const value = normalizePosClose(input);
  return mutate(
    {
      actorUserId,
      actorSessionId,
      campgroundId,
      permissionKey: "inventory.manage",
      actionKey: "store.pos.session.close",
      subjectType: "store_pos_session",
    },
    async (client) => {
      const r = await client.query(
        `select * from icamp_private.close_store_pos_session($1,$2,$3,$4,$5)`,
        [
          campgroundId,
          value.sessionId,
          value.expectedVersion,
          value.observedCashCents,
          value.note,
        ],
      );
      return {
        id: r.rows[0].session_id,
        audit: { varianceCents: Number(r.rows[0].variance_cents) },
      };
    },
  );
}
export async function reviewStorePosSession({
  actorUserId,
  actorSessionId,
  campgroundId,
  input,
}) {
  const value = normalizePosReview(input);
  return mutate(
    {
      actorUserId,
      actorSessionId,
      campgroundId,
      permissionKey: "inventory.audit",
      actionKey: "store.pos.session.independent_review",
      subjectType: "store_pos_session_review",
    },
    async (client, camp) => {
      const r = await client.query(
        `insert into icamp_private.store_pos_session_reviews(id,organization_id,campground_id,session_id,disposition,reason_note,reviewed_by_user_id)
      values($1,$2,$3,$4,$5,$6,$7) returning id`,
        [
          value.id,
          camp.organization_id,
          campgroundId,
          value.sessionId,
          value.disposition,
          value.reasonNote,
          actorUserId,
        ],
      );
      return {
        id: r.rows[0].id,
        audit: { sessionId: value.sessionId, disposition: value.disposition },
      };
    },
  );
}
