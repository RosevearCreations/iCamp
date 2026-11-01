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
         cs.campsite_type,
         cs.service_level,
         cs.is_waterfront,
         cs.electrical_amperage,
         cs.water_service,
         cs.wifi_service,
         cs.max_rv_length_meters,
         cs.pull_through,
         cs.has_fire_ring,
         cs.has_picnic_table,
         cs.accessible_site,
         rc.max_occupancy,
         rc.bedroom_count,
         rc.step_free_access,
         rc.accessible_washroom,
         rc.kitchen_type,
         coalesce(cs.pets_allowed, rc.pets_allowed) as pets_allowed,
         coalesce(cs.max_pets, rc.max_pets) as max_pets,
         gallery.photo_count,
         gallery.described_photo_count,
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
       left join public.campsites cs
         on cs.accommodation_id = a.id
        and cs.campground_id = a.campground_id
       left join public.rental_cottages rc
         on rc.accommodation_id = a.id
        and rc.campground_id = a.campground_id
       left join lateral (
         select
           count(*)::integer as photo_count,
           count(*) filter (where nullif(trim(g.alt_text), '') is not null)::integer
             as described_photo_count
         from public.accommodation_public_gallery_images g
         join icamp_private.media_assets m
           on m.id = g.optimized_media_asset_id
          and m.classification = 'public'
          and m.lifecycle_state = 'active'
         where g.campground_id = a.campground_id
           and g.accommodation_id = a.id
           and g.is_active
       ) gallery on true
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
        discovery: {
          campsiteType: row.campsite_type ?? null,
          serviceLevel: row.service_level ?? null,
          isWaterfront: row.is_waterfront ?? null,
          electricalAmperage: row.electrical_amperage ?? null,
          waterService: row.water_service ?? null,
          wifiService: row.wifi_service ?? null,
          maxRvLengthMeters:
            row.max_rv_length_meters === null
              ? null
              : Number(row.max_rv_length_meters),
          pullThrough: row.pull_through ?? null,
          hasFireRing: row.has_fire_ring ?? null,
          hasPicnicTable: row.has_picnic_table ?? null,
          accessibleSite: row.accessible_site ?? null,
          maxOccupancy: row.max_occupancy ?? null,
          bedroomCount: row.bedroom_count ?? null,
          stepFreeAccess: row.step_free_access ?? null,
          accessibleWashroom: row.accessible_washroom ?? null,
          kitchenType: row.kitchen_type ?? null,
          petsAllowed: row.pets_allowed ?? null,
          maxPets: row.max_pets ?? null,
          photoCount: Number(row.photo_count ?? 0),
          describedPhotoCount: Number(row.described_photo_count ?? 0),
        },
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
