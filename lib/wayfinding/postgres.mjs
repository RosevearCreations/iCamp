import pg from "pg";

import { appendAuditEvent } from "../audit/postgres.mjs";
import { hasCampgroundPermission } from "../authz/postgres.mjs";
import { normalizeWayfindingReview } from "./core.mjs";

const { Pool } = pg;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
let pool;

function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL?.trim();
    if (!connectionString)
      throw new Error("DATABASE_URL is required for wayfinding.");
    pool = new Pool({
      connectionString,
      max: 5,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
    });
  }
  return pool;
}

export async function closeWayfindingPoolForTests() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

function uuid(value, label) {
  const parsed = String(value ?? "").trim();
  if (!UUID.test(parsed)) throw new Error(`${label} must be a UUID.`);
  return parsed;
}

async function ensureReviewPermissions(userId, campgroundId) {
  const [configuration, publication] = await Promise.all([
    hasCampgroundPermission(userId, campgroundId, "campground.configuration"),
    hasCampgroundPermission(userId, campgroundId, "campground.map.publish"),
  ]);
  if (!configuration || !publication) {
    throw new Error(
      "Campground configuration and map publication permissions are required.",
    );
  }
}

export async function listWayfindingCandidates({ userId, campgroundId }) {
  await ensureReviewPermissions(userId, campgroundId);
  const result = await getPool().query(
    `select o.id,o.object_code,o.object_kind,o.display_name,o.lifecycle_state,
       b.map_image_version_id,b.geometry_kind,
       l.layer_key,l.is_enabled as layer_enabled,
       coalesce(v.is_published,false) as map_published,
       w.id as publication_id,w.is_published,w.public_description,
       w.accessibility_note,w.landmark_hint,w.row_version,w.reviewed_at
     from icamp_private.campground_map_objects o
     left join icamp_private.campground_map_object_bindings b
       on b.map_object_id=o.id and b.campground_id=o.campground_id
     left join icamp_private.campground_map_layers l
       on l.id=b.layer_id and l.campground_id=o.campground_id
     left join icamp_private.campground_map_image_versions v
       on v.id=b.map_image_version_id and v.campground_id=o.campground_id
     left join icamp_private.campground_wayfinding_publications w
       on w.map_object_id=o.id and w.campground_id=o.campground_id
     where o.campground_id=$1
       and o.object_kind in ('pool','washroom','dock','building')
       and o.lifecycle_state<>'archived'
     order by o.object_kind,o.display_name,o.object_code`,
    [uuid(campgroundId, "Campground")],
  );
  return result.rows.map((row) => ({
    id: row.id,
    code: row.object_code,
    kind: row.object_kind,
    name: row.display_name,
    lifecycleState: row.lifecycle_state,
    eligible:
      row.lifecycle_state === "active" &&
      row.geometry_kind === "point" &&
      row.layer_key === "amenities" &&
      row.layer_enabled === true &&
      row.map_published === true,
    mapPublished: row.map_published === true,
    bindingKind: row.geometry_kind ?? null,
    publication: {
      isPublished: row.is_published === true,
      description: row.public_description ?? "",
      accessibilityNote: row.accessibility_note ?? "",
      landmarkHint: row.landmark_hint ?? "",
      rowVersion: Number(row.row_version ?? 0),
      reviewedAt: row.reviewed_at ?? null,
    },
  }));
}

export async function saveWayfindingReview({
  actorUserId,
  actorSessionId = null,
  campgroundId: rawCampgroundId,
  mapObjectId: rawMapObjectId,
  expectedRowVersion,
  input,
}) {
  const campgroundId = uuid(rawCampgroundId, "Campground");
  const mapObjectId = uuid(rawMapObjectId, "Map object");
  const review = normalizeWayfindingReview(input);
  if (!Number.isSafeInteger(expectedRowVersion) || expectedRowVersion < 0) {
    throw new Error("Wayfinding row version is invalid.");
  }
  await ensureReviewPermissions(actorUserId, campgroundId);
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const source = await client.query(
      `select o.organization_id,o.id,o.lifecycle_state,o.object_kind,
         b.map_image_version_id,b.geometry_kind,
         l.layer_key,l.is_enabled as layer_enabled,
         coalesce(v.is_published,false) as map_published
       from icamp_private.campground_map_objects o
       left join icamp_private.campground_map_object_bindings b
         on b.map_object_id=o.id and b.campground_id=o.campground_id
       left join icamp_private.campground_map_layers l
         on l.id=b.layer_id and l.campground_id=o.campground_id
       left join icamp_private.campground_map_image_versions v
         on v.id=b.map_image_version_id and v.campground_id=o.campground_id
       where o.id=$1 and o.campground_id=$2
         and o.object_kind in ('pool','washroom','dock','building')
         and o.lifecycle_state<>'archived'
       for update of o`,
      [mapObjectId, campgroundId],
    );
    if (source.rowCount !== 1)
      throw new Error("An eligible campground amenity was not found.");
    const object = source.rows[0];
    const eligible =
      object.lifecycle_state === "active" &&
      object.geometry_kind === "point" &&
      object.layer_key === "amenities" &&
      object.layer_enabled === true &&
      object.map_published === true;
    if (review.isPublished && !eligible) {
      throw new Error(
        "Publish requires an active point bound to an enabled amenity layer on the current published map.",
      );
    }
    const previous = await client.query(
      `select id,row_version,is_published from icamp_private.campground_wayfinding_publications
       where map_object_id=$1 and campground_id=$2 for update`,
      [mapObjectId, campgroundId],
    );
    const prior = previous.rows[0];
    if (Number(prior?.row_version ?? 0) !== expectedRowVersion) {
      throw new Error("This wayfinding review changed. Refresh before saving.");
    }
    const values = [
      review.isPublished,
      review.description,
      review.accessibilityNote,
      review.landmarkHint,
      review.isPublished ? object.map_image_version_id : null,
      actorUserId,
    ];
    const result = prior
      ? await client.query(
          `update icamp_private.campground_wayfinding_publications
           set is_published=$1,public_description=$2,accessibility_note=$3,
               landmark_hint=$4,map_image_version_id=$5,
               reviewed_by_user_id=$6,reviewed_at=statement_timestamp()
           where id=$7 and row_version=$8
           returning id,row_version`,
          [...values, prior.id, expectedRowVersion],
        )
      : await client.query(
          `insert into icamp_private.campground_wayfinding_publications
             (organization_id,campground_id,map_object_id,is_published,
              public_description,accessibility_note,landmark_hint,
              map_image_version_id,reviewed_by_user_id,reviewed_at)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,statement_timestamp())
           returning id,row_version`,
          [object.organization_id, campgroundId, mapObjectId, ...values],
        );
    if (result.rowCount !== 1)
      throw new Error("Wayfinding review was not saved.");
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: object.organization_id,
      campgroundId,
      actionKey: "campground.wayfinding.review",
      permissionKey: review.isPublished
        ? "campground.map.publish"
        : "campground.configuration",
      riskLevel: "standard",
      subjectType: "campground.map.object",
      subjectId: mapObjectId,
      beforeState: prior ? { isPublished: prior.is_published } : null,
      afterState: {
        isPublished: review.isPublished,
        mapImageVersionId: review.isPublished
          ? object.map_image_version_id
          : null,
        rowVersion: Number(result.rows[0].row_version),
      },
      reason:
        "Campground staff reviewed public amenity notes; no route or access certification was generated.",
    });
    await client.query("commit");
    return { isPublished: review.isPublished };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    if (error?.code === "23505")
      throw new Error("Wayfinding review changed. Refresh and retry.");
    throw error;
  } finally {
    client.release();
  }
}
