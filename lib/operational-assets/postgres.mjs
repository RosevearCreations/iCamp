import pg from "pg";

import { appendAuditEvent } from "../audit/postgres.mjs";
import { hasCampgroundPermission } from "../authz/postgres.mjs";

const { Pool } = pg;
let pool;

const facilityTypes = [
  "pool", "water_park", "washroom", "sports_field", "playground", "hall",
  "beach", "dock", "launch", "road", "parking", "gate", "building",
  "garbage_area", "septic_area", "utility", "other",
];
const equipmentTypes = [
  "tractor", "mower", "maintenance_vehicle", "cart", "trailer",
  "power_equipment", "watercraft", "other",
];

function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL?.trim();
    if (!connectionString) throw new Error("DATABASE_URL is required for operational asset operations.");
    pool = new Pool({ connectionString, max: 5, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 5_000 });
  }
  return pool;
}

function requiredText(value, label, max = 160) {
  const result = String(value ?? "").trim();
  if (!result || result.length > max) throw new Error(label + " must be between 1 and " + max + " characters.");
  return result;
}
function optionalText(value, max) {
  const result = String(value ?? "").trim();
  if (!result) return null;
  if (result.length > max) throw new Error("Text exceeds the maximum supported length.");
  return result;
}
function choice(value, label, allowed) {
  const result = String(value ?? "").trim();
  if (!allowed.includes(result)) throw new Error(label + " is invalid.");
  return result;
}
function codeValue(value) {
  const result = requiredText(value, "Asset code", 64);
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u.test(result)) throw new Error("Asset code contains unsupported characters.");
  return result;
}
function mapKind(type) {
  if (["pool", "washroom", "dock", "road", "gate", "building"].includes(type)) return type;
  if (type === "hall") return "building";
  return "asset";
}
function permission(assetClass, action) {
  return (assetClass === "equipment" ? "equipment." : "asset.") + action;
}
async function allowed(userId, campgroundId, key) {
  return hasCampgroundPermission(userId, campgroundId, key);
}
async function assertPermission(userId, campgroundId, assetClass, action) {
  if (!(await allowed(userId, campgroundId, permission(assetClass, action)))) {
    throw new Error("Not authorized for this operational asset operation.");
  }
}
async function withRls(userId, callback) {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    await client.query("set local role icamp_app");
    await client.query("select set_config('icamp.user_id', $1, true)", [userId]);
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
function meterValue(value, kind) {
  if (kind === "none") return null;
  const result = Number(value);
  if (!Number.isFinite(result) || result < 0) throw new Error("Meter reading must be zero or a positive number.");
  return Math.round(result * 100) / 100;
}
function mapRow(row) {
  return {
    id: row.id,
    organizationId: row.organization_id,
    campgroundId: row.campground_id,
    sectionId: row.section_id,
    sectionName: row.section_name ?? null,
    mapObjectId: row.map_object_id,
    mapObjectKind: row.map_object_kind ?? null,
    mapBound: Boolean(row.map_bound),
    assetClass: row.asset_class,
    code: row.code,
    displayName: row.display_name,
    lifecycleState: row.lifecycle_state,
    operatingState: row.operating_state,
    statusRevision: Number(row.status_revision),
    notes: row.notes ?? "",
    rowVersion: Number(row.row_version),
    facility: row.facility_type ? {
      facilityType: row.facility_type,
      guestVisibility: row.guest_visibility,
      rowVersion: Number(row.facility_row_version),
    } : null,
    equipment: row.equipment_type ? {
      equipmentType: row.equipment_type,
      make: row.make ?? "",
      model: row.model ?? "",
      serialNumber: row.serial_number ?? "",
      ownershipType: row.ownership_type,
      meterKind: row.meter_kind,
      meterValue: row.meter_value === null ? null : Number(row.meter_value),
      storageLocation: row.storage_location ?? "",
      rowVersion: Number(row.equipment_row_version),
    } : null,
  };
}

export async function closeOperationalAssetPoolForTests() {
  if (pool) { await pool.end(); pool = undefined; }
}

export async function listOperationalAssets(userId, campgroundId) {
  const canRead =
    (await allowed(userId, campgroundId, "asset.read")) ||
    (await allowed(userId, campgroundId, "asset.manage")) ||
    (await allowed(userId, campgroundId, "equipment.read")) ||
    (await allowed(userId, campgroundId, "equipment.manage"));
  if (!canRead) throw new Error("Not authorized to read operational assets.");

  return withRls(userId, async (client) => {
    const result = await client.query(
      `select a.*, s.name as section_name, mo.object_kind as map_object_kind,
         (mob.id is not null) as map_bound,
         f.facility_type, f.guest_visibility, f.row_version as facility_row_version,
         e.equipment_type, e.make, e.model, e.serial_number, e.ownership_type,
         e.meter_kind, e.meter_value, e.storage_location,
         e.row_version as equipment_row_version
       from public.operational_assets a
       left join public.campground_sections s on s.id = a.section_id
       left join icamp_private.campground_map_objects mo on mo.id = a.map_object_id
       left join icamp_private.campground_map_object_bindings mob on mob.map_object_id = a.map_object_id
       left join public.operational_facilities f on f.asset_id = a.id
       left join public.operational_equipment e on e.asset_id = a.id
       where a.campground_id = $1 and a.lifecycle_state <> 'archived'
       order by a.asset_class, a.code, a.display_name`,
      [campgroundId],
    );
    return result.rows.map(mapRow);
  });
}

export async function listOperationalMapObjects(userId, campgroundId) {
  const canRead =
    (await allowed(userId, campgroundId, "asset.read")) ||
    (await allowed(userId, campgroundId, "asset.manage")) ||
    (await allowed(userId, campgroundId, "equipment.read")) ||
    (await allowed(userId, campgroundId, "equipment.manage"));
  if (!canRead) throw new Error("Not authorized to read operational map identities.");

  const result = await getPool().query(
    `select mo.id, mo.object_kind, mo.object_code, mo.display_name, mo.section_id,
       s.name as section_name, (mob.id is not null) as map_bound
     from icamp_private.campground_map_objects mo
     left join public.campground_sections s on s.id = mo.section_id
     left join icamp_private.campground_map_object_bindings mob on mob.map_object_id = mo.id
     left join public.accommodations acc on acc.map_object_id = mo.id
     left join public.operational_assets oa on oa.map_object_id = mo.id
     where mo.campground_id = $1
       and mo.lifecycle_state <> 'archived'
       and mo.object_kind in ('pool','washroom','gate','dock','road','building','asset')
       and acc.id is null and oa.id is null
     order by mo.object_kind, mo.object_code`,
    [campgroundId],
  );
  return result.rows.map((row) => ({
    id: row.id,
    objectKind: row.object_kind,
    code: row.object_code,
    displayName: row.display_name,
    sectionId: row.section_id,
    sectionName: row.section_name ?? null,
    mapBound: Boolean(row.map_bound),
  }));
}

async function getOrganization(client, campgroundId, sectionId) {
  if (sectionId) {
    const result = await client.query(
      "select organization_id from public.campground_sections where id = $1 and campground_id = $2 and lifecycle_state <> 'archived' limit 1",
      [sectionId, campgroundId],
    );
    if (result.rowCount !== 1) throw new Error("Campground section is unavailable.");
    return result.rows[0].organization_id;
  }
  const result = await client.query("select organization_id from public.campgrounds where id = $1 limit 1", [campgroundId]);
  if (result.rowCount !== 1) throw new Error("Campground is unavailable.");
  return result.rows[0].organization_id;
}

async function resolveMapObject(client, input) {
  if (input.mapObjectId) {
    const result = await client.query(
      `select mo.id
       from icamp_private.campground_map_objects mo
       left join public.accommodations a on a.map_object_id = mo.id
       left join public.operational_assets oa on oa.map_object_id = mo.id
       where mo.id = $1 and mo.organization_id = $2 and mo.campground_id = $3
         and mo.lifecycle_state <> 'archived' and a.id is null and oa.id is null
       limit 1`,
      [input.mapObjectId, input.organizationId, input.campgroundId],
    );
    if (result.rowCount !== 1) throw new Error("Map identity is unavailable or already in use.");
    return result.rows[0].id;
  }
  if (input.assetClass === "equipment") return null;
  const result = await client.query(
    `insert into icamp_private.campground_map_objects (
       organization_id, campground_id, object_kind, object_code, display_name,
       section_id, created_by_user_id, updated_by_user_id
     ) values ($1,$2,$3,$4,$5,$6,$7,$7) returning id`,
    [input.organizationId, input.campgroundId, mapKind(input.detailType), input.code, input.displayName, input.sectionId || null, input.actorUserId],
  );
  return result.rows[0].id;
}

export async function createOperationalAsset(input) {
  const assetClass = choice(input.assetClass, "Asset class", ["facility", "equipment"]);
  await assertPermission(input.actorUserId, input.campgroundId, assetClass, "manage");
  const code = codeValue(input.code);
  const displayName = requiredText(input.displayName, "Asset name");
  const operatingState = choice(input.operatingState ?? "unknown", "Operating state", ["unknown","operational","limited","unavailable","seasonal"]);
  const detailType = assetClass === "facility"
    ? choice(input.detailType, "Facility type", facilityTypes)
    : choice(input.detailType, "Equipment type", equipmentTypes);

  const client = await getPool().connect();
  try {
    await client.query("begin");
    const organizationId = await getOrganization(client, input.campgroundId, input.sectionId || null);
    const mapObjectId = await resolveMapObject(client, {
      ...input, assetClass, detailType, code, displayName, organizationId,
    });
    await client.query("set local role icamp_app");
    await client.query("select set_config('icamp.user_id', $1, true)", [input.actorUserId]);
    const parent = await client.query(
      `insert into public.operational_assets (
        organization_id,campground_id,section_id,map_object_id,asset_class,code,
        display_name,operating_state,notes,created_by_user_id,updated_by_user_id
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10) returning *`,
      [organizationId,input.campgroundId,input.sectionId || null,mapObjectId,assetClass,code,displayName,operatingState,optionalText(input.notes,2000),input.actorUserId],
    );
    const row = parent.rows[0];
    if (assetClass === "facility") {
      await client.query(
        "insert into public.operational_facilities (asset_id,organization_id,campground_id,facility_type,guest_visibility) values ($1,$2,$3,$4,$5)",
        [row.id,organizationId,input.campgroundId,detailType,choice(input.guestVisibility ?? "internal","Guest visibility",["internal","public_candidate"])],
      );
    } else {
      const meterKind = choice(input.meterKind ?? "none","Meter kind",["none","hours","odometer_km","cycles"]);
      await client.query(
        `insert into public.operational_equipment (
          asset_id,organization_id,campground_id,equipment_type,make,model,serial_number,
          ownership_type,meter_kind,meter_value,storage_location
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [row.id,organizationId,input.campgroundId,detailType,optionalText(input.make,120),optionalText(input.model,120),optionalText(input.serialNumber,160),
         choice(input.ownershipType ?? "owned","Ownership type",["owned","leased","rented","loaned","contractor","other"]),
         meterKind,meterValue(input.meterReading,meterKind),optionalText(input.storageLocation,240)],
      );
    }
    await client.query("set constraints all immediate");
    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId: input.actorUserId,
      actorSessionId: input.actorSessionId ?? null,
      organizationId,
      campgroundId: input.campgroundId,
      actionKey: assetClass === "facility" ? "asset.create" : "equipment.create",
      permissionKey: permission(assetClass, "manage"),
      riskLevel: "standard",
      subjectType: "operational_asset",
      subjectId: row.id,
      afterState: { assetClass, code, displayName, detailType, mapObjectId, operatingState },
    });
    await client.query("commit");
    return row.id;
  } catch (error) {
    await client.query("rollback");
    if (error?.code === "23505") throw new Error("Asset code, serial number or map identity is already in use.");
    throw error;
  } finally {
    client.release();
  }
}

export async function updateOperationalAsset(input) {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const found = await client.query(
      `select a.*, f.guest_visibility, e.make, e.model, e.serial_number,
         e.ownership_type, e.meter_kind, e.meter_value, e.storage_location
       from public.operational_assets a
       left join public.operational_facilities f on f.asset_id = a.id
       left join public.operational_equipment e on e.asset_id = a.id
       where a.id = $1 and a.campground_id = $2 limit 1 for update`,
      [input.assetId, input.campgroundId],
    );
    if (found.rowCount !== 1) throw new Error("Operational asset is unavailable.");
    const before = found.rows[0];
    await assertPermission(input.actorUserId, input.campgroundId, before.asset_class, "manage");

    const code = codeValue(input.code);
    const displayName = requiredText(input.displayName, "Asset name");
    const lifecycleState = choice(input.lifecycleState, "Lifecycle state", ["active","inactive"]);
    const operatingState = choice(input.operatingState, "Operating state", ["unknown","operational","limited","unavailable","seasonal"]);

    if (before.map_object_id) {
      await client.query(
        "update icamp_private.campground_map_objects set object_code=$2,display_name=$3,lifecycle_state=$4,updated_by_user_id=$5 where id=$1",
        [before.map_object_id,code,displayName,lifecycleState,input.actorUserId],
      );
    }

    await client.query("set local role icamp_app");
    await client.query("select set_config('icamp.user_id', $1, true)", [input.actorUserId]);
    const updated = await client.query(
      `update public.operational_assets
       set code=$3,display_name=$4,lifecycle_state=$5,operating_state=$6,
           notes=$7,updated_by_user_id=$8
       where id=$1 and campground_id=$2 and row_version=$9 returning *`,
      [input.assetId,input.campgroundId,code,displayName,lifecycleState,operatingState,optionalText(input.notes,2000),input.actorUserId,Number(input.expectedRowVersion)],
    );
    if (updated.rowCount !== 1) throw new Error("Operational asset changed since this page was loaded. Refresh and try again.");

    if (before.asset_class === "facility") {
      await client.query(
        "update public.operational_facilities set guest_visibility=$2 where asset_id=$1",
        [input.assetId,choice(input.guestVisibility ?? "internal","Guest visibility",["internal","public_candidate"])],
      );
    } else {
      const meterKind = choice(input.meterKind ?? "none","Meter kind",["none","hours","odometer_km","cycles"]);
      await client.query(
        `update public.operational_equipment
         set make=$2,model=$3,serial_number=$4,ownership_type=$5,meter_kind=$6,
             meter_value=$7,storage_location=$8
         where asset_id=$1`,
        [input.assetId,optionalText(input.make,120),optionalText(input.model,120),optionalText(input.serialNumber,160),
         choice(input.ownershipType ?? "owned","Ownership type",["owned","leased","rented","loaned","contractor","other"]),
         meterKind,meterValue(input.meterReading,meterKind),optionalText(input.storageLocation,240)],
      );
    }

    await client.query("set constraints all immediate");
    await client.query("reset role");
    const row = updated.rows[0];
    await appendAuditEvent(client, {
      actorUserId: input.actorUserId,
      actorSessionId: input.actorSessionId ?? null,
      organizationId: row.organization_id,
      campgroundId: input.campgroundId,
      actionKey: before.asset_class === "facility" ? "asset.update" : "equipment.update",
      permissionKey: permission(before.asset_class, "manage"),
      riskLevel: "standard",
      subjectType: "operational_asset",
      subjectId: input.assetId,
      beforeState: { code: before.code, displayName: before.display_name, lifecycleState: before.lifecycle_state, operatingState: before.operating_state },
      afterState: { code: row.code, displayName: row.display_name, lifecycleState: row.lifecycle_state, operatingState: row.operating_state, statusRevision: Number(row.status_revision) },
    });
    await client.query("commit");
    return { rowVersion: Number(row.row_version), statusRevision: Number(row.status_revision) };
  } catch (error) {
    await client.query("rollback");
    if (error?.code === "23505") throw new Error("Asset code or serial number is already in use.");
    throw error;
  } finally {
    client.release();
  }
}
