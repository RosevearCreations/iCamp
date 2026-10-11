import pg from "pg";

import { appendAuditEvent } from "../audit/postgres.mjs";
import { hasCampgroundPermission } from "../authz/postgres.mjs";
import { validateStoredMapPoint } from "../map-coordinates/transform.mjs";
import {
  mapObjectKindDefinition,
  validateMapObjectCode,
  validateMapObjectKind,
  validateMapObjectName,
} from "./config.mjs";

const { Pool } = pg;
let pool;

function databaseUrl() {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) {
    throw new Error("DATABASE_URL is required for map object operations.");
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

export async function closeMapObjectPoolForTests() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

async function assertPermission(userId, campgroundId, permissionKey) {
  if (!(await hasCampgroundPermission(userId, campgroundId, permissionKey))) {
    throw new Error("Not authorized for this campground map object operation.");
  }
}

async function campgroundScope(client, campgroundId) {
  const result = await client.query(
    `select organization_id
     from public.campgrounds
     where id = $1
     limit 1`,
    [campgroundId],
  );
  if (result.rowCount !== 1) throw new Error("Campground is unavailable.");
  return result.rows[0].organization_id;
}

function mapObject(row) {
  return {
    id: row.id,
    organizationId: row.organization_id,
    campgroundId: row.campground_id,
    kind: row.object_kind,
    code: row.object_code,
    displayName: row.display_name,
    sectionId: row.section_id,
    sectionName: row.section_name ?? null,
    lifecycleState: row.lifecycle_state,
    archivedAt: row.archived_at,
    rowVersion: Number(row.row_version),
    defaultIconKey: mapObjectKindDefinition(row.object_kind)?.defaultIconKey ?? "pin",
    defaultLayerKey:
      mapObjectKindDefinition(row.object_kind)?.defaultLayerKey ?? "management",
    binding: row.binding_id
      ? {
          id: row.binding_id,
          geometryKind: row.geometry_kind,
          mapImageVersionId: row.binding_map_image_version_id,
          layerId: row.binding_layer_id,
          layerKey: row.binding_layer_key,
          layerDisplayName: row.binding_layer_display_name,
          layerIconKey: row.binding_layer_icon_key,
          layerVisibilityPermissionKey: row.visibility_permission_key,
          polygonId: row.polygon_id,
          polygonLabel: row.polygon_label ?? null,
          pointGeometry: row.point_geometry,
          rowVersion: Number(row.binding_row_version),
        }
      : null,
  };
}

export async function listMapObjects(userId, campgroundId, mapImageVersionId) {
  await assertPermission(userId, campgroundId, "campground.map");
  const canConfigure = await hasCampgroundPermission(
    userId,
    campgroundId,
    "campground.configuration",
  );
  const client = await getPool().connect();
  try {
    const result = await client.query(
      `select
         o.*,
         s.name as section_name,
         b.id as binding_id,
         b.geometry_kind,
         b.map_image_version_id as binding_map_image_version_id,
         b.layer_id as binding_layer_id,
         b.polygon_id,
         b.point_geometry,
         b.row_version as binding_row_version,
         l.layer_key as binding_layer_key,
         l.display_name as binding_layer_display_name,
         l.icon_key as binding_layer_icon_key,
         l.visibility_permission_key,
         p.label as polygon_label
       from icamp_private.campground_map_objects o
       left join public.campground_sections s
         on s.id = o.section_id
        and s.organization_id = o.organization_id
        and s.campground_id = o.campground_id
       left join icamp_private.campground_map_object_bindings b
         on b.map_object_id = o.id
        and b.campground_id = o.campground_id
       left join icamp_private.campground_map_layers l
         on l.id = b.layer_id
        and l.campground_id = o.campground_id
       left join icamp_private.campground_map_polygons p
         on p.id = b.polygon_id
       where o.campground_id = $1
         and o.lifecycle_state <> 'archived'
         and (
           b.id is null
           or b.map_image_version_id = $2
         )
       order by o.object_kind, o.object_code, o.display_name`,
      [campgroundId, mapImageVersionId],
    );

    const visible = [];
    for (const row of result.rows) {
      if (!row.binding_id) {
        if (canConfigure) visible.push(mapObject(row));
        continue;
      }

      if (
        await hasCampgroundPermission(
          userId,
          campgroundId,
          row.visibility_permission_key,
        )
      ) {
        visible.push(mapObject(row));
      }
    }
    return visible;
  } finally {
    client.release();
  }
}

export async function createMapObject({
  actorUserId,
  campgroundId,
  kind,
  code,
  displayName,
  sectionId,
}) {
  await assertPermission(
    actorUserId,
    campgroundId,
    "campground.configuration",
  );
  const normalizedKind = validateMapObjectKind(kind);
  const normalizedCode = validateMapObjectCode(code);
  const normalizedName = validateMapObjectName(displayName);
  const normalizedSectionId = String(sectionId ?? "").trim() || null;

  const client = await getPool().connect();
  try {
    await client.query("begin");
    const organizationId = await campgroundScope(client, campgroundId);
    const inserted = await client.query(
      `insert into icamp_private.campground_map_objects (
         organization_id,
         campground_id,
         object_kind,
         object_code,
         display_name,
         section_id,
         created_by_user_id,
         updated_by_user_id
       )
       values ($1, $2, $3, $4, $5, $6, $7, $7)
       returning *`,
      [
        organizationId,
        campgroundId,
        normalizedKind,
        normalizedCode,
        normalizedName,
        normalizedSectionId,
        actorUserId,
      ],
    );
    const saved = inserted.rows[0];

    await appendAuditEvent(client, {
      actorUserId,
      organizationId,
      campgroundId,
      actionKey: "campground.map.object.create",
      permissionKey: "campground.configuration",
      riskLevel: "standard",
      subjectType: "campground.map.object",
      subjectId: saved.id,
      beforeState: null,
      afterState: {
        kind: saved.object_kind,
        code: saved.object_code,
        displayName: saved.display_name,
        sectionId: saved.section_id,
      },
    });

    await client.query("commit");
    return mapObject(saved);
  } catch (error) {
    await client.query("rollback");
    if (error?.code === "23505") {
      throw new Error("A canonical map object already uses that code.");
    }
    throw error;
  } finally {
    client.release();
  }
}

async function getObject(client, campgroundId, mapObjectId) {
  const result = await client.query(
    `select *
     from icamp_private.campground_map_objects
     where id = $1
       and campground_id = $2
       and lifecycle_state <> 'archived'
     limit 1`,
    [mapObjectId, campgroundId],
  );
  if (result.rowCount !== 1) {
    throw new Error("Canonical map object is unavailable.");
  }
  return result.rows[0];
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

async function assertLayerVisible(actorUserId, campgroundId, layer) {
  if (
    !(await hasCampgroundPermission(
      actorUserId,
      campgroundId,
      layer.visibility_permission_key,
    ))
  ) {
    throw new Error("Not authorized to bind objects on this map layer.");
  }
}

async function existingBinding(client, campgroundId, mapObjectId) {
  const result = await client.query(
    `select *
     from icamp_private.campground_map_object_bindings
     where campground_id = $1
       and map_object_id = $2
     limit 1`,
    [campgroundId, mapObjectId],
  );
  return result.rows[0] ?? null;
}

async function insertBinding(client, values) {
  try {
    const result = await client.query(
      `insert into icamp_private.campground_map_object_bindings (
         organization_id,
         campground_id,
         map_object_id,
         map_image_version_id,
         layer_id,
         geometry_kind,
         polygon_id,
         point_geometry,
         created_by_user_id,
         updated_by_user_id
       )
       values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $9)
       returning *`,
      values,
    );
    return result.rows[0];
  } catch (error) {
    if (error?.code === "23505") {
      throw new Error(
        "This object or polygon already has a canonical map binding.",
      );
    }
    throw error;
  }
}

export async function bindMapObjectToPolygon({
  actorUserId,
  campgroundId,
  mapImageVersionId,
  mapObjectId,
  polygonId,
}) {
  await assertPermission(actorUserId, campgroundId, "campground.map");
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const object = await getObject(client, campgroundId, mapObjectId);
    if (await existingBinding(client, campgroundId, mapObjectId)) {
      throw new Error("This canonical map object is already bound.");
    }

    const polygonResult = await client.query(
      `select p.*, l.visibility_permission_key
       from icamp_private.campground_map_polygons p
       join icamp_private.campground_map_layers l
         on l.id = p.layer_id
        and l.campground_id = p.campground_id
       where p.id = $1
         and p.campground_id = $2
         and p.map_image_version_id = $3
         and p.archived_at is null
       limit 1`,
      [polygonId, campgroundId, mapImageVersionId],
    );
    if (polygonResult.rowCount !== 1) {
      throw new Error("Selected polygon is unavailable for binding.");
    }
    const polygon = polygonResult.rows[0];
    await assertLayerVisible(actorUserId, campgroundId, polygon);

    const saved = await insertBinding(client, [
      object.organization_id,
      campgroundId,
      mapObjectId,
      mapImageVersionId,
      polygon.layer_id,
      "polygon",
      polygonId,
      null,
      actorUserId,
    ]);

    await appendAuditEvent(client, {
      actorUserId,
      organizationId: object.organization_id,
      campgroundId,
      actionKey: "campground.map.object.bind.polygon",
      permissionKey: "campground.map",
      riskLevel: "standard",
      subjectType: "campground.map.object",
      subjectId: mapObjectId,
      beforeState: null,
      afterState: {
        bindingId: saved.id,
        geometryKind: "polygon",
        polygonId,
        mapImageVersionId: saved.map_image_version_id,
        layerId: saved.layer_id,
      },
    });

    await client.query("commit");
    return saved.id;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function bindMapObjectToPoint({
  actorUserId,
  campgroundId,
  mapImageVersionId,
  mapObjectId,
  layerId,
  pointGeometry,
}) {
  await assertPermission(actorUserId, campgroundId, "campground.map");
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const object = await getObject(client, campgroundId, mapObjectId);
    if (await existingBinding(client, campgroundId, mapObjectId)) {
      throw new Error("This canonical map object is already bound.");
    }

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
    const layer = await getLayer(client, campgroundId, layerId);
    await assertLayerVisible(actorUserId, campgroundId, layer);

    const canonicalPoint = validateStoredMapPoint(
      pointGeometry,
      Number(version.source_width),
      Number(version.source_height),
    );

    const saved = await insertBinding(client, [
      object.organization_id,
      campgroundId,
      mapObjectId,
      mapImageVersionId,
      layerId,
      "point",
      null,
      JSON.stringify(canonicalPoint),
      actorUserId,
    ]);

    await appendAuditEvent(client, {
      actorUserId,
      organizationId: object.organization_id,
      campgroundId,
      actionKey: "campground.map.object.bind.point",
      permissionKey: "campground.map",
      riskLevel: "standard",
      subjectType: "campground.map.object",
      subjectId: mapObjectId,
      beforeState: null,
      afterState: {
        bindingId: saved.id,
        geometryKind: "point",
        pointGeometry: canonicalPoint,
        mapImageVersionId,
        layerId,
      },
    });

    await client.query("commit");
    return saved.id;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function unbindMapObject({
  actorUserId,
  campgroundId,
  mapObjectId,
  expectedRowVersion,
}) {
  await assertPermission(actorUserId, campgroundId, "campground.map");
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const object = await getObject(client, campgroundId, mapObjectId);
    const bindingResult = await client.query(
      `select b.*, l.visibility_permission_key
       from icamp_private.campground_map_object_bindings b
       join icamp_private.campground_map_layers l
         on l.id = b.layer_id
        and l.campground_id = b.campground_id
       where b.map_object_id = $1
         and b.campground_id = $2
       limit 1`,
      [mapObjectId, campgroundId],
    );
    if (bindingResult.rowCount !== 1) {
      throw new Error("Canonical map object is not currently bound.");
    }
    const binding = bindingResult.rows[0];
    await assertLayerVisible(actorUserId, campgroundId, binding);

    const deleted = await client.query(
      `delete from icamp_private.campground_map_object_bindings
       where id = $1
         and row_version = $2
       returning *`,
      [binding.id, expectedRowVersion],
    );
    if (deleted.rowCount !== 1) {
      throw new Error("Map object binding changed. Refresh and try again.");
    }

    await appendAuditEvent(client, {
      actorUserId,
      organizationId: object.organization_id,
      campgroundId,
      actionKey: "campground.map.object.unbind",
      permissionKey: "campground.map",
      riskLevel: "elevated",
      subjectType: "campground.map.object",
      subjectId: mapObjectId,
      beforeState: {
        bindingId: binding.id,
        geometryKind: binding.geometry_kind,
        polygonId: binding.polygon_id,
        pointGeometry: binding.point_geometry,
        mapImageVersionId: binding.map_image_version_id,
        layerId: binding.layer_id,
      },
      afterState: null,
    });

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
