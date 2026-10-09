import pg from "pg";

import { appendAuditEvent } from "../audit/postgres.mjs";
import { assertPrivilegedActionControl } from "../audit/privileged.mjs";

const { Pool } = pg;
let pool;

function databaseUrl() {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) {
    throw new Error("DATABASE_URL is required for map image operations.");
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

export async function closeMapImagePoolForTests() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

async function hasPermission(client, userId, campgroundId, permissionKey) {
  const result = await client.query(
    `select icamp_private.has_campground_permission($1, $2, $3) as allowed`,
    [userId, campgroundId, permissionKey],
  );
  return result.rows[0]?.allowed === true;
}

async function assertPermission(client, userId, campgroundId, permissionKey) {
  if (!(await hasPermission(client, userId, campgroundId, permissionKey))) {
    throw new Error("Not authorized for this campground map operation.");
  }
}

function requiredText(value, label, maxLength) {
  const normalized = String(value ?? "").trim();
  if (!normalized || normalized.length > maxLength) {
    throw new Error(`${label} must be between 1 and ${maxLength} characters.`);
  }
  return normalized;
}

function optionalText(value, maxLength) {
  const normalized = String(value ?? "").trim();
  if (normalized.length > maxLength) {
    throw new Error(`Notes must be ${maxLength} characters or fewer.`);
  }
  return normalized || null;
}

function mapVersion(row) {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    organizationId: row.organization_id,
    campgroundId: row.campground_id,
    mediaAssetId: row.media_asset_id,
    versionNumber: Number(row.version_number),
    label: row.label,
    notes: row.notes,
    sourceWidth: Number(row.source_width),
    sourceHeight: Number(row.source_height),
    sourceContentType: row.source_content_type,
    sourceByteSize: Number(row.source_byte_size),
    sourceChecksumSha256: row.source_checksum_sha256,
    isActive: row.is_active,
    isPublished: row.is_published,
    createdByUserId: row.created_by_user_id,
    publishedByUserId: row.published_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at,
    rowVersion: Number(row.row_version),
    originalFilename: row.original_filename,
    mediaLifecycleState: row.media_lifecycle_state,
  };
}

export async function listMapImageVersions(userId, campgroundId) {
  const client = await getPool().connect();
  try {
    await assertPermission(client, userId, campgroundId, "campground.map");
    const result = await client.query(
      `select
         v.*,
         m.original_filename,
         m.lifecycle_state as media_lifecycle_state
       from icamp_private.campground_map_image_versions v
       join icamp_private.media_assets m
         on m.id = v.media_asset_id
       where v.campground_id = $1
       order by v.version_number desc`,
      [campgroundId],
    );
    return result.rows.map(mapVersion);
  } finally {
    client.release();
  }
}

export async function registerOverheadMapVersion({
  actorUserId,
  organizationId,
  campgroundId,
  mediaAssetId,
  storageProvider,
  bucketKey,
  objectKey,
  originalFilename,
  contentType,
  byteSize,
  checksumSha256,
  width,
  height,
  label,
  notes,
  reason,
}) {
  const privileged = assertPrivilegedActionControl({
    riskLevel: "elevated",
    reason,
  });
  const normalizedLabel = requiredText(label, "Map version label", 160);
  const normalizedNotes = optionalText(notes, 1000);
  const client = await getPool().connect();

  try {
    await client.query("begin");
    await assertPermission(client, actorUserId, campgroundId, "campground.map");
    await assertPermission(client, actorUserId, campgroundId, "media.manage");

    const campground = await client.query(
      `select organization_id
       from public.campgrounds
       where id = $1
         and organization_id = $2
       limit 1`,
      [campgroundId, organizationId],
    );
    if (campground.rowCount !== 1) {
      throw new Error("Campground scope is invalid.");
    }

    await client.query(
      `select pg_advisory_xact_lock(
         hashtextextended('icamp-map-version:' || $1::text, 0)
       )`,
      [campgroundId],
    );

    const versionResult = await client.query(
      `select coalesce(max(version_number), 0) + 1 as next_version,
              not exists (
                select 1
                from icamp_private.campground_map_image_versions
                where campground_id = $1
                  and is_active
              ) as make_active
       from icamp_private.campground_map_image_versions
       where campground_id = $1`,
      [campgroundId],
    );
    const versionNumber = Number(versionResult.rows[0].next_version);
    const makeActive = versionResult.rows[0].make_active === true;

    await client.query(
      `insert into icamp_private.media_assets (
         id,
         organization_id,
         campground_id,
         classification,
         media_kind,
         storage_provider,
         bucket_key,
         object_key,
         original_filename,
         content_type,
         byte_size,
         checksum_sha256,
         validation_state,
         lifecycle_state,
         created_by_user_id
       )
       values (
         $1, $2, $3, 'internal', 'image', $4, $5, $6, $7, $8, $9, $10,
         'validated', 'pending', $11
       )`,
      [
        mediaAssetId,
        organizationId,
        campgroundId,
        storageProvider,
        bucketKey,
        objectKey,
        originalFilename,
        contentType,
        byteSize,
        checksumSha256,
        actorUserId,
      ],
    );

    await client.query(
      `insert into icamp_private.media_lifecycle_events (
         media_asset_id,
         event_type,
         from_state,
         to_state,
         actor_user_id,
         reason,
         metadata
       )
       values ($1, 'registered', null, 'pending', $2, $3, $4::jsonb)`,
      [
        mediaAssetId,
        actorUserId,
        privileged.reason,
        JSON.stringify({ purpose: "campground-overhead-map" }),
      ],
    );

    await client.query(
      `update icamp_private.media_assets
       set lifecycle_state = 'active'
       where id = $1`,
      [mediaAssetId],
    );

    await client.query(
      `insert into icamp_private.media_lifecycle_events (
         media_asset_id,
         event_type,
         from_state,
         to_state,
         actor_user_id,
         reason,
         metadata
       )
       values ($1, 'activated', 'pending', 'active', $2, $3, $4::jsonb)`,
      [
        mediaAssetId,
        actorUserId,
        privileged.reason,
        JSON.stringify({ purpose: "campground-overhead-map" }),
      ],
    );

    const inserted = await client.query(
      `insert into icamp_private.campground_map_image_versions (
         organization_id,
         campground_id,
         media_asset_id,
         version_number,
         label,
         notes,
         source_width,
         source_height,
         source_content_type,
         source_byte_size,
         source_checksum_sha256,
         is_active,
         created_by_user_id
       )
       values (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
       )
       returning *`,
      [
        organizationId,
        campgroundId,
        mediaAssetId,
        versionNumber,
        normalizedLabel,
        normalizedNotes,
        width,
        height,
        contentType,
        byteSize,
        checksumSha256,
        makeActive,
        actorUserId,
      ],
    );

    const version = mapVersion({
      ...inserted.rows[0],
      original_filename: originalFilename,
      media_lifecycle_state: "active",
    });

    await appendAuditEvent(client, {
      actorUserId,
      organizationId,
      campgroundId,
      actionKey: "campground.map.image.upload",
      permissionKey: "campground.map",
      riskLevel: "elevated",
      reason: privileged.reason,
      subjectType: "campground.map.image-version",
      subjectId: version.id,
      afterState: {
        versionNumber,
        label: normalizedLabel,
        width,
        height,
        contentType,
        byteSize,
        isActive: makeActive,
      },
    });

    await client.query("commit");
    return version;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function setActiveMapVersion({
  actorUserId,
  campgroundId,
  mapVersionId,
  expectedRowVersion,
}) {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    await assertPermission(client, actorUserId, campgroundId, "campground.map");
    await client.query(
      `select pg_advisory_xact_lock(
         hashtextextended('icamp-map-version:' || $1::text, 0)
       )`,
      [campgroundId],
    );

    const target = await client.query(
      `select *
       from icamp_private.campground_map_image_versions
       where id = $1
         and campground_id = $2
       limit 1`,
      [mapVersionId, campgroundId],
    );
    if (target.rowCount !== 1) {
      throw new Error("Map image version is not available.");
    }
    if (Number(target.rows[0].row_version) !== Number(expectedRowVersion)) {
      throw new Error("Map image version changed. Refresh and try again.");
    }

    await client.query(
      `update icamp_private.campground_map_image_versions
       set is_active = false
       where campground_id = $1
         and is_active
         and id <> $2`,
      [campgroundId, mapVersionId],
    );
    const updated = await client.query(
      `update icamp_private.campground_map_image_versions
       set is_active = true
       where id = $1
         and campground_id = $2
         and row_version = $3
       returning *`,
      [mapVersionId, campgroundId, expectedRowVersion],
    );
    if (updated.rowCount !== 1) {
      throw new Error("Map image version changed. Refresh and try again.");
    }

    const row = updated.rows[0];
    await appendAuditEvent(client, {
      actorUserId,
      organizationId: row.organization_id,
      campgroundId,
      actionKey: "campground.map.image.activate",
      permissionKey: "campground.map",
      riskLevel: "standard",
      subjectType: "campground.map.image-version",
      subjectId: mapVersionId,
      beforeState: { isActive: target.rows[0].is_active },
      afterState: { isActive: true, versionNumber: row.version_number },
    });

    await client.query("commit");
    return mapVersion(row);
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function publishMapVersion({
  actorUserId,
  campgroundId,
  mapVersionId,
  expectedRowVersion,
  reason,
}) {
  const privileged = assertPrivilegedActionControl({
    riskLevel: "elevated",
    reason,
  });
  const client = await getPool().connect();

  try {
    await client.query("begin");
    await assertPermission(
      client,
      actorUserId,
      campgroundId,
      "campground.map.publish",
    );
    await client.query(
      `select pg_advisory_xact_lock(
         hashtextextended('icamp-map-version:' || $1::text, 0)
       )`,
      [campgroundId],
    );

    const target = await client.query(
      `select *
       from icamp_private.campground_map_image_versions
       where id = $1
         and campground_id = $2
       limit 1`,
      [mapVersionId, campgroundId],
    );
    if (target.rowCount !== 1) {
      throw new Error("Map image version is not available.");
    }
    if (Number(target.rows[0].row_version) !== Number(expectedRowVersion)) {
      throw new Error("Map image version changed. Refresh and try again.");
    }

    await client.query(
      `update icamp_private.campground_map_image_versions
       set is_active = false,
           is_published = false
       where campground_id = $1
         and id <> $2
         and (is_active or is_published)`,
      [campgroundId, mapVersionId],
    );

    const updated = await client.query(
      `update icamp_private.campground_map_image_versions
       set is_active = true,
           is_published = true,
           published_at = statement_timestamp(),
           published_by_user_id = $4
       where id = $1
         and campground_id = $2
         and row_version = $3
       returning *`,
      [mapVersionId, campgroundId, expectedRowVersion, actorUserId],
    );
    if (updated.rowCount !== 1) {
      throw new Error("Map image version changed. Refresh and try again.");
    }

    const row = updated.rows[0];
    await appendAuditEvent(client, {
      actorUserId,
      organizationId: row.organization_id,
      campgroundId,
      actionKey: "campground.map.image.publish",
      permissionKey: "campground.map.publish",
      riskLevel: "elevated",
      reason: privileged.reason,
      subjectType: "campground.map.image-version",
      subjectId: mapVersionId,
      beforeState: {
        isPublished: target.rows[0].is_published,
        isActive: target.rows[0].is_active,
      },
      afterState: {
        isPublished: true,
        isActive: true,
        versionNumber: row.version_number,
      },
    });

    await client.query("commit");
    return mapVersion(row);
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
