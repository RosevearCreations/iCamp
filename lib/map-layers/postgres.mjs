import pg from "pg";

import { appendAuditEvent } from "../audit/postgres.mjs";
import { hasCampgroundPermission } from "../authz/postgres.mjs";
import {
  mapLayerDefinitions,
  validateLayerDisplayName,
  validateLayerIconKey,
  validateLayerVisibilityPermissionKey,
} from "./config.mjs";

const { Pool } = pg;
let pool;

function databaseUrl() {
  const value = process.env.DATABASE_URL?.trim();
  if (!value)
    throw new Error("DATABASE_URL is required for map layer operations.");
  return value;
}

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: databaseUrl(),
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
  }
  return pool;
}

export async function closeMapLayerPoolForTests() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

async function assertPermission(userId, campgroundId, permissionKey) {
  if (!(await hasCampgroundPermission(userId, campgroundId, permissionKey))) {
    throw new Error("Not authorized for this campground map layer operation.");
  }
}

function mapLayer(row) {
  return {
    id: row.id,
    organizationId: row.organization_id,
    campgroundId: row.campground_id,
    key: row.layer_key,
    displayName: row.display_name,
    iconKey: row.icon_key,
    sortOrder: Number(row.sort_order),
    visibilityPermissionKey: row.visibility_permission_key,
    isEnabled: row.is_enabled === true,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    rowVersion: Number(row.row_version),
  };
}

async function ensureDefaultMapLayers(client, campgroundId) {
  const scope = await client.query(
    `select organization_id
     from public.campgrounds
     where id = $1
     limit 1`,
    [campgroundId],
  );
  if (scope.rowCount !== 1) throw new Error("Campground is unavailable.");
  const organizationId = scope.rows[0].organization_id;

  for (const layer of mapLayerDefinitions) {
    await client.query(
      `insert into icamp_private.campground_map_layers (
         organization_id,
         campground_id,
         layer_key,
         display_name,
         icon_key,
         sort_order,
         visibility_permission_key
       )
       values ($1, $2, $3, $4, $5, $6, $7)
       on conflict (campground_id, layer_key) do nothing`,
      [
        organizationId,
        campgroundId,
        layer.key,
        layer.displayName,
        layer.iconKey,
        layer.sortOrder,
        layer.visibilityPermissionKey,
      ],
    );
  }
}

export async function listMapLayers(userId, campgroundId) {
  await assertPermission(userId, campgroundId, "campground.map");
  const client = await getPool().connect();
  try {
    await client.query("begin");
    await ensureDefaultMapLayers(client, campgroundId);
    const result = await client.query(
      `select *
       from icamp_private.campground_map_layers
       where campground_id = $1
       order by sort_order, display_name, layer_key`,
      [campgroundId],
    );
    await client.query("commit");

    const allowed = [];
    for (const row of result.rows) {
      if (
        await hasCampgroundPermission(
          userId,
          campgroundId,
          row.visibility_permission_key,
        )
      ) {
        allowed.push(mapLayer(row));
      }
    }
    return allowed;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

async function currentLayer(client, campgroundId, layerId) {
  const result = await client.query(
    `select *
     from icamp_private.campground_map_layers
     where id = $1 and campground_id = $2
     limit 1`,
    [layerId, campgroundId],
  );
  if (result.rowCount !== 1) throw new Error("Map layer is unavailable.");
  return result.rows[0];
}

function assertRowVersion(row, expectedRowVersion) {
  if (Number(row.row_version) !== Number(expectedRowVersion)) {
    throw new Error("Map layer changed. Refresh and try again.");
  }
}

export async function updateMapLayer({
  actorUserId,
  campgroundId,
  layerId,
  expectedRowVersion,
  displayName,
  iconKey,
  visibilityPermissionKey,
  isEnabled,
}) {
  await assertPermission(actorUserId, campgroundId, "campground.configuration");
  const normalizedName = validateLayerDisplayName(displayName);
  const normalizedIcon = validateLayerIconKey(iconKey);
  const normalizedPermission = validateLayerVisibilityPermissionKey(
    visibilityPermissionKey,
  );

  const client = await getPool().connect();
  try {
    await client.query("begin");
    const current = await currentLayer(client, campgroundId, layerId);
    assertRowVersion(current, expectedRowVersion);

    const updated = await client.query(
      `update icamp_private.campground_map_layers
       set display_name = $3,
           icon_key = $4,
           visibility_permission_key = $5,
           is_enabled = $6,
           updated_by_user_id = $7
       where id = $1
         and campground_id = $2
         and row_version = $8
       returning *`,
      [
        layerId,
        campgroundId,
        normalizedName,
        normalizedIcon,
        normalizedPermission,
        Boolean(isEnabled),
        actorUserId,
        expectedRowVersion,
      ],
    );
    if (updated.rowCount !== 1) {
      throw new Error("Map layer changed. Refresh and try again.");
    }

    const saved = updated.rows[0];
    await appendAuditEvent(client, {
      actorUserId,
      organizationId: current.organization_id,
      campgroundId,
      actionKey: "campground.map.layer.update",
      permissionKey: "campground.configuration",
      riskLevel: "elevated",
      subjectType: "campground.map.layer",
      subjectId: layerId,
      beforeState: {
        displayName: current.display_name,
        iconKey: current.icon_key,
        visibilityPermissionKey: current.visibility_permission_key,
        isEnabled: current.is_enabled,
      },
      afterState: {
        displayName: saved.display_name,
        iconKey: saved.icon_key,
        visibilityPermissionKey: saved.visibility_permission_key,
        isEnabled: saved.is_enabled,
      },
    });

    await client.query("commit");
    return mapLayer(saved);
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function moveMapLayer({
  actorUserId,
  campgroundId,
  layerId,
  expectedRowVersion,
  direction,
}) {
  await assertPermission(actorUserId, campgroundId, "campground.configuration");
  if (direction !== "up" && direction !== "down") {
    throw new Error("Map layer move direction is invalid.");
  }

  const client = await getPool().connect();
  try {
    await client.query("begin");
    await ensureDefaultMapLayers(client, campgroundId);
    const rows = (
      await client.query(
        `select *
         from icamp_private.campground_map_layers
         where campground_id = $1
         order by sort_order, display_name, layer_key
         for update`,
        [campgroundId],
      )
    ).rows;
    const index = rows.findIndex((row) => row.id === layerId);
    if (index < 0) throw new Error("Map layer is unavailable.");
    const current = rows[index];
    assertRowVersion(current, expectedRowVersion);
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= rows.length) {
      await client.query("commit");
      return mapLayer(current);
    }
    const target = rows[targetIndex];

    await client.query(
      `update icamp_private.campground_map_layers
       set sort_order = case
         when id = $2 then $4
         when id = $3 then $5
         else sort_order
       end,
       updated_by_user_id = $6
       where campground_id = $1
         and id in ($2, $3)`,
      [
        campgroundId,
        current.id,
        target.id,
        target.sort_order,
        current.sort_order,
        actorUserId,
      ],
    );

    await appendAuditEvent(client, {
      actorUserId,
      organizationId: current.organization_id,
      campgroundId,
      actionKey: "campground.map.layer.reorder",
      permissionKey: "campground.configuration",
      riskLevel: "standard",
      subjectType: "campground.map.layer",
      subjectId: layerId,
      beforeState: { sortOrder: current.sort_order },
      afterState: { sortOrder: target.sort_order, direction },
    });

    const saved = await currentLayer(client, campgroundId, layerId);
    await client.query("commit");
    return mapLayer(saved);
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
