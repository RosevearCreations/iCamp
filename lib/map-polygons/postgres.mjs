import pg from "pg";

import { appendAuditEvent } from "../audit/postgres.mjs";
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
      `select *
       from icamp_private.campground_map_polygons
       where campground_id = $1
         and map_image_version_id = $2
       order by
         (archived_at is not null),
         is_hidden,
         updated_at desc,
         label asc`,
      [campgroundId, mapImageVersionId],
    );
    return result.rows.map(mapPolygon);
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
    const canonicalGeometry = validateStoredMapPolygon(
      geometry,
      Number(version.source_width),
      Number(version.source_height),
    );
    const normalizedLabel = requiredLabel(label);
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
      };
      const updated = await client.query(
        `update icamp_private.campground_map_polygons
         set label = $4,
             geometry = $5::jsonb,
             updated_by_user_id = $6
         where id = $1
           and campground_id = $2
           and map_image_version_id = $3
           and row_version = $7
         returning *`,
        [
          polygonId,
          campgroundId,
          mapImageVersionId,
          normalizedLabel,
          JSON.stringify(canonicalGeometry),
          actorUserId,
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
           created_by_user_id,
           updated_by_user_id
         )
         values ($1, $2, $3, $4, $5::jsonb, $6, $6)
         returning *`,
        [
          version.organization_id,
          campgroundId,
          mapImageVersionId,
          normalizedLabel,
          JSON.stringify(canonicalGeometry),
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

    const inserted = await client.query(
      `insert into icamp_private.campground_map_polygons (
         organization_id,
         campground_id,
         map_image_version_id,
         label,
         geometry,
         duplicated_from_polygon_id,
         created_by_user_id,
         updated_by_user_id
       )
       values ($1, $2, $3, $4, $5::jsonb, $6, $7, $7)
       returning *`,
      [
        current.organization_id,
        campgroundId,
        mapImageVersionId,
        copyLabel(current.label),
        JSON.stringify(current.geometry),
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
