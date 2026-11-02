import pg from "pg";

import { appendAuditEvent } from "../audit/postgres.mjs";
import {
  createSupabaseStorageAdapter,
  getMediaStorageConfig,
} from "../media/storage.mjs";

const { Pool } = pg;

let pool;

function databaseUrl() {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) {
    throw new Error("DATABASE_URL is required for gallery operations.");
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

export async function closeGalleryPoolForTests() {
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

async function assertGalleryManagePermission(client, userId, campgroundId) {
  const [accommodation, media] = await Promise.all([
    hasCampgroundPermission(
      client,
      userId,
      campgroundId,
      "accommodation.manage",
    ),
    hasCampgroundPermission(client, userId, campgroundId, "media.manage"),
  ]);

  if (!accommodation || !media) {
    throw new Error(
      "Accommodation and media management permissions are required for public galleries.",
    );
  }
}

async function assertGalleryReadPermission(client, userId, campgroundId) {
  const [read, manage] = await Promise.all([
    hasCampgroundPermission(client, userId, campgroundId, "accommodation.read"),
    hasCampgroundPermission(
      client,
      userId,
      campgroundId,
      "accommodation.manage",
    ),
  ]);

  if (!read && !manage) {
    throw new Error("Not authorized to read accommodation galleries.");
  }
}

function cleanText(value, label, maxLength, required = false) {
  const text = String(value ?? "").trim();

  if (!text) {
    if (required) {
      throw new Error(label + " is required.");
    }
    return null;
  }

  if (text.length > maxLength) {
    throw new Error(label + " must be " + maxLength + " characters or fewer.");
  }

  return text;
}

function normalizeSortOrder(value) {
  const sortOrder = Number(value);
  if (!Number.isInteger(sortOrder) || sortOrder < 1 || sortOrder > 10) {
    throw new Error("Gallery order must be between 1 and 10.");
  }
  return sortOrder;
}

function publicUrl(asset) {
  if (!asset || asset.storage_provider !== "supabase") {
    return null;
  }

  const config = getMediaStorageConfig();
  if (!config.projectUrl) {
    return null;
  }

  return createSupabaseStorageAdapter({
    projectUrl: config.projectUrl,
    secretKey: config.secretKey,
  }).getPublicUrl({
    bucketKey: asset.bucket_key,
    objectKey: asset.object_key,
  });
}

function mappedGallery(row) {
  const source = {
    storage_provider: row.source_storage_provider,
    bucket_key: row.source_bucket_key,
    object_key: row.source_object_key,
  };
  const thumbnail = {
    storage_provider: row.thumbnail_storage_provider,
    bucket_key: row.thumbnail_bucket_key,
    object_key: row.thumbnail_object_key,
  };
  const optimized = {
    storage_provider: row.optimized_storage_provider,
    bucket_key: row.optimized_bucket_key,
    object_key: row.optimized_object_key,
  };

  return {
    id: row.id,
    organizationId: row.organization_id,
    campgroundId: row.campground_id,
    accommodationId: row.accommodation_id,
    caption: row.caption,
    altText: row.alt_text,
    sortOrder: Number(row.sort_order),
    isHero: row.is_hero,
    isActive: row.is_active,
    sourceWidth: Number(row.source_width),
    sourceHeight: Number(row.source_height),
    thumbnailWidth: Number(row.thumbnail_width),
    thumbnailHeight: Number(row.thumbnail_height),
    optimizedWidth: Number(row.optimized_width),
    optimizedHeight: Number(row.optimized_height),
    sourceUrl: publicUrl(source),
    thumbnailUrl: publicUrl(thumbnail),
    optimizedUrl: publicUrl(optimized),
    rowVersion: Number(row.row_version),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listAccommodationGalleries(userId, campgroundId) {
  const client = await getPool().connect();

  try {
    await assertGalleryReadPermission(client, userId, campgroundId);

    const result = await client.query(
      `select
         g.*,
         s.storage_provider as source_storage_provider,
         s.bucket_key as source_bucket_key,
         s.object_key as source_object_key,
         t.storage_provider as thumbnail_storage_provider,
         t.bucket_key as thumbnail_bucket_key,
         t.object_key as thumbnail_object_key,
         o.storage_provider as optimized_storage_provider,
         o.bucket_key as optimized_bucket_key,
         o.object_key as optimized_object_key
       from public.accommodation_public_gallery_images g
       join icamp_private.media_assets s
         on s.id = g.source_media_asset_id
       join icamp_private.media_assets t
         on t.id = g.thumbnail_media_asset_id
       join icamp_private.media_assets o
         on o.id = g.optimized_media_asset_id
       where g.campground_id = $1
         and g.is_active
       order by
         g.accommodation_id,
         g.is_hero desc,
         g.sort_order,
         g.created_at`,
      [campgroundId],
    );

    return result.rows.map(mappedGallery);
  } finally {
    client.release();
  }
}

async function insertActiveMediaAsset(
  client,
  {
    id,
    actorUserId,
    organizationId,
    campgroundId,
    bucketKey,
    objectKey,
    originalFilename,
    contentType,
    byteSize,
    checksumSha256,
  },
) {
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
       $1, $2, $3, 'public', 'image', 'supabase', $4, $5, $6, $7, $8, $9,
       'validated', 'pending', $10
     )`,
    [
      id,
      organizationId,
      campgroundId,
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
      id,
      actorUserId,
      "Public accommodation gallery upload",
      JSON.stringify({ classification: "public", mediaKind: "image" }),
    ],
  );

  await client.query(
    `update icamp_private.media_assets
     set lifecycle_state = 'active'
     where id = $1`,
    [id],
  );

  await client.query(
    `insert into icamp_private.media_lifecycle_events (
       media_asset_id,
       event_type,
       from_state,
       to_state,
       actor_user_id,
       reason
     )
     values ($1, 'activated', 'pending', 'active', $2, $3)`,
    [id, actorUserId, "Public accommodation gallery publication"],
  );
}

export async function registerAccommodationGalleryImage({
  actorUserId,
  actorSessionId = null,
  organizationId,
  campgroundId,
  accommodationId,
  caption,
  altText,
  source,
  thumbnail,
  optimized,
}) {
  const client = await getPool().connect();

  try {
    await client.query("begin");
    await assertGalleryManagePermission(client, actorUserId, campgroundId);
    await client.query(
      `select pg_advisory_xact_lock(
         hashtextextended('icamp-gallery:' || $1::text, 0)
       )`,
      [accommodationId],
    );

    const accommodation = await client.query(
      `select organization_id, campground_id, accommodation_kind
       from public.accommodations
       where id = $1
         and campground_id = $2
       limit 1
       for update`,
      [accommodationId, campgroundId],
    );

    if (accommodation.rowCount !== 1) {
      throw new Error("Accommodation is unavailable.");
    }

    const parent = accommodation.rows[0];
    if (parent.organization_id !== organizationId) {
      throw new Error("Accommodation organization scope does not match.");
    }
    if (!["campsite", "rental_cottage"].includes(parent.accommodation_kind)) {
      throw new Error(
        "Public galleries are limited to campsites and rental cottages.",
      );
    }

    const activeCountResult = await client.query(
      `select count(*)::integer as active_count
       from public.accommodation_public_gallery_images
       where accommodation_id = $1
         and campground_id = $2
         and is_active`,
      [accommodationId, campgroundId],
    );
    const activeCount = Number(activeCountResult.rows[0].active_count);

    if (activeCount >= 10) {
      throw new Error(
        "This accommodation already has 10 active public images.",
      );
    }

    for (const media of [source, thumbnail, optimized]) {
      await insertActiveMediaAsset(client, {
        actorUserId,
        organizationId,
        campgroundId,
        ...media,
      });
    }

    const inserted = await client.query(
      `insert into public.accommodation_public_gallery_images (
         organization_id,
         campground_id,
         accommodation_id,
         source_media_asset_id,
         thumbnail_media_asset_id,
         optimized_media_asset_id,
         caption,
         alt_text,
         sort_order,
         is_hero,
         source_width,
         source_height,
         thumbnail_width,
         thumbnail_height,
         optimized_width,
         optimized_height,
         created_by_user_id,
         updated_by_user_id
       )
       values (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
         $11, $12, $13, $14, $15, $16, $17, $17
       )
       returning id, sort_order, is_hero, row_version`,
      [
        organizationId,
        campgroundId,
        accommodationId,
        source.id,
        thumbnail.id,
        optimized.id,
        cleanText(caption, "Caption", 300),
        cleanText(altText, "Alternative text", 240, true),
        activeCount + 1,
        activeCount === 0,
        source.width,
        source.height,
        thumbnail.width,
        thumbnail.height,
        optimized.width,
        optimized.height,
        actorUserId,
      ],
    );

    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId,
      campgroundId,
      actionKey: "accommodation.gallery.image.create",
      permissionKey: "accommodation.manage",
      riskLevel: "standard",
      subjectType: "accommodation.gallery.image",
      subjectId: inserted.rows[0].id,
      afterState: {
        accommodationId,
        sortOrder: Number(inserted.rows[0].sort_order),
        isHero: inserted.rows[0].is_hero,
        sourceWidth: source.width,
        sourceHeight: source.height,
      },
    });

    await client.query("commit");
    return inserted.rows[0].id;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function updateAccommodationGalleryImage({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  galleryImageId,
  expectedRowVersion,
  caption,
  altText,
  sortOrder,
  makeHero = false,
}) {
  const client = await getPool().connect();

  try {
    await client.query("begin");
    await assertGalleryManagePermission(client, actorUserId, campgroundId);

    const beforeResult = await client.query(
      `select *
       from public.accommodation_public_gallery_images
       where id = $1
         and campground_id = $2
         and is_active
       limit 1
       for update`,
      [galleryImageId, campgroundId],
    );

    if (beforeResult.rowCount !== 1) {
      throw new Error("Gallery image is unavailable.");
    }

    const before = beforeResult.rows[0];
    if (Number(before.row_version) !== Number(expectedRowVersion)) {
      throw new Error("Gallery image changed. Refresh and try again.");
    }

    if (makeHero) {
      await client.query(
        `update public.accommodation_public_gallery_images
         set is_hero = false,
             updated_by_user_id = $3
         where accommodation_id = $1
           and campground_id = $2
           and is_active
           and is_hero
           and id <> $4`,
        [before.accommodation_id, campgroundId, actorUserId, galleryImageId],
      );
    }

    const updated = await client.query(
      `update public.accommodation_public_gallery_images
       set caption = $3,
           alt_text = $4,
           sort_order = $5,
           is_hero = case when $6 then true else is_hero end,
           updated_by_user_id = $7
       where id = $1
         and campground_id = $2
         and row_version = $8
       returning *`,
      [
        galleryImageId,
        campgroundId,
        cleanText(caption, "Caption", 300),
        cleanText(altText, "Alternative text", 240, true),
        normalizeSortOrder(sortOrder),
        Boolean(makeHero),
        actorUserId,
        Number(expectedRowVersion),
      ],
    );

    if (updated.rowCount !== 1) {
      throw new Error("Gallery image changed. Refresh and try again.");
    }

    const after = updated.rows[0];

    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: after.organization_id,
      campgroundId,
      actionKey: "accommodation.gallery.image.update",
      permissionKey: "accommodation.manage",
      riskLevel: "standard",
      subjectType: "accommodation.gallery.image",
      subjectId: galleryImageId,
      beforeState: {
        caption: before.caption,
        altText: before.alt_text,
        sortOrder: Number(before.sort_order),
        isHero: before.is_hero,
      },
      afterState: {
        caption: after.caption,
        altText: after.alt_text,
        sortOrder: Number(after.sort_order),
        isHero: after.is_hero,
      },
    });

    await client.query("commit");
    return Number(after.row_version);
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function archiveAccommodationGalleryImage({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  galleryImageId,
  expectedRowVersion,
}) {
  const client = await getPool().connect();

  try {
    await client.query("begin");
    await assertGalleryManagePermission(client, actorUserId, campgroundId);

    const beforeResult = await client.query(
      `select *
       from public.accommodation_public_gallery_images
       where id = $1
         and campground_id = $2
         and is_active
       limit 1
       for update`,
      [galleryImageId, campgroundId],
    );

    if (beforeResult.rowCount !== 1) {
      throw new Error("Gallery image is unavailable.");
    }

    const before = beforeResult.rows[0];
    if (Number(before.row_version) !== Number(expectedRowVersion)) {
      throw new Error("Gallery image changed. Refresh and try again.");
    }

    const archived = await client.query(
      `update public.accommodation_public_gallery_images
       set is_active = false,
           is_hero = false,
           updated_by_user_id = $3
       where id = $1
         and campground_id = $2
         and row_version = $4
       returning *`,
      [galleryImageId, campgroundId, actorUserId, Number(expectedRowVersion)],
    );

    if (archived.rowCount !== 1) {
      throw new Error("Gallery image changed. Refresh and try again.");
    }

    const mediaIds = [
      before.source_media_asset_id,
      before.thumbnail_media_asset_id,
      before.optimized_media_asset_id,
    ];

    for (const mediaId of mediaIds) {
      const media = await client.query(
        `update icamp_private.media_assets
         set lifecycle_state = 'archived'
         where id = $1
           and lifecycle_state = 'active'
         returning id`,
        [mediaId],
      );

      if (media.rowCount === 1) {
        await client.query(
          `insert into icamp_private.media_lifecycle_events (
             media_asset_id,
             event_type,
             from_state,
             to_state,
             actor_user_id,
             reason
           )
           values ($1, 'archived', 'active', 'archived', $2, $3)`,
          [mediaId, actorUserId, "Removed from public accommodation gallery"],
        );
      }
    }

    if (before.is_hero) {
      const replacement = await client.query(
        `select id
         from public.accommodation_public_gallery_images
         where accommodation_id = $1
           and campground_id = $2
           and is_active
         order by sort_order, created_at
         limit 1
         for update`,
        [before.accommodation_id, campgroundId],
      );

      if (replacement.rowCount === 1) {
        await client.query(
          `update public.accommodation_public_gallery_images
           set is_hero = true,
               updated_by_user_id = $2
           where id = $1`,
          [replacement.rows[0].id, actorUserId],
        );
      }
    }

    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: before.organization_id,
      campgroundId,
      actionKey: "accommodation.gallery.image.archive",
      permissionKey: "accommodation.manage",
      riskLevel: "standard",
      subjectType: "accommodation.gallery.image",
      subjectId: galleryImageId,
      beforeState: {
        accommodationId: before.accommodation_id,
        isHero: before.is_hero,
        sortOrder: Number(before.sort_order),
      },
      afterState: {
        isActive: false,
      },
    });

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
