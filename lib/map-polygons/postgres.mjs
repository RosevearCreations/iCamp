import pg from "pg";

import { appendAuditEvent } from "../audit/postgres.mjs";
import { validateStoredMapPolygon } from "./geometry.mjs";

const { Pool } = pg;
let pool;

function databaseUrl() {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) throw new Error("DATABASE_URL is required for map polygon operations.");
  return value;
}
function getPool() {
  if (!pool) {
    pool = new Pool({ connectionString: databaseUrl(), max: 5, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 5_000 });
  }
  return pool;
}
export async function closeMapPolygonPoolForTests() {
  if (pool) { await pool.end(); pool = undefined; }
}
async function assertPermission(client, userId, campgroundId) {
  const result = await client.query(
    "select icamp_private.has_campground_permission($1, $2, 'campground.map') as allowed",
    [userId, campgroundId],
  );
  if (result.rows[0]?.allowed !== true) throw new Error("Not authorized for this campground map operation.");
}
function requiredLabel(value) {
  const label = String(value ?? "").trim();
  if (!label || label.length > 160) throw new Error("Polygon label must be between 1 and 160 characters.");
  return label;
}
function mapPolygon(row) {
  return {
    id: row.id,
    organizationId: row.organization_id,
    campgroundId: row.campground_id,
    mapImageVersionId: row.map_image_version_id,
    label: row.label,
    geometry: row.geometry,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    rowVersion: Number(row.row_version),
  };
}
export async function listMapPolygons(userId, campgroundId, mapImageVersionId) {
  const client = await getPool().connect();
  try {
    await assertPermission(client, userId, campgroundId);
    const result = await client.query(
      `select * from icamp_private.campground_map_polygons
       where campground_id = $1 and map_image_version_id = $2
       order by updated_at desc, label asc`,
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
    if (versionResult.rowCount !== 1) throw new Error("Active map image version is unavailable.");
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
      const current = await client.query(
        `select * from icamp_private.campground_map_polygons
         where id = $1 and campground_id = $2 and map_image_version_id = $3
         limit 1`,
        [polygonId, campgroundId, mapImageVersionId],
      );
      if (current.rowCount !== 1) throw new Error("Polygon is unavailable.");
      if (Number(current.rows[0].row_version) !== Number(expectedRowVersion)) {
        throw new Error("Polygon changed. Refresh and try again.");
      }
      beforeState = { label: current.rows[0].label, geometry: current.rows[0].geometry };
      const updated = await client.query(
        `update icamp_private.campground_map_polygons
         set label = $4, geometry = $5::jsonb, updated_by_user_id = $6
         where id = $1 and campground_id = $2 and map_image_version_id = $3 and row_version = $7
         returning *`,
        [polygonId, campgroundId, mapImageVersionId, normalizedLabel, JSON.stringify(canonicalGeometry), actorUserId, expectedRowVersion],
      );
      if (updated.rowCount !== 1) throw new Error("Polygon changed. Refresh and try again.");
      saved = updated.rows[0];
    } else {
      const inserted = await client.query(
        `insert into icamp_private.campground_map_polygons (
           organization_id, campground_id, map_image_version_id, label, geometry,
           created_by_user_id, updated_by_user_id
         ) values ($1, $2, $3, $4, $5::jsonb, $6, $6)
         returning *`,
        [version.organization_id, campgroundId, mapImageVersionId, normalizedLabel, JSON.stringify(canonicalGeometry), actorUserId],
      );
      saved = inserted.rows[0];
    }

    await appendAuditEvent(client, {
      actorUserId,
      organizationId: version.organization_id,
      campgroundId,
      actionKey: polygonId ? "campground.map.polygon.update" : "campground.map.polygon.create",
      permissionKey: "campground.map",
      riskLevel: "standard",
      subjectType: "campground.map.polygon",
      subjectId: saved.id,
      beforeState,
      afterState: { label: saved.label, vertexCount: canonicalGeometry.vertices.length, mapImageVersionId },
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
