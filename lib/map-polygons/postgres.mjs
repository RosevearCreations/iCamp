import pg from "pg";

import { appendAuditEvent } from "../audit/postgres.mjs";
import { hasCampgroundPermission } from "../authz/postgres.mjs";
import {
  validateMapLabel,
  validatePolygonIconKey,
} from "../map-layers/config.mjs";
import { validateStoredMapPolygon } from "./geometry.mjs";

const { Pool } = pg;
let pool;

function databaseUrl() {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) {
    throw new Error("DATABASE_URL is required for map polygon operations.");
  }
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

export async function closeMapPolygonPoolForTests() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

async function assertPermission(client, userId, campgroundId) {
  const result = await client.query(
    "select icamp_private.has_campground_permission($1, $2, 'campground.map') as allowed",
    [userId, campgroundId],
  );
  if (result.rows[0]?.allowed !== true) {
    throw new Error("Not authorized for this campground map operation.");
  }
}

function requiredLabel(value) {
  const label = String(value ?? "").trim();
  if (!label || label.length > 160) {
    throw new Error("Polygon label must be between 1 and 160 characters.");
  }
  return label;
}

function copyLabel(value) {
  const base = String(value ?? "").trim();
  const suffix = " copy";
  return (base.slice(0, 160 - suffix.length) + suffix).trim();
}

function mapPolygon(row) {
  return {
    id: row.id,
    organizationId: row.organization_id,
    campgroundId: row.campground_id,
    mapImageVersionId: row.map_image_version_id,
    label: row.label,
    geometry: row.geometry,
    layerId: row.layer_id,
    layerKey: row.layer_key ?? null,
    layerDisplayName: row.layer_display_name ?? null,
    layerIconKey: row.layer_icon_key ?? null,
    layerSortOrder:
      row.layer_sort_order === undefined ? null : Number(row.layer_sort_order),
    layerVisibilityPermissionKey: row.visibility_permission_key ?? null,
    mapLabel: row.map_label,
    mapIconKey: row.map_icon_key,
    mapLabelVisible: row.map_label_visible === true,
    isLocked: row.is_locked === true,
    isHidden: row.is_hidden === true,
    archivedAt: row.archived_at,
    archivedByUserId: row.archived_by_user_id,
    duplicatedFromPolygonId: row.duplicated_from_polygon_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    rowVersion: Number(row.row_version),
  };
}

async function getLayer(client, campgroundId, layerId) {
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

async function assertLayerVisible(client, userId, campgroundId, layerId) {
  const layer = await getLayer(client, campgroundId, layerId);
  const allowed = await hasCampgroundPermission(
    userId,
    campgroundId,
    layer.visibility_permission_key,
  );
  if (!allowed) {
    throw new Error("Not authorized to view or edit this map layer.");
  }
  return layer;
}

async function getCurrentPolygon(
  client,
  campgroundId,
  mapImageVersionId,
  polygonId,
) {
  const result = await client.query(
    `select *
     from icamp_private.campground_map_polygons
     where id = $1
       and campground_id = $2
       and map_image_version_id = $3
     limit 1`,
    [polygonId, campgroundId, mapImageVersionId],
  );
  if (result.rowCount !== 1) {
    throw new Error("Polygon is unavailable.");
  }
  return result.rows[0];
}

function assertRowVersion(row, expectedRowVersion) {
  if (Number(row.row_version) !== Number(expectedRowVersion)) {
    throw new Error("Polygon changed. Refresh and try again.");
  }
}

export async function listMapPolygons(userId, campgroundId, mapImageVersionId) {
  const client = await getPool().connect();
  try {
    await assertPermission(client, userId, campgroundId);
    const result = await client.query(
      `select
         p.*,
         l.layer_key,
         l.display_name as layer_display_name,
         l.icon_key as layer_icon_key,
         l.sort_order as layer_sort_order,
         l.visibility_permission_key
       from icamp_private.campground_map_polygons p
       join icamp_private.campground_map_layers l
         on l.id = p.layer_id
        and l.organization_id = p.organization_id
        and l.campground_id = p.campground_id
       where p.campground_id = $1
         and p.map_image_version_id = $2
       order by
         l.sort_order,
         (p.archived_at is not null),
         p.is_hidden,
         p.updated_at desc,
         p.label asc`,
      [campgroundId, mapImageVersionId],
    );

    const visible = [];
    for (const row of result.rows) {
      if (
        await hasCampgroundPermission(
          userId,
          campgroundId,
          row.visibility_permission_key,
        )
      ) {
        visible.push(mapPolygon(row));
      }
    }
    return visible;
  } finally {
    client.release();
  }
}

export async function saveMapPolygon({
  actorUserId,
  campgroundId,
  mapImageVersionId,
  polygonId,
  expectedRowVersion,
  label,
  geometry,
  layerId,
  mapLabel,
  mapIconKey,
  mapLabelVisible,
}) {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    await assertPermission(client, actorUserId, campgroundId);

    const versionResult = await client.query(
      `select organization_id, source_width, source_height
       from icamp_private.campground_map_image_versions
       where id = $1 and campground_id = $2
       limit 1`,
      [mapImageVersionId, campgroundId],
    );
    if (versionResult.rowCount !== 1) {
      throw new Error("Active map image version is unavailable.");
    }

    const version = versionResult.rows[0];
    const layer = await assertLayerVisible(
      client,
      actorUserId,
      campgroundId,
      layerId,
    );
    if (layer.organization_id !== version.organization_id) {
      throw new Error("Map layer scope does not match the active map image.");
    }

    const canonicalGeometry = validateStoredMapPolygon(
      geometry,
      Number(version.source_width),
      Number(version.source_height),
    );
    const normalizedLabel = requiredLabel(label);
    const normalizedMapLabel = validateMapLabel(mapLabel);
    const normalizedIconKey = validatePolygonIconKey(mapIconKey);
    let saved;
    let beforeState = null;

    if (polygonId) {
      const current = await getCurrentPolygon(
        client,
        campgroundId,
        mapImageVersionId,
        polygonId,
      );
      assertRowVersion(current, expectedRowVersion);
      if (current.archived_at) {
        throw new Error("Archived polygons must be restored before editing.");
      }
      if (current.is_locked) {
        throw new Error("Locked polygons must be unlocked before editing.");
      }

      beforeState = {
        label: current.label,
        geometry: current.geometry,
        layerId: current.layer_id,
        mapLabel: current.map_label,
        mapIconKey: current.map_icon_key,
        mapLabelVisible: current.map_label_visible,
      };
      const updated = await client.query(
        `update icamp_private.campground_map_polygons
         set label = $4,
             geometry = $5::jsonb,
             updated_by_user_id = $6,
             layer_id = $7,
             map_label = $8,
             map_icon_key = $9,
             map_label_visible = $10
         where id = $1
           and campground_id = $2
           and map_image_version_id = $3
           and row_version = $11
         returning *`,
        [
          polygonId,
          campgroundId,
          mapImageVersionId,
          normalizedLabel,
          JSON.stringify(canonicalGeometry),
          actorUserId,
          layer.id,
          normalizedMapLabel,
          normalizedIconKey,
          Boolean(mapLabelVisible),
          expectedRowVersion,
        ],
      );
      if (updated.rowCount !== 1) {
        throw new Error("Polygon changed. Refresh and try again.");
      }
      saved = updated.rows[0];
    } else {
      const inserted = await client.query(
        `insert into icamp_private.campground_map_polygons (
           organization_id,
           campground_id,
           map_image_version_id,
           label,
           geometry,
           layer_id,
           map_label,
           map_icon_key,
           map_label_visible,
           created_by_user_id,
           updated_by_user_id
         )
         values ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10, $10)
         returning *`,
        [
          version.organization_id,
          campgroundId,
          mapImageVersionId,
          normalizedLabel,
          JSON.stringify(canonicalGeometry),
          layer.id,
          normalizedMapLabel,
          normalizedIconKey,
          Boolean(mapLabelVisible),
          actorUserId,
        ],
      );
      saved = inserted.rows[0];
    }

    await appendAuditEvent(client, {
      actorUserId,
      organizationId: version.organization_id,
      campgroundId,
      actionKey: polygonId
        ? "campground.map.polygon.update"
        : "campground.map.polygon.create",
      permissionKey: "campground.map",
      riskLevel: "standard",
      subjectType: "campground.map.polygon",
      subjectId: saved.id,
      beforeState,
      afterState: {
        label: saved.label,
        vertexCount: canonicalGeometry.vertices.length,
        mapImageVersionId,
        layerId: saved.layer_id,
        mapLabel: saved.map_label,
        mapIconKey: saved.map_icon_key,
        mapLabelVisible: saved.map_label_visible,
      },
    });

    await client.query("commit");
    return mapPolygon(saved);
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function duplicateMapPolygon({
  actorUserId,
  campgroundId,
  mapImageVersionId,
  polygonId,
  expectedRowVersion,
}) {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    await assertPermission(client, actorUserId, campgroundId);
    const current = await getCurrentPolygon(
      client,
      campgroundId,
      mapImageVersionId,
      polygonId,
    );
    assertRowVersion(current, expectedRowVersion);
    await assertLayerVisible(
      client,
      actorUserId,
      campgroundId,
      current.layer_id,
    );

    const inserted = await client.query(
      `insert into icamp_private.campground_map_polygons (
         organization_id,
         campground_id,
         map_image_version_id,
         label,
         geometry,
         layer_id,
         map_label,
         map_icon_key,
         map_label_visible,
         duplicated_from_polygon_id,
         created_by_user_id,
         updated_by_user_id
       )
       values (
         $1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10, $11, $11
       )
       returning *`,
      [
        current.organization_id,
        campgroundId,
        mapImageVersionId,
        copyLabel(current.label),
        JSON.stringify(current.geometry),
        current.layer_id,
        current.map_label,
        current.map_icon_key,
        current.map_label_visible,
        current.id,
        actorUserId,
      ],
    );
    const saved = inserted.rows[0];

    await appendAuditEvent(client, {
      actorUserId,
      organizationId: current.organization_id,
      campgroundId,
      actionKey: "campground.map.polygon.duplicate",
      permissionKey: "campground.map",
      riskLevel: "standard",
      subjectType: "campground.map.polygon",
      subjectId: saved.id,
      beforeState: { duplicatedFromPolygonId: current.id },
      afterState: {
        label: saved.label,
        vertexCount: current.geometry.vertices.length,
        mapImageVersionId,
      },
    });

    await client.query("commit");
    return mapPolygon(saved);
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function setMapPolygonState({
  actorUserId,
  campgroundId,
  mapImageVersionId,
  polygonId,
  expectedRowVersion,
  state,
  enabled,
}) {
  if (!["locked", "hidden", "archived"].includes(state)) {
    throw new Error("Polygon state change is invalid.");
  }

  const client = await getPool().connect();
  try {
    await client.query("begin");
    await assertPermission(client, actorUserId, campgroundId);
    const current = await getCurrentPolygon(
      client,
      campgroundId,
      mapImageVersionId,
      polygonId,
    );
    assertRowVersion(current, expectedRowVersion);

    let updated;
    if (state === "archived") {
      updated = await client.query(
        `update icamp_private.campground_map_polygons
         set archived_at = case when $4::boolean then statement_timestamp() else null end,
             archived_by_user_id = case when $4::boolean then $5 else null end,
             updated_by_user_id = $5
         where id = $1
           and campground_id = $2
           and map_image_version_id = $3
           and row_version = $6
         returning *`,
        [
          polygonId,
          campgroundId,
          mapImageVersionId,
          Boolean(enabled),
          actorUserId,
          expectedRowVersion,
        ],
      );
    } else {
      const column = state === "locked" ? "is_locked" : "is_hidden";
      updated = await client.query(
        `update icamp_private.campground_map_polygons
         set ${column} = $4,
             updated_by_user_id = $5
         where id = $1
           and campground_id = $2
           and map_image_version_id = $3
           and row_version = $6
         returning *`,
        [
          polygonId,
          campgroundId,
          mapImageVersionId,
          Boolean(enabled),
          actorUserId,
          expectedRowVersion,
        ],
      );
    }

    if (updated.rowCount !== 1) {
      throw new Error("Polygon changed. Refresh and try again.");
    }
    const saved = updated.rows[0];

    await appendAuditEvent(client, {
      actorUserId,
      organizationId: current.organization_id,
      campgroundId,
      actionKey: `campground.map.polygon.${state}.${enabled ? "enable" : "disable"}`,
      permissionKey: "campground.map",
      riskLevel: state === "archived" ? "elevated" : "standard",
      subjectType: "campground.map.polygon",
      subjectId: polygonId,
      beforeState: {
        isLocked: current.is_locked,
        isHidden: current.is_hidden,
        archivedAt: current.archived_at,
      },
      afterState: {
        isLocked: saved.is_locked,
        isHidden: saved.is_hidden,
        archivedAt: saved.archived_at,
      },
    });

    await client.query("commit");
    return mapPolygon(saved);
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
