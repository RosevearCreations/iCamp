import pg from "pg";

import { appendAuditEvent } from "../audit/postgres.mjs";
import { hasCampgroundPermission } from "../authz/postgres.mjs";
import { validateServiceCatalogEntry } from "./catalog-editor.mjs";

const { Pool } = pg;
let pool;

function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL?.trim();
    if (!connectionString)
      throw new Error("DATABASE_URL is required for booking services.");
    pool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
  }
  return pool;
}

async function assertPricingManager(userId, campgroundId) {
  if (
    !(await hasCampgroundPermission(userId, campgroundId, "pricing.manage"))
  ) {
    throw new Error("Not authorized to manage campground services.");
  }
}

async function beginScoped(client, userId) {
  await client.query("begin");
  await client.query("set local role icamp_app");
  await client.query("select set_config('icamp.user_id', $1, true)", [userId]);
}

async function campgroundScope(client, campgroundId) {
  const result = await client.query(
    "select organization_id, id, name from public.campgrounds where id = $1 and lifecycle_state = 'active' limit 1",
    [campgroundId],
  );
  if (result.rowCount !== 1) throw new Error("Campground is unavailable.");
  return result.rows[0];
}

function dateText(date) {
  if (!date) return null;
  return date instanceof Date
    ? date.toISOString().slice(0, 10)
    : String(date).slice(0, 10);
}

function mapEntry(row) {
  return {
    id: row.id,
    code: row.code,
    displayName: row.display_name,
    description: row.description ?? "",
    chargeKind: row.charge_kind,
    applicationMode: row.application_mode,
    scopeKind: row.scope_kind,
    pricingBasis: row.pricing_basis,
    unitLabel: row.unit_label ?? "item",
    unitPriceCents: Number(row.unit_price_cents ?? 0),
    percentageBasisPoints:
      row.percentage_basis_points === null
        ? null
        : Number(row.percentage_basis_points),
    currencyCode: row.currency_code,
    minimumQuantity: row.minimum_quantity,
    maximumQuantity: row.maximum_quantity,
    startsOn: dateText(row.starts_on),
    endsOn: dateText(row.ends_on),
    isPublic: row.is_public,
    isActive: row.is_active,
    rowVersion: Number(row.row_version),
    editable:
      row.scope_kind === "campground" &&
      row.charge_kind === "add_on" &&
      row.application_mode === "optional" &&
      row.currency_code === "CAD" &&
      ["per_stay", "per_night", "per_unit"].includes(row.pricing_basis) &&
      row.is_active,
  };
}

export async function closeCatalogPoolForTests() {
  if (pool) await pool.end();
  pool = undefined;
}

export async function listCampgroundServiceCatalogue({ userId, campgroundId }) {
  await assertPricingManager(userId, campgroundId);
  const client = await getPool().connect();
  try {
    await beginScoped(client, userId);
    const campground = await campgroundScope(client, campgroundId);
    const result = await client.query(
      `select * from public.booking_charge_catalog
       where organization_id = $1 and campground_id = $2
       order by is_active desc, charge_kind, display_name, code limit 501`,
      [campground.organization_id, campgroundId],
    );
    await client.query("commit");
    return {
      campgroundName: campground.name,
      entries: result.rows.slice(0, 500).map(mapEntry),
      truncated: result.rows.length > 500,
    };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function createCampgroundService({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  ...input
}) {
  await assertPricingManager(actorUserId, campgroundId);
  const entry = validateServiceCatalogEntry(input);
  const client = await getPool().connect();
  try {
    await beginScoped(client, actorUserId);
    const campground = await campgroundScope(client, campgroundId);
    const result = await client.query(
      `insert into public.booking_charge_catalog (
        organization_id, campground_id, scope_kind, charge_kind, application_mode,
        code, display_name, description, currency_code, pricing_basis,
        unit_price_cents, unit_label, minimum_quantity, maximum_quantity,
        starts_on, ends_on, is_public, created_by_user_id, updated_by_user_id
      ) values (
        $1, $2, 'campground', 'add_on', 'optional',
        $3, $4, $5, 'CAD', $6, $7, $8, $9, $10,
        $11::date, $12::date, $13, $14, $14
      ) returning *`,
      [
        campground.organization_id,
        campgroundId,
        entry.code,
        entry.displayName,
        entry.description,
        entry.pricingBasis,
        entry.unitPriceCents,
        entry.unitLabel,
        entry.minimumQuantity,
        entry.maximumQuantity,
        entry.startsOn,
        entry.endsOn,
        entry.isPublic,
        actorUserId,
      ],
    );
    const saved = mapEntry(result.rows[0]);
    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: campground.organization_id,
      campgroundId,
      actionKey: "campground.booking_service.create",
      permissionKey: "pricing.manage",
      riskLevel: "standard",
      subjectType: "booking_charge_catalog",
      subjectId: saved.id,
      beforeState: null,
      afterState: saved,
    });
    await client.query("commit");
    return saved;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function updateCampgroundService({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  chargeId,
  expectedRowVersion,
  ...input
}) {
  await assertPricingManager(actorUserId, campgroundId);
  if (
    !Number.isInteger(Number(expectedRowVersion)) ||
    Number(expectedRowVersion) < 1
  ) {
    throw new Error("Service version is invalid.");
  }
  const client = await getPool().connect();
  try {
    await beginScoped(client, actorUserId);
    const campground = await campgroundScope(client, campgroundId);
    const existing = await client.query(
      `select * from public.booking_charge_catalog where organization_id = $1
         and campground_id = $2 and id = $3 for update`,
      [campground.organization_id, campgroundId, chargeId],
    );
    if (existing.rowCount !== 1)
      throw new Error("Service is not in the authorized campground.");
    const before = mapEntry(existing.rows[0]);
    if (!before.editable)
      throw new Error("This charge is read-only or archived.");
    if (before.rowVersion !== Number(expectedRowVersion)) {
      throw new Error(
        "Service changed since the page loaded. Refresh and retry.",
      );
    }
    const entry = validateServiceCatalogEntry({ ...input, code: before.code });
    const result = await client.query(
      `update public.booking_charge_catalog set
          display_name = $4, description = $5, pricing_basis = $6,
          unit_price_cents = $7, unit_label = $8, minimum_quantity = $9,
          maximum_quantity = $10, starts_on = $11::date, ends_on = $12::date,
          is_public = $13, updated_by_user_id = $14
        where organization_id = $1 and campground_id = $2 and id = $3
          and row_version = $15 and is_active = true
        returning *`,
      [
        campground.organization_id,
        campgroundId,
        chargeId,
        entry.displayName,
        entry.description,
        entry.pricingBasis,
        entry.unitPriceCents,
        entry.unitLabel,
        entry.minimumQuantity,
        entry.maximumQuantity,
        entry.startsOn,
        entry.endsOn,
        entry.isPublic,
        actorUserId,
        before.rowVersion,
      ],
    );
    if (result.rowCount !== 1)
      throw new Error(
        "Service changed since the page loaded. Refresh and retry.",
      );
    const saved = mapEntry(result.rows[0]);
    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: campground.organization_id,
      campgroundId,
      actionKey: "campground.booking_service.update",
      permissionKey: "pricing.manage",
      riskLevel: "standard",
      subjectType: "booking_charge_catalog",
      subjectId: chargeId,
      beforeState: before,
      afterState: saved,
    });
    await client.query("commit");
    return saved;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function archiveCampgroundService({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  chargeId,
  expectedRowVersion,
}) {
  await assertPricingManager(actorUserId, campgroundId);
  if (
    !Number.isInteger(Number(expectedRowVersion)) ||
    Number(expectedRowVersion) < 1
  ) {
    throw new Error("Service version is invalid.");
  }
  const client = await getPool().connect();
  try {
    await beginScoped(client, actorUserId);
    const campground = await campgroundScope(client, campgroundId);
    const existing = await client.query(
      `select * from public.booking_charge_catalog where organization_id = $1
         and campground_id = $2 and id = $3 for update`,
      [campground.organization_id, campgroundId, chargeId],
    );
    if (existing.rowCount !== 1)
      throw new Error("Service is not in the authorized campground.");
    const before = mapEntry(existing.rows[0]);
    if (!before.editable || before.rowVersion !== Number(expectedRowVersion)) {
      throw new Error("Service has changed or is not available for archiving.");
    }
    const result = await client.query(
      `update public.booking_charge_catalog set is_active = false,
       archived_at = statement_timestamp(), updated_by_user_id = $4,
       is_public = false
       where organization_id = $1 and campground_id = $2 and id = $3
         and row_version = $5 and is_active = true returning *`,
      [
        campground.organization_id,
        campgroundId,
        chargeId,
        actorUserId,
        before.rowVersion,
      ],
    );
    if (result.rowCount !== 1)
      throw new Error("Service changed since the page loaded.");
    const saved = mapEntry(result.rows[0]);
    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: campground.organization_id,
      campgroundId,
      actionKey: "campground.booking_service.archive",
      permissionKey: "pricing.manage",
      riskLevel: "standard",
      subjectType: "booking_charge_catalog",
      subjectId: chargeId,
      beforeState: before,
      afterState: saved,
    });
    await client.query("commit");
    return saved;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
