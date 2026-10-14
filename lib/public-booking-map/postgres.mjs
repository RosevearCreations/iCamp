import pg from "pg";

import {
  normalizePublicBookingMapFilters,
  publicBookingMapPresentation,
} from "./core.mjs";

const { Pool } = pg;
let pool;

function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL?.trim();
    if (!connectionString) {
      throw new Error("DATABASE_URL is required for the public booking map.");
    }
    pool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }
  return pool;
}

export async function closePublicBookingMapPoolForTests() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

export async function listPublishedBookingCampgrounds() {
  const result = await getPool().query(
    `select c.id, c.name, c.slug
     from public.campgrounds c
     where c.lifecycle_state = 'active'
       and exists (
         select 1
         from icamp_private.campground_map_image_versions v
         where v.campground_id = c.id
           and v.is_published
       )
     order by c.name, c.slug`,
  );
  return result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
  }));
}

export async function isPublishedCampgroundMapMedia(mediaAssetId) {
  const result = await getPool().query(
    `select 1
     from icamp_private.campground_map_image_versions v
     join public.campgrounds c on c.id = v.campground_id
     where v.media_asset_id = $1
       and v.is_published
       and c.lifecycle_state = 'active'
     limit 1`,
    [mediaAssetId],
  );
  return result.rowCount === 1;
}

export async function getPublicBookingMapSnapshot(input) {
  const filters = normalizePublicBookingMapFilters(input);
  const campgroundSlug = String(input.campgroundSlug ?? "").trim();
  if (!campgroundSlug) throw new Error("A campground is required.");

  const client = await getPool().connect();
  try {
    const campgroundResult = await client.query(
      `select c.id, c.name, c.slug
       from public.campgrounds c
       where c.slug = $1
         and c.lifecycle_state = 'active'
       limit 1`,
      [campgroundSlug],
    );
    if (campgroundResult.rowCount !== 1) {
      throw new Error("Campground is unavailable.");
    }
    const campground = campgroundResult.rows[0];

    const mapResult = await client.query(
      `select
         v.id,
         v.media_asset_id,
         v.version_number,
         v.label,
         v.source_width,
         v.source_height,
         v.published_at
       from icamp_private.campground_map_image_versions v
       where v.campground_id = $1
         and v.is_published
       limit 1`,
      [campground.id],
    );
    if (mapResult.rowCount !== 1) {
      throw new Error("Published campground map is unavailable.");
    }
    const map = mapResult.rows[0];

    const result = await client.query(
      `select
         a.id as accommodation_id,
         a.code,
         a.display_name,
         a.accommodation_kind,
         a.status_state,
         a.availability_revision,
         p.geometry,
         av.reservation_blocked,
         av.hold_blocked,
         av.restriction_blocked,
         av.turnover_blocked,
         av.seasonal_blocked
       from public.accommodations a
       join icamp_private.campground_map_object_bindings b
         on b.map_object_id = a.map_object_id
        and b.campground_id = a.campground_id
       join icamp_private.campground_map_polygons p
         on p.id = b.polygon_id
        and p.map_image_version_id = b.map_image_version_id
       join icamp_private.live_accommodation_availability($1, $3, $4) av
         on av.accommodation_id = a.id
       where a.campground_id = $1
         and a.lifecycle_state = 'active'
         and b.map_image_version_id = $2
         and b.geometry_kind = 'polygon'
         and p.archived_at is null
         and not p.is_hidden
         and ($5 = 'all' or a.accommodation_kind = $5)
       order by a.code, a.display_name`,
      [
        campground.id,
        map.id,
        filters.arrivalDate,
        filters.departureDate,
        filters.kind,
      ],
    );

    const items = result.rows.map((row) => {
      const blockers = [];
      if (row.reservation_blocked) blockers.push("reservation");
      if (row.hold_blocked) blockers.push("temporary_hold");
      if (row.restriction_blocked) blockers.push("management_restriction");
      if (row.turnover_blocked) blockers.push("turnover");
      if (row.seasonal_blocked) blockers.push("seasonal_assignment");
      const presentation = publicBookingMapPresentation({
        statusState: row.status_state,
        blockers,
      });
      return {
        accommodationId: row.accommodation_id,
        code: row.code,
        displayName: row.display_name,
        accommodationKind: row.accommodation_kind,
        statusState: row.status_state,
        availabilityRevision: Number(row.availability_revision ?? 0),
        blockers,
        geometry: row.geometry,
        ...presentation,
      };
    });

    return {
      campground: {
        id: campground.id,
        name: campground.name,
        slug: campground.slug,
      },
      map: {
        id: map.id,
        mediaAssetId: map.media_asset_id,
        versionNumber: Number(map.version_number),
        label: map.label,
        sourceWidth: Number(map.source_width),
        sourceHeight: Number(map.source_height),
        publishedAt: map.published_at,
      },
      ...filters,
      generatedAt: new Date().toISOString(),
      items:
        filters.availability === "available"
          ? items.filter((item) => item.selectable)
          : items,
    };
  } finally {
    client.release();
  }
}
