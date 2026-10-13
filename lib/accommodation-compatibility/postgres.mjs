import pg from "pg";

import { appendAuditEvent } from "../audit/postgres.mjs";
import { hasCampgroundPermission } from "../authz/postgres.mjs";
import { evaluateAccommodationCapacity } from "../capacity-rules/postgres.mjs";
import {
  evaluateAccommodationCompatibility,
  assertCompatibleBookingChoice,
} from "./core.mjs";

const { Pool } = pg;
let pool;

function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL?.trim();
    if (!connectionString)
      throw new Error(
        "DATABASE_URL is required for accommodation compatibility.",
      );
    pool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }
  return pool;
}

export async function closeAccommodationCompatibilityPoolForTests() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

async function canRead(userId, campgroundId) {
  const keys = [
    "campground.configuration",
    "accommodation.read",
    "accommodation.manage",
    "reservation.read",
    "reservation.create",
    "reservation.modify",
    "reservation.override",
  ];
  const results = await Promise.all(
    keys.map((key) => hasCampgroundPermission(userId, campgroundId, key)),
  );
  return results.some(Boolean);
}

async function beginRls(client, userId) {
  await client.query("set local role icamp_app");
  await client.query("select set_config('icamp.user_id', $1, true)", [userId]);
}

function numberOrNull(value) {
  return value === null || value === undefined ? null : Number(value);
}

function mapAccommodation(row) {
  return {
    id: row.id,
    campgroundId: row.campground_id,
    sectionId: row.section_id,
    sectionName: row.section_name,
    code: row.code,
    displayName: row.display_name,
    accommodationKind: row.accommodation_kind,
    campsiteType: row.campsite_type ?? null,
    electricalAmperage: numberOrNull(row.electrical_amperage),
    waterService: row.water_service ?? null,
    wastewaterService: row.wastewater_service ?? null,
    wifiService: row.wifi_service ?? null,
    maxRvLengthMeters: numberOrNull(row.max_rv_length_meters),
    maxRvWidthMeters: numberOrNull(row.max_rv_width_meters),
    maxRvHeightMeters: numberOrNull(row.max_rv_height_meters),
    accessibleSite: row.accessible_site ?? false,
    physicalMaxOccupancy: numberOrNull(row.max_occupancy),
    kitchenType: row.kitchen_type ?? null,
    washroomType: row.washroom_type ?? null,
    showerType: row.shower_type ?? null,
    stepFreeAccess: row.step_free_access ?? false,
    accessibleWashroom: row.accessible_washroom ?? false,
    hasRefrigerator: row.has_refrigerator ?? false,
    petsAllowed:
      row.accommodation_kind === "campsite"
        ? (row.campsite_pets_allowed ?? false)
        : (row.cottage_pets_allowed ?? false),
    maxPets:
      row.accommodation_kind === "campsite"
        ? Number(row.campsite_max_pets ?? 0)
        : Number(row.cottage_max_pets ?? 0),
    detailRowVersion: Number(row.detail_row_version ?? 1),
  };
}

export async function getCompatibilitySnapshot(userId, campgroundId) {
  if (!(await canRead(userId, campgroundId)))
    throw new Error("Not authorized to read accommodation compatibility.");
  const client = await getPool().connect();
  try {
    await client.query("begin");
    await beginRls(client, userId);
    const result = await client.query(
      `select a.id, a.campground_id, a.section_id, s.name as section_name, a.code, a.display_name, a.accommodation_kind,
              cs.campsite_type, cs.electrical_amperage, cs.water_service, cs.wastewater_service, cs.wifi_service,
              cs.max_rv_length_meters, cs.max_rv_width_meters, cs.max_rv_height_meters, cs.accessible_site,
              cs.pets_allowed as campsite_pets_allowed, cs.max_pets as campsite_max_pets,
              rc.max_occupancy, rc.kitchen_type, rc.washroom_type, rc.shower_type, rc.step_free_access,
              rc.accessible_washroom, rc.has_refrigerator, rc.pets_allowed as cottage_pets_allowed,
              rc.max_pets as cottage_max_pets,
              coalesce(cs.row_version, rc.row_version, 1) as detail_row_version
       from public.accommodations a
       join public.campground_sections s on s.id = a.section_id and s.organization_id = a.organization_id and s.campground_id = a.campground_id
       left join public.campsites cs on cs.accommodation_id = a.id and cs.organization_id = a.organization_id and cs.campground_id = a.campground_id
       left join public.rental_cottages rc on rc.accommodation_id = a.id and rc.organization_id = a.organization_id and rc.campground_id = a.campground_id
       where a.campground_id = $1 and a.lifecycle_state = 'active' and a.accommodation_kind in ('campsite','rental_cottage')
       order by s.name, a.accommodation_kind, a.code`,
      [campgroundId],
    );
    await client.query("commit");
    return result.rows.map(mapAccommodation);
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function updateCompatibilityPolicy({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  accommodationId,
  expectedRowVersion,
  accessibleSite = false,
  petsAllowed = false,
  maxPets = 0,
}) {
  if (
    !(await hasCampgroundPermission(
      actorUserId,
      campgroundId,
      "accommodation.manage",
    ))
  ) {
    throw new Error("Not authorized to manage accommodation compatibility.");
  }
  const expected = Number(expectedRowVersion);
  const pets = Number(maxPets);
  if (!Number.isInteger(expected) || expected < 1)
    throw new Error("Compatibility row version is invalid.");
  if (!Number.isInteger(pets) || pets < 0 || pets > 20)
    throw new Error("Maximum pets must be between 0 and 20.");
  if (!petsAllowed && pets !== 0)
    throw new Error("Maximum pets must be zero when pets are not allowed.");
  if (petsAllowed && pets < 1)
    throw new Error("Maximum pets must be at least one when pets are allowed.");

  const client = await getPool().connect();
  try {
    await client.query("begin");
    const parent = await client.query(
      "select organization_id, accommodation_kind from public.accommodations where id = $1 and campground_id = $2 and lifecycle_state <> 'archived' limit 1",
      [accommodationId, campgroundId],
    );
    if (parent.rowCount !== 1) throw new Error("Accommodation is unavailable.");
    const kind = parent.rows[0].accommodation_kind;

    await beginRls(client, actorUserId);
    const table =
      kind === "campsite"
        ? "campsites"
        : kind === "rental_cottage"
          ? "rental_cottages"
          : null;
    if (!table)
      throw new Error(
        "Compatibility policy is only configurable for campsites and rental cottages.",
      );

    const before = await client.query(
      `select * from public.${table} where accommodation_id = $1 and campground_id = $2 for update`,
      [accommodationId, campgroundId],
    );
    if (before.rowCount !== 1)
      throw new Error("Accommodation detail is unavailable.");

    let updated;
    if (kind === "campsite") {
      updated = await client.query(
        `update public.campsites
         set accessible_site = $4, pets_allowed = $5, max_pets = $6, updated_by_user_id = $7
         where accommodation_id = $1 and campground_id = $2 and row_version = $3
         returning *`,
        [
          accommodationId,
          campgroundId,
          expected,
          Boolean(accessibleSite),
          Boolean(petsAllowed),
          pets,
          actorUserId,
        ],
      );
    } else {
      updated = await client.query(
        `update public.rental_cottages
         set pets_allowed = $4, max_pets = $5, updated_by_user_id = $6
         where accommodation_id = $1 and campground_id = $2 and row_version = $3
         returning *`,
        [
          accommodationId,
          campgroundId,
          expected,
          Boolean(petsAllowed),
          pets,
          actorUserId,
        ],
      );
    }
    if (updated.rowCount !== 1)
      throw new Error(
        "Compatibility facts changed since this page loaded. Refresh and try again.",
      );

    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: parent.rows[0].organization_id,
      campgroundId,
      actionKey: "accommodation.compatibility.update",
      permissionKey: "accommodation.manage",
      riskLevel: "standard",
      subjectType: "accommodation.compatibility",
      subjectId: accommodationId,
      beforeState: before.rows[0],
      afterState: updated.rows[0],
    });
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function evaluateBookingCompatibility({
  userId,
  campgroundId,
  accommodationId,
  request,
}) {
  const snapshot = await getCompatibilitySnapshot(userId, campgroundId);
  const accommodation = snapshot.find((item) => item.id === accommodationId);
  if (!accommodation) throw new Error("Accommodation is unavailable.");
  const capacity = await evaluateAccommodationCapacity({
    userId,
    campgroundId,
    accommodationId,
    occupants: request.occupants ?? 1,
    visitors: request.visitors ?? 0,
    vehicles: request.vehicles ?? 1,
  });
  return evaluateAccommodationCompatibility({
    accommodation,
    request,
    capacity,
  });
}

export async function assertServerCompatibleBookingChoice(input) {
  const result = await evaluateBookingCompatibility(input);
  return assertCompatibleBookingChoice({
    accommodation: (
      await getCompatibilitySnapshot(input.userId, input.campgroundId)
    ).find((item) => item.id === input.accommodationId),
    request: input.request,
    capacity: result.capacity,
  });
}
