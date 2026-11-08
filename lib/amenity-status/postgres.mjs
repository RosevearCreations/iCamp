import pg from "pg";

import { hasCampgroundPermission } from "../authz/postgres.mjs";

const { Pool } = pg;
let pool;

function getPool() {
  if (!pool) {
    if (!process.env.DATABASE_URL?.trim()) {
      throw new Error(
        "DATABASE_URL is required for amenity publication review.",
      );
    }
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
  }
  return pool;
}

export async function closeAmenityStatusPoolForTests() {
  if (pool) await pool.end();
  pool = undefined;
}

const staffAmenityPermissions = [
  "asset.read",
  "asset.manage",
  "maintenance.read",
  "maintenance.create",
  "maintenance.assign",
  "maintenance.complete",
];

async function assertStaffAmenityAccess(userId, campgroundId) {
  const allowed = await Promise.all(
    staffAmenityPermissions.map((key) =>
      hasCampgroundPermission(userId, campgroundId, key),
    ),
  );
  if (!allowed.some(Boolean)) {
    throw new Error("Not authorized to read campground amenity status.");
  }
}

/** Deliberate least-privilege facility summary for asset or maintenance staff. */
export async function listStaffAmenityAssets(userId, campgroundId) {
  await assertStaffAmenityAccess(userId, campgroundId);
  const result = await getPool().query(
    `select a.id,a.asset_class,a.lifecycle_state,a.map_object_id,
       a.display_name,a.code,a.operating_state,a.row_version,
       s.name as section_name,o.object_kind as map_object_kind,
       f.facility_type
     from public.operational_assets a
     left join public.campground_sections s
       on s.id=a.section_id and s.campground_id=a.campground_id
     left join icamp_private.campground_map_objects o
       on o.id=a.map_object_id and o.campground_id=a.campground_id
     left join public.operational_facilities f
       on f.asset_id=a.id and f.campground_id=a.campground_id
     where a.campground_id=$1 and a.asset_class='facility'
       and a.lifecycle_state <> 'archived'
     order by a.display_name`,
    [campgroundId],
  );
  return result.rows.map((row) => ({
    id: row.id,
    assetClass: row.asset_class,
    lifecycleState: row.lifecycle_state,
    mapObjectId: row.map_object_id,
    displayName: row.display_name,
    code: row.code,
    operatingState: row.operating_state,
    rowVersion: Number(row.row_version),
    sectionName: row.section_name,
    mapObjectKind: row.map_object_kind,
    facility: row.facility_type ? { facilityType: row.facility_type } : null,
  }));
}

/** Minimal maintenance summary; no notes, evidence, workers or cost records. */
export async function listActiveAmenityWorkOrderSummaries(
  userId,
  campgroundId,
) {
  const permissions = await Promise.all(
    [
      "maintenance.read",
      "maintenance.create",
      "maintenance.assign",
      "maintenance.complete",
    ].map((key) => hasCampgroundPermission(userId, campgroundId, key)),
  );
  if (!permissions.some(Boolean)) {
    throw new Error("Not authorized to read campground maintenance.");
  }
  const client = await getPool().connect();
  try {
    await client.query("begin");
    await client.query("set local role icamp_app");
    await client.query("select set_config('icamp.user_id',$1,true)", [userId]);
    const result = await client.query(
      `select w.id, w.asset_id, w.title, w.status, p.priority_key,
         (w.completion_due_at < statement_timestamp()) as is_past_completion_target
       from public.maintenance_work_orders w
       join public.maintenance_priority_policies p
         on p.id=w.priority_policy_id and p.campground_id=w.campground_id
       where w.campground_id=$1
         and w.asset_id is not null
         and w.status in ('open','assigned','in_progress','blocked')
       order by w.updated_at desc`,
      [campgroundId],
    );
    await client.query("commit");
    return result.rows.map((row) => ({
      id: row.id,
      assetId: row.asset_id,
      title: row.title,
      status: row.status,
      priorityKey: row.priority_key,
      isPastCompletionTarget: row.is_past_completion_target === true,
    }));
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/** Read ONLY the published guest view, never internal draft or unapproved notes. */
export async function listPublishedAmenityStatusForStaff(userId, campgroundId) {
  await assertStaffAmenityAccess(userId, campgroundId);

  const exists = await getPool().query(
    `select exists (
       select 1 from pg_attribute
       where attrelid=to_regclass('icamp_private.campground_wayfinding_publications')
         and attname='service_is_published' and not attisdropped
     ) as ready`,
  );
  if (!exists.rows[0]?.ready)
    return { migrationReady: false, publications: [] };

  const result = await getPool().query(
    `select o.id as map_object_id, o.object_code, o.object_kind, o.display_name,
       w.service_is_published, w.service_operating_status,
       w.service_hours_summary, w.service_accessibility_details,
       w.service_reviewed_at
     from icamp_private.campground_wayfinding_publications w
     join icamp_private.campground_map_objects o
       on o.id=w.map_object_id and o.campground_id=w.campground_id
     join icamp_private.campground_map_object_bindings b
       on b.map_object_id=o.id and b.campground_id=o.campground_id
         and b.map_image_version_id=w.map_image_version_id
     join icamp_private.campground_map_layers l
       on l.id=b.layer_id and l.campground_id=o.campground_id
     join icamp_private.campground_map_image_versions v
       on v.id=w.map_image_version_id and v.campground_id=o.campground_id
     where w.campground_id=$1 and o.lifecycle_state='active'
       and o.object_kind in ('pool','washroom','dock','building')
       and w.is_published and b.geometry_kind='point'
       and b.point_geometry is not null and l.layer_key='amenities'
       and l.is_enabled and v.is_published
     order by o.display_name`,
    [campgroundId],
  );
  return {
    migrationReady: true,
    publications: result.rows.map((row) => ({
      mapObjectId: row.map_object_id,
      code: row.object_code,
      kind: row.object_kind,
      name: row.display_name,
      locationPublished: true,
      service: {
        isPublished:
          row.service_is_published === true && Boolean(row.service_reviewed_at),
        operatingStatus: row.service_is_published
          ? row.service_operating_status
          : "unknown",
        hoursSummary: row.service_is_published ? row.service_hours_summary : "",
        accessibilityDetails: row.service_is_published
          ? row.service_accessibility_details
          : "",
        reviewedAt: row.service_is_published ? row.service_reviewed_at : null,
      },
    })),
  };
}
