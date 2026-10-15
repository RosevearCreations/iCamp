import pg from "pg";

import { appendAuditEvent } from "../audit/postgres.mjs";
import { hasCampgroundPermission } from "../authz/postgres.mjs";
import {
  mapAvailabilityRow,
  normalizeAvailabilityWindow,
} from "../live-availability/core.mjs";
import { normalizeManagementReason } from "../reservation-management/core.mjs";
import {
  normalizeOverflowAreaInput,
  normalizeOverflowAreaMemberIds,
} from "./core.mjs";

const { Pool } = pg;
let pool;

function databaseUrl() {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) {
    throw new Error("DATABASE_URL is required for office booking.");
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

export async function closeOfficeBookingPoolForTests() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

async function beginRls(client, userId) {
  await client.query("begin");
  await client.query("set local role icamp_app");
  await client.query("select set_config('icamp.user_id', $1, true)", [userId]);
}

async function canRead(userId, campgroundId) {
  const keys = [
    "reservation.read",
    "reservation.create",
    "reservation.modify",
    "reservation.cancel",
  ];
  const values = await Promise.all(
    keys.map((key) => hasCampgroundPermission(userId, campgroundId, key)),
  );
  return values.some(Boolean);
}

async function assertConfiguration(userId, campgroundId) {
  if (
    !(await hasCampgroundPermission(
      userId,
      campgroundId,
      "campground.configuration",
    ))
  ) {
    throw new Error("Not authorized to configure overflow areas.");
  }
}

function campground(client, campgroundId) {
  return client.query(
    `select id, organization_id, name
     from public.campgrounds
     where id = $1
       and lifecycle_state = 'active'
     limit 1`,
    [campgroundId],
  );
}

function mapInventoryRow(row) {
  return {
    id: row.id,
    code: row.code,
    displayName: row.display_name,
    accommodationKind: row.accommodation_kind,
    campsiteType: row.campsite_type ?? null,
    serviceLevel: row.service_level ?? null,
    stayProfile: row.stay_profile ?? null,
    ...mapAvailabilityRow(row),
  };
}

export async function listOfficeBookingInventory({
  userId,
  campgroundId,
  arrivalDate,
  departureDate,
}) {
  if (!(await canRead(userId, campgroundId))) {
    throw new Error("Not authorized to read office booking inventory.");
  }
  const window = normalizeAvailabilityWindow({ arrivalDate, departureDate });
  const client = await getPool().connect();

  try {
    await beginRls(client, userId);
    const scope = await campground(client, campgroundId);
    if (scope.rowCount !== 1) {
      throw new Error("Campground is unavailable.");
    }

    const [walkUp, areas, members] = await Promise.all([
      client.query(
        `select
           a.id,
           a.code,
           a.display_name,
           a.accommodation_kind,
           c.campsite_type,
           c.service_level,
           c.stay_profile,
           av.availability_revision,
           av.reservation_blocked,
           av.hold_blocked,
           av.restriction_blocked,
           av.turnover_blocked,
           av.seasonal_blocked
         from public.accommodations a
         join public.campsites c on c.accommodation_id = a.id
         join icamp_private.live_accommodation_availability($1, $2::date, $3::date) av
           on av.accommodation_id = a.id
         where a.campground_id = $1
           and a.lifecycle_state = 'active'
           and c.stay_profile = 'walk_up'
         order by a.code`,
        [campgroundId, window.arrivalDate, window.departureDate],
      ),
      client.query(
        `select id, code, display_name, notes, is_active, row_version
         from public.campground_overflow_areas
         where campground_id = $1
         order by is_active desc, display_name, code`,
        [campgroundId],
      ),
      client.query(
        `select
           m.overflow_area_id,
           a.id,
           a.code,
           a.display_name,
           a.accommodation_kind,
           c.campsite_type,
           c.service_level,
           c.stay_profile,
           av.availability_revision,
           av.reservation_blocked,
           av.hold_blocked,
           av.restriction_blocked,
           av.turnover_blocked,
           av.seasonal_blocked
         from public.campground_overflow_area_members m
         join public.accommodations a on a.id = m.accommodation_id
         left join public.campsites c on c.accommodation_id = a.id
         join icamp_private.live_accommodation_availability($1, $2::date, $3::date) av
           on av.accommodation_id = a.id
         where m.campground_id = $1
           and a.lifecycle_state = 'active'
         order by m.overflow_area_id, a.code`,
        [campgroundId, window.arrivalDate, window.departureDate],
      ),
    ]);

    await client.query("commit");

    const grouped = new Map();
    for (const row of members.rows) {
      const list = grouped.get(row.overflow_area_id) ?? [];
      list.push(mapInventoryRow(row));
      grouped.set(row.overflow_area_id, list);
    }

    return {
      campground: {
        id: scope.rows[0].id,
        name: scope.rows[0].name,
      },
      window,
      walkUpInventory: walkUp.rows.map(mapInventoryRow),
      overflowAreas: areas.rows.map((row) => {
        const areaMembers = grouped.get(row.id) ?? [];
        return {
          id: row.id,
          code: row.code,
          displayName: row.display_name,
          notes: row.notes,
          isActive: row.is_active === true,
          rowVersion: Number(row.row_version),
          availableCount: areaMembers.filter((item) => item.available).length,
          members: areaMembers,
        };
      }),
    };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function createOverflowArea({
  actorUserId,
  campgroundId,
  input,
  reason,
}) {
  await assertConfiguration(actorUserId, campgroundId);
  const normalized = normalizeOverflowAreaInput(input);
  const normalizedReason = normalizeManagementReason(reason);
  const client = await getPool().connect();

  try {
    await beginRls(client, actorUserId);
    const scope = await campground(client, campgroundId);
    if (scope.rowCount !== 1) {
      throw new Error("Campground is unavailable.");
    }

    const inserted = await client.query(
      `insert into public.campground_overflow_areas (
         organization_id,
         campground_id,
         code,
         display_name,
         notes,
         created_by_user_id,
         updated_by_user_id
       )
       values ($1,$2,$3,$4,$5,$6,$6)
       returning id, code, display_name, notes, is_active, row_version`,
      [
        scope.rows[0].organization_id,
        campgroundId,
        normalized.code,
        normalized.displayName,
        normalized.notes,
        actorUserId,
      ],
    );

    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      organizationId: scope.rows[0].organization_id,
      campgroundId,
      actionKey: "reservation.overflow_area.create",
      permissionKey: "campground.configuration",
      riskLevel: "elevated",
      reason: normalizedReason,
      subjectType: "campground_overflow_area",
      subjectId: inserted.rows[0].id,
      beforeState: null,
      afterState: {
        code: inserted.rows[0].code,
        displayName: inserted.rows[0].display_name,
        active: inserted.rows[0].is_active,
      },
    });

    await client.query("commit");
    return {
      id: inserted.rows[0].id,
      code: inserted.rows[0].code,
      displayName: inserted.rows[0].display_name,
    };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function setOverflowAreaMembers({
  actorUserId,
  campgroundId,
  overflowAreaId,
  accommodationIds,
  reason,
}) {
  await assertConfiguration(actorUserId, campgroundId);
  const members = normalizeOverflowAreaMemberIds(accommodationIds);
  const normalizedReason = normalizeManagementReason(reason);
  const client = await getPool().connect();

  try {
    await beginRls(client, actorUserId);
    const area = await client.query(
      `select id, organization_id, campground_id, code, display_name
       from public.campground_overflow_areas
       where id = $1
         and campground_id = $2
       limit 1`,
      [overflowAreaId, campgroundId],
    );
    if (area.rowCount !== 1) {
      throw new Error("Overflow area was not found.");
    }

    const beforeRows = await client.query(
      `select accommodation_id
       from public.campground_overflow_area_members
       where overflow_area_id = $1
       order by accommodation_id`,
      [overflowAreaId],
    );

    if (members.length > 0) {
      const valid = await client.query(
        `select id
         from public.accommodations
         where campground_id = $1
           and lifecycle_state = 'active'
           and id = any($2::uuid[])`,
        [campgroundId, members],
      );
      if (valid.rowCount !== members.length) {
        throw new Error(
          "Every overflow member must be an active accommodation in this campground.",
        );
      }
    }

    await client.query(
      `delete from public.campground_overflow_area_members
       where overflow_area_id = $1`,
      [overflowAreaId],
    );

    for (const accommodationId of members) {
      await client.query(
        `insert into public.campground_overflow_area_members (
           organization_id,
           campground_id,
           overflow_area_id,
           accommodation_id,
           created_by_user_id
         )
         values ($1,$2,$3,$4,$5)`,
        [
          area.rows[0].organization_id,
          campgroundId,
          overflowAreaId,
          accommodationId,
          actorUserId,
        ],
      );
    }

    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      organizationId: area.rows[0].organization_id,
      campgroundId,
      actionKey: "reservation.overflow_area.members.replace",
      permissionKey: "campground.configuration",
      riskLevel: "elevated",
      reason: normalizedReason,
      subjectType: "campground_overflow_area",
      subjectId: overflowAreaId,
      beforeState: {
        accommodationIds: beforeRows.rows.map((row) => row.accommodation_id),
      },
      afterState: { accommodationIds: members },
    });

    await client.query("commit");
    return { overflowAreaId, accommodationIds: members };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
