import pg from "pg";

import { appendAuditEvent } from "../audit/postgres.mjs";
import { hasCampgroundPermission } from "../authz/postgres.mjs";
import {
  accommodationMapObjectKind,
  createAvailabilityHook,
  createStatusHook,
  validateAccommodationKind,
} from "./hooks.mjs";

const { Pool } = pg;
let pool;

function databaseUrl() {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) {
    throw new Error("DATABASE_URL is required for accommodation operations.");
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

function requiredText(value, label, maxLength = 160) {
  const normalized = String(value ?? "").trim();
  if (!normalized || normalized.length > maxLength) {
    throw new Error(
      label + " must be between 1 and " + maxLength + " characters.",
    );
  }
  return normalized;
}

function normalizeCode(value) {
  const code = requiredText(value, "Accommodation code", 64);
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u.test(code)) {
    throw new Error(
      "Accommodation code must use letters, numbers, dots, underscores or hyphens.",
    );
  }
  return code;
}

function normalizeLifecycle(value) {
  const lifecycle = String(value ?? "active").trim();
  if (!["active", "inactive"].includes(lifecycle)) {
    throw new Error("Accommodation lifecycle state is invalid.");
  }
  return lifecycle;
}

async function assertPermission(userId, campgroundId, permissionKey) {
  if (!(await hasCampgroundPermission(userId, campgroundId, permissionKey))) {
    throw new Error("Not authorized for this accommodation operation.");
  }
}

async function validatePlacement(
  client,
  campgroundId,
  sectionId,
  subsectionId,
) {
  const section = await client.query(
    `select organization_id
     from public.campground_sections
     where id = $1
       and campground_id = $2
       and lifecycle_state <> 'archived'
     limit 1`,
    [sectionId, campgroundId],
  );
  if (section.rowCount !== 1) {
    throw new Error("Accommodation section is unavailable.");
  }

  if (subsectionId) {
    const subsection = await client.query(
      `select 1
       from public.campground_subsections
       where id = $1
         and campground_id = $2
         and section_id = $3
         and lifecycle_state <> 'archived'
       limit 1`,
      [subsectionId, campgroundId, sectionId],
    );
    if (subsection.rowCount !== 1) {
      throw new Error("Accommodation subsection is unavailable.");
    }
  }

  return section.rows[0].organization_id;
}

function mapRow(row) {
  const accommodation = {
    id: row.id,
    organizationId: row.organization_id,
    campgroundId: row.campground_id,
    sectionId: row.section_id,
    sectionName: row.section_name,
    subsectionId: row.subsection_id,
    subsectionName: row.subsection_name ?? null,
    mapObjectId: row.map_object_id,
    kind: row.accommodation_kind,
    code: row.code,
    displayName: row.display_name,
    lifecycleState: row.lifecycle_state,
    availabilityRevision: Number(row.availability_revision),
    statusRevision: Number(row.status_revision),
    rowVersion: Number(row.row_version),
    subtypeLinked:
      Boolean(row.campsite_id) ||
      Boolean(row.cottage_id) ||
      Boolean(row.permanent_unit_id),
  };

  return {
    ...accommodation,
    availabilityHook: createAvailabilityHook(accommodation),
    statusHook: createStatusHook(accommodation),
  };
}

async function withRls(userId, callback) {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    await client.query("set local role icamp_app");
    await client.query("select set_config('icamp.user_id', $1, true)", [
      userId,
    ]);
    const result = await callback(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function closeAccommodationPoolForTests() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

export async function listAccommodations(userId, campgroundId) {
  const canRead = await hasCampgroundPermission(
    userId,
    campgroundId,
    "accommodation.read",
  );
  const canManage = await hasCampgroundPermission(
    userId,
    campgroundId,
    "accommodation.manage",
  );
  if (!canRead && !canManage) {
    throw new Error(
      "Not authorized to read campground accommodation inventory.",
    );
  }

  return withRls(userId, async (client) => {
    const result = await client.query(
      `select
         a.*,
         s.name as section_name,
         ss.name as subsection_name,
         cs.accommodation_id as campsite_id,
         rc.accommodation_id as cottage_id,
         pu.accommodation_id as permanent_unit_id
       from public.accommodations a
       join public.campground_sections s
         on s.id = a.section_id
        and s.organization_id = a.organization_id
        and s.campground_id = a.campground_id
       left join public.campground_subsections ss
         on ss.id = a.subsection_id
        and ss.organization_id = a.organization_id
        and ss.campground_id = a.campground_id
        and ss.section_id = a.section_id
       left join public.campsites cs
         on cs.accommodation_id = a.id
       left join public.rental_cottages rc
         on rc.accommodation_id = a.id
       left join public.permanent_units pu
         on pu.accommodation_id = a.id
       where a.campground_id = $1
         and a.lifecycle_state <> 'archived'
       order by a.accommodation_kind, a.code, a.display_name`,
      [campgroundId],
    );
    return result.rows.map(mapRow);
  });
}

async function insertSubtype(
  client,
  kind,
  accommodationId,
  organizationId,
  campgroundId,
) {
  if (kind === "campsite") {
    await client.query(
      `insert into public.campsites (
         accommodation_id,
         organization_id,
         campground_id
       )
       values ($1, $2, $3)`,
      [accommodationId, organizationId, campgroundId],
    );
    return;
  }

  if (kind === "rental_cottage") {
    await client.query(
      `insert into public.rental_cottages (
         accommodation_id,
         organization_id,
         campground_id
       )
       values ($1, $2, $3)`,
      [accommodationId, organizationId, campgroundId],
    );
    return;
  }

  await client.query(
    `insert into public.permanent_units (
       accommodation_id,
       organization_id,
       campground_id
     )
     values ($1, $2, $3)`,
    [accommodationId, organizationId, campgroundId],
  );
}

export async function createAccommodation({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  sectionId,
  subsectionId = null,
  kind,
  code,
  displayName,
}) {
  await assertPermission(actorUserId, campgroundId, "accommodation.manage");

  const normalizedKind = validateAccommodationKind(kind);
  const normalizedCode = normalizeCode(code);
  const normalizedName = requiredText(displayName, "Accommodation name");
  const normalizedSectionId = requiredText(sectionId, "Section ID", 64);
  const normalizedSubsectionId = String(subsectionId ?? "").trim() || null;
  const expectedMapKind = accommodationMapObjectKind(normalizedKind);

  const client = await getPool().connect();
  try {
    await client.query("begin");
    const organizationId = await validatePlacement(
      client,
      campgroundId,
      normalizedSectionId,
      normalizedSubsectionId,
    );

    const existingMap = await client.query(
      `select *
       from icamp_private.campground_map_objects
       where campground_id = $1
         and object_code = $2
       limit 1`,
      [campgroundId, normalizedCode],
    );

    let mapObjectId;
    let createdMapObject = false;
    if (existingMap.rowCount === 1) {
      const mapObject = existingMap.rows[0];
      if (
        mapObject.object_kind !== expectedMapKind ||
        mapObject.section_id !== normalizedSectionId ||
        mapObject.lifecycle_state === "archived"
      ) {
        throw new Error(
          "An incompatible canonical map object already uses this accommodation code.",
        );
      }

      const claimed = await client.query(
        `select 1
         from public.accommodations
         where map_object_id = $1
         limit 1`,
        [mapObject.id],
      );
      if (claimed.rowCount > 0) {
        throw new Error(
          "The canonical map object is already linked to accommodation inventory.",
        );
      }
      mapObjectId = mapObject.id;
    } else {
      const insertedMap = await client.query(
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
         returning id`,
        [
          organizationId,
          campgroundId,
          expectedMapKind,
          normalizedCode,
          normalizedName,
          normalizedSectionId,
          actorUserId,
        ],
      );
      mapObjectId = insertedMap.rows[0].id;
      createdMapObject = true;
    }

    await client.query("set local role icamp_app");
    await client.query("select set_config('icamp.user_id', $1, true)", [
      actorUserId,
    ]);

    const inserted = await client.query(
      `insert into public.accommodations (
         organization_id,
         campground_id,
         section_id,
         subsection_id,
         map_object_id,
         accommodation_kind,
         code,
         display_name,
         created_by_user_id,
         updated_by_user_id
       )
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
       returning *`,
      [
        organizationId,
        campgroundId,
        normalizedSectionId,
        normalizedSubsectionId,
        mapObjectId,
        normalizedKind,
        normalizedCode,
        normalizedName,
        actorUserId,
      ],
    );

    const row = inserted.rows[0];
    await insertSubtype(
      client,
      normalizedKind,
      row.id,
      organizationId,
      campgroundId,
    );

    await client.query("reset role");

    if (createdMapObject) {
      await appendAuditEvent(client, {
        actorUserId,
        actorSessionId,
        organizationId,
        campgroundId,
        actionKey: "accommodation.map_identity.create",
        permissionKey: "accommodation.manage",
        riskLevel: "standard",
        subjectType: "campground.map.object",
        subjectId: mapObjectId,
        afterState: {
          kind: expectedMapKind,
          code: normalizedCode,
          displayName: normalizedName,
          sectionId: normalizedSectionId,
        },
      });
    }

    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId,
      campgroundId,
      actionKey: "accommodation.create",
      permissionKey: "accommodation.manage",
      riskLevel: "standard",
      subjectType: "accommodation",
      subjectId: row.id,
      afterState: {
        kind: normalizedKind,
        code: normalizedCode,
        displayName: normalizedName,
        sectionId: normalizedSectionId,
        subsectionId: normalizedSubsectionId,
        mapObjectId,
        availabilityRevision: Number(row.availability_revision),
        statusRevision: Number(row.status_revision),
      },
    });

    await client.query("set constraints all immediate");
    await client.query("commit");
    return row.id;
  } catch (error) {
    await client.query("rollback");
    if (error?.code === "23505") {
      throw new Error("Accommodation code or map identity is already in use.");
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function updateAccommodation({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  accommodationId,
  expectedRowVersion,
  sectionId,
  subsectionId = null,
  code,
  displayName,
  lifecycleState,
}) {
  await assertPermission(actorUserId, campgroundId, "accommodation.manage");

  const normalizedCode = normalizeCode(code);
  const normalizedName = requiredText(displayName, "Accommodation name");
  const normalizedLifecycle = normalizeLifecycle(lifecycleState);
  const normalizedSectionId = requiredText(sectionId, "Section ID", 64);
  const normalizedSubsectionId = String(subsectionId ?? "").trim() || null;

  const client = await getPool().connect();
  try {
    await client.query("begin");
    await validatePlacement(
      client,
      campgroundId,
      normalizedSectionId,
      normalizedSubsectionId,
    );

    const beforeResult = await client.query(
      `select *
       from public.accommodations
       where id = $1
         and campground_id = $2
       limit 1`,
      [accommodationId, campgroundId],
    );
    if (beforeResult.rowCount !== 1) {
      throw new Error("Accommodation is unavailable.");
    }
    const before = beforeResult.rows[0];

    await client.query(
      `update icamp_private.campground_map_objects
       set object_code = $2,
           display_name = $3,
           section_id = $4,
           lifecycle_state = $5,
           updated_by_user_id = $6
       where id = $1`,
      [
        before.map_object_id,
        normalizedCode,
        normalizedName,
        normalizedSectionId,
        normalizedLifecycle,
        actorUserId,
      ],
    );

    await client.query("set local role icamp_app");
    await client.query("select set_config('icamp.user_id', $1, true)", [
      actorUserId,
    ]);

    const updated = await client.query(
      `update public.accommodations
       set section_id = $3,
           subsection_id = $4,
           code = $5,
           display_name = $6,
           lifecycle_state = $7,
           availability_revision =
             availability_revision + case when lifecycle_state is distinct from $7 then 1 else 0 end,
           status_revision =
             status_revision + case when lifecycle_state is distinct from $7 then 1 else 0 end,
           updated_by_user_id = $8
       where id = $1
         and campground_id = $2
         and row_version = $9
       returning *`,
      [
        accommodationId,
        campgroundId,
        normalizedSectionId,
        normalizedSubsectionId,
        normalizedCode,
        normalizedName,
        normalizedLifecycle,
        actorUserId,
        Number(expectedRowVersion),
      ],
    );

    if (updated.rowCount !== 1) {
      throw new Error(
        "Accommodation changed since this page was loaded. Refresh and try again.",
      );
    }

    await client.query("reset role");
    const row = updated.rows[0];

    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: row.organization_id,
      campgroundId,
      actionKey: "accommodation.update",
      permissionKey: "accommodation.manage",
      riskLevel: "standard",
      subjectType: "accommodation",
      subjectId: accommodationId,
      beforeState: {
        code: before.code,
        displayName: before.display_name,
        sectionId: before.section_id,
        subsectionId: before.subsection_id,
        lifecycleState: before.lifecycle_state,
        availabilityRevision: Number(before.availability_revision),
        statusRevision: Number(before.status_revision),
      },
      afterState: {
        code: row.code,
        displayName: row.display_name,
        sectionId: row.section_id,
        subsectionId: row.subsection_id,
        lifecycleState: row.lifecycle_state,
        availabilityRevision: Number(row.availability_revision),
        statusRevision: Number(row.status_revision),
      },
    });

    await client.query("commit");
    return {
      rowVersion: Number(row.row_version),
      availabilityRevision: Number(row.availability_revision),
      statusRevision: Number(row.status_revision),
    };
  } catch (error) {
    await client.query("rollback");
    if (error?.code === "23505") {
      throw new Error("Accommodation code or map identity is already in use.");
    }
    throw error;
  } finally {
    client.release();
  }
}
