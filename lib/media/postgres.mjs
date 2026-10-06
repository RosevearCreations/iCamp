import pg from "pg";

import { appendAuditEvent } from "../audit/postgres.mjs";
import { assertPrivilegedActionControl } from "../audit/privileged.mjs";

const { Pool } = pg;

let pool;

function databaseUrl() {
  const value = process.env.DATABASE_URL?.trim();

  if (!value) {
    throw new Error("DATABASE_URL is required for media operations.");
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

export async function closeMediaPoolForTests() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

async function hasCampgroundPermission(
  client,
  userId,
  campgroundId,
  permissionKey,
) {
  const result = await client.query(
    `select exists (
       select 1
       from icamp_private.campground_assignments a
       join icamp_private.campground_assignment_roles ar
         on ar.assignment_id = a.id
       join icamp_private.roles r
         on r.id = ar.role_id
        and r.lifecycle_state = 'active'
       join icamp_private.role_permissions rp
         on rp.role_id = r.id
       where a.user_id = $1
         and a.campground_id = $2
         and rp.permission_key = $3
         and a.assignment_state = 'active'
         and a.starts_at <= statement_timestamp()
         and (a.ends_at is null or a.ends_at > statement_timestamp())
     ) as allowed`,
    [userId, campgroundId, permissionKey],
  );

  return result.rows[0]?.allowed === true;
}

async function assertManagePermission(client, userId, campgroundId) {
  const allowed = await hasCampgroundPermission(
    client,
    userId,
    campgroundId,
    "media.manage",
  );

  if (!allowed) {
    throw new Error("Not authorized to manage media for this campground.");
  }
}

function mapAsset(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    organizationId: row.organization_id,
    campgroundId: row.campground_id,
    classification: row.classification,
    mediaKind: row.media_kind,
    storageProvider: row.storage_provider,
    bucketKey: row.bucket_key,
    objectKey: row.object_key,
    originalFilename: row.original_filename,
    contentType: row.content_type,
    byteSize: Number(row.byte_size),
    checksumSha256: row.checksum_sha256,
    validationState: row.validation_state,
    lifecycleState: row.lifecycle_state,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    activatedAt: row.activated_at,
    archivedAt: row.archived_at,
    deletedAt: row.deleted_at,
    rowVersion: Number(row.row_version),
  };
}

export async function registerMediaAsset({
  actorUserId,
  organizationId,
  campgroundId,
  classification,
  mediaKind,
  storageProvider = "supabase",
  bucketKey,
  objectKey,
  originalFilename,
  contentType,
  byteSize,
  checksumSha256 = null,
  reason,
}) {
  const privileged = assertPrivilegedActionControl({
    riskLevel: "elevated",
    reason,
  });
  const client = await getPool().connect();

  try {
    await client.query("begin");
    await assertManagePermission(client, actorUserId, campgroundId);

    const inserted = await client.query(
      `insert into icamp_private.media_assets (
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
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
         'validated', 'pending', $12
       )
       returning *`,
      [
        organizationId,
        campgroundId,
        classification,
        mediaKind,
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

    const asset = mapAsset(inserted.rows[0]);

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
        asset.id,
        actorUserId,
        privileged.reason,
        JSON.stringify({
          classification: asset.classification,
          mediaKind: asset.mediaKind,
        }),
      ],
    );

    await appendAuditEvent(client, {
      actorUserId,
      organizationId,
      campgroundId,
      actionKey: "media.asset.register",
      permissionKey: "media.manage",
      riskLevel: "elevated",
      reason: privileged.reason,
      subjectType: "media.asset",
      subjectId: asset.id,
      afterState: {
        classification: asset.classification,
        mediaKind: asset.mediaKind,
        lifecycleState: asset.lifecycleState,
        validationState: asset.validationState,
      },
    });

    await client.query("commit");
    return asset;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

const transitionEvents = new Map([
  ["pending:active", "activated"],
  ["pending:quarantined", "quarantined"],
  ["pending:deleted", "deleted"],
  ["active:quarantined", "quarantined"],
  ["active:archived", "archived"],
  ["active:deleted", "deleted"],
  ["quarantined:active", "restored"],
  ["quarantined:archived", "archived"],
  ["quarantined:deleted", "deleted"],
  ["archived:active", "restored"],
  ["archived:deleted", "deleted"],
]);

export async function transitionMediaAsset({
  actorUserId,
  mediaAssetId,
  toState,
  reason,
}) {
  const privileged = assertPrivilegedActionControl({
    riskLevel: "elevated",
    reason,
  });
  const client = await getPool().connect();

  try {
    await client.query("begin");

    const currentResult = await client.query(
      `select *
       from icamp_private.media_assets
       where id = $1
       for update`,
      [mediaAssetId],
    );
    const before = mapAsset(currentResult.rows[0]);

    if (!before) {
      throw new Error("Media asset was not found.");
    }

    await assertManagePermission(client, actorUserId, before.campgroundId);

    const eventType = transitionEvents.get(
      before.lifecycleState + ":" + toState,
    );

    if (!eventType) {
      throw new Error("Unsupported media lifecycle transition.");
    }

    const updatedResult = await client.query(
      `update icamp_private.media_assets
       set lifecycle_state = $2
       where id = $1
       returning *`,
      [mediaAssetId, toState],
    );
    const after = mapAsset(updatedResult.rows[0]);

    await client.query(
      `insert into icamp_private.media_lifecycle_events (
         media_asset_id,
         event_type,
         from_state,
         to_state,
         actor_user_id,
         reason
       )
       values ($1, $2, $3, $4, $5, $6)`,
      [
        mediaAssetId,
        eventType,
        before.lifecycleState,
        after.lifecycleState,
        actorUserId,
        privileged.reason,
      ],
    );

    await appendAuditEvent(client, {
      actorUserId,
      organizationId: after.organizationId,
      campgroundId: after.campgroundId,
      actionKey: "media.asset.lifecycle",
      permissionKey: "media.manage",
      riskLevel: "elevated",
      reason: privileged.reason,
      subjectType: "media.asset",
      subjectId: mediaAssetId,
      beforeState: {
        lifecycleState: before.lifecycleState,
      },
      afterState: {
        lifecycleState: after.lifecycleState,
      },
    });

    await client.query("commit");
    return after;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function getMediaAccessDescriptor(mediaAssetId) {
  const result = await getPool().query(
    `select
       id,
       campground_id,
       classification,
       storage_provider,
       bucket_key,
       object_key,
       content_type,
       lifecycle_state
     from icamp_private.media_assets
     where id = $1
     limit 1`,
    [mediaAssetId],
  );
  const row = result.rows[0];

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    campgroundId: row.campground_id,
    classification: row.classification,
    storageProvider: row.storage_provider,
    bucketKey: row.bucket_key,
    objectKey: row.object_key,
    contentType: row.content_type,
    lifecycleState: row.lifecycle_state,
  };
}

export async function getMediaStorageHealth() {
  const result = await getPool().query(
    `select
       count(*)::integer as registered,
       count(*) filter (where lifecycle_state = 'active')::integer as active,
       count(*) filter (where lifecycle_state = 'quarantined')::integer
         as quarantined,
       count(*) filter (
         where classification = 'public'
           and lifecycle_state = 'active'
       )::integer as public_active,
       count(*) filter (
         where classification = 'internal'
           and lifecycle_state = 'active'
       )::integer as internal_active,
       count(*) filter (
         where classification = 'confidential'
           and lifecycle_state = 'active'
       )::integer as confidential_active
     from icamp_private.media_assets`,
  );
  const row = result.rows[0];

  return {
    status: Number(row.quarantined) > 0 ? "attention" : "healthy",
    registered: Number(row.registered),
    active: Number(row.active),
    quarantined: Number(row.quarantined),
    byClassification: {
      public: Number(row.public_active),
      internal: Number(row.internal_active),
      confidential: Number(row.confidential_active),
    },
  };
}
