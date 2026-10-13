import pg from "pg";

import { appendAuditEvent } from "../audit/postgres.mjs";
import { hasCampgroundPermission } from "../authz/postgres.mjs";
import {
  calculateSiteAreaSquareMeters,
  evaluateCapacityRules,
  validateCapacityRuleInput,
} from "./core.mjs";

const { Pool } = pg;
let pool;

function databaseUrl() {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) {
    throw new Error("DATABASE_URL is required for capacity rules.");
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

export async function closeCapacityRulesPoolForTests() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

async function allowed(userId, campgroundId, permission) {
  return hasCampgroundPermission(userId, campgroundId, permission);
}

async function assertCanRead(userId, campgroundId) {
  const results = await Promise.all(
    [
      "campground.configuration",
      "accommodation.read",
      "accommodation.manage",
      "reservation.read",
      "reservation.create",
      "reservation.modify",
      "reservation.override",
    ].map((permission) => allowed(userId, campgroundId, permission)),
  );
  if (!results.some(Boolean)) {
    throw new Error("Not authorized to read campground capacity rules.");
  }
}

async function assertCanManage(userId, campgroundId) {
  if (!(await allowed(userId, campgroundId, "campground.configuration"))) {
    throw new Error("Not authorized to manage campground capacity rules.");
  }
}

async function campgroundScope(client, campgroundId) {
  const result = await client.query(
    "select organization_id, id, name, timezone from public.campgrounds where id = $1 and lifecycle_state <> 'archived' limit 1",
    [campgroundId],
  );
  if (result.rowCount !== 1) {
    throw new Error("Campground is unavailable.");
  }
  return result.rows[0];
}

async function beginRls(client, userId) {
  await client.query("set local role icamp_app");
  await client.query("select set_config('icamp.user_id', $1, true)", [userId]);
}

function numberOrNull(value) {
  return value === null || value === undefined ? null : Number(value);
}

function mapRule(row) {
  return {
    id: row.id,
    organizationId: row.organization_id,
    campgroundId: row.campground_id,
    scopeKind: row.scope_kind,
    sectionId: row.section_id ?? null,
    accommodationKind: row.accommodation_kind ?? null,
    accommodationId: row.accommodation_id ?? null,
    minimumSiteAreaSquareMeters: numberOrNull(row.minimum_site_area_m2),
    maximumSiteAreaSquareMeters: numberOrNull(row.maximum_site_area_m2),
    maxOccupants: numberOrNull(row.max_occupants),
    maxVisitors: numberOrNull(row.max_visitors),
    maxVehicles: numberOrNull(row.max_vehicles),
    notes: row.notes ?? null,
    isActive: row.is_active,
    rowVersion: Number(row.row_version),
    createdAt: row.created_at,
    archivedAt: row.archived_at,
  };
}

function mapAccommodation(row) {
  const siteAreaSquareMeters = calculateSiteAreaSquareMeters({
    siteLengthMeters: row.site_length_meters,
    siteWidthMeters: row.site_width_meters,
  });

  return {
    id: row.id,
    campgroundId: row.campground_id,
    sectionId: row.section_id,
    sectionName: row.section_name,
    accommodationKind: row.accommodation_kind,
    code: row.code,
    displayName: row.display_name,
    lifecycleState: row.lifecycle_state,
    siteLengthMeters: numberOrNull(row.site_length_meters),
    siteWidthMeters: numberOrNull(row.site_width_meters),
    siteAreaSquareMeters,
    physicalMaxOccupancy: numberOrNull(row.physical_max_occupancy),
  };
}

async function loadCampgroundStructure(client, campgroundId) {
  const sectionsResult = await client.query(
    `select id, name, code, lifecycle_state
     from public.campground_sections
     where campground_id = $1
       and lifecycle_state <> 'archived'
     order by sort_order, name`,
    [campgroundId],
  );

  const accommodationsResult = await client.query(
    `select
       a.id,
       a.campground_id,
       a.section_id,
       s.name as section_name,
       a.accommodation_kind,
       a.code,
       a.display_name,
       a.lifecycle_state,
       cs.site_length_meters,
       cs.site_width_meters,
       rc.max_occupancy as physical_max_occupancy
     from public.accommodations a
     join public.campground_sections s
       on s.id = a.section_id
      and s.organization_id = a.organization_id
      and s.campground_id = a.campground_id
     left join public.campsites cs
       on cs.accommodation_id = a.id
      and cs.organization_id = a.organization_id
      and cs.campground_id = a.campground_id
     left join public.rental_cottages rc
       on rc.accommodation_id = a.id
      and rc.organization_id = a.organization_id
      and rc.campground_id = a.campground_id
     where a.campground_id = $1
       and a.lifecycle_state <> 'archived'
     order by s.name, a.accommodation_kind, a.code`,
    [campgroundId],
  );

  return {
    sections: sectionsResult.rows.map((row) => ({
      id: row.id,
      name: row.name,
      code: row.code,
      lifecycleState: row.lifecycle_state,
    })),
    accommodations: accommodationsResult.rows.map(mapAccommodation),
  };
}

export async function getCapacityRuleSnapshot(userId, campgroundId) {
  await assertCanRead(userId, campgroundId);
  const client = await getPool().connect();

  try {
    await client.query("begin");
    const campground = await campgroundScope(client, campgroundId);
    const structure = await loadCampgroundStructure(client, campgroundId);

    await beginRls(client, userId);
    const rulesResult = await client.query(
      `select *
       from public.capacity_limit_rules
       where campground_id = $1
       order by is_active desc, scope_kind, created_at, id`,
      [campgroundId],
    );
    await client.query("commit");

    return {
      campground: {
        id: campground.id,
        organizationId: campground.organization_id,
        name: campground.name,
        timezone: campground.timezone,
      },
      sections: structure.sections,
      accommodations: structure.accommodations,
      rules: rulesResult.rows.map(mapRule),
    };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function validateRuleTarget(client, campgroundId, rule) {
  if (rule.scopeKind === "section") {
    const section = await client.query(
      `select 1
       from public.campground_sections
       where id = $1
         and campground_id = $2
         and lifecycle_state <> 'archived'
       limit 1`,
      [rule.sectionId, campgroundId],
    );
    if (section.rowCount !== 1) {
      throw new Error("Capacity rule section is unavailable.");
    }
  }

  if (
    rule.scopeKind === "accommodation_type" &&
    rule.accommodationKind !== "campsite" &&
    (rule.minimumSiteAreaSquareMeters !== null ||
      rule.maximumSiteAreaSquareMeters !== null)
  ) {
    throw new Error(
      "Site-area bands can only be used with campsite accommodation-type rules.",
    );
  }

  if (rule.scopeKind === "accommodation") {
    const target = await client.query(
      `select
         a.accommodation_kind,
         cs.site_length_meters,
         cs.site_width_meters,
         rc.max_occupancy
       from public.accommodations a
       left join public.campsites cs
         on cs.accommodation_id = a.id
        and cs.organization_id = a.organization_id
        and cs.campground_id = a.campground_id
       left join public.rental_cottages rc
         on rc.accommodation_id = a.id
        and rc.organization_id = a.organization_id
        and rc.campground_id = a.campground_id
       where a.id = $1
         and a.campground_id = $2
         and a.lifecycle_state <> 'archived'
       limit 1`,
      [rule.accommodationId, campgroundId],
    );
    if (target.rowCount !== 1) {
      throw new Error("Capacity rule accommodation is unavailable.");
    }

    const targetRow = target.rows[0];
    const usesAreaBand =
      rule.minimumSiteAreaSquareMeters !== null ||
      rule.maximumSiteAreaSquareMeters !== null;
    if (usesAreaBand && targetRow.accommodation_kind !== "campsite") {
      throw new Error("Individual site-area bands can only target a campsite.");
    }

    const physicalMax = numberOrNull(targetRow.max_occupancy);
    if (
      targetRow.accommodation_kind === "rental_cottage" &&
      rule.maxOccupants !== null &&
      physicalMax !== null &&
      rule.maxOccupants > physicalMax
    ) {
      throw new Error(
        "An individual cottage occupant limit cannot exceed its physical sleeping capacity.",
      );
    }
  }
}

export async function createCapacityLimitRule({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  ...input
}) {
  await assertCanManage(actorUserId, campgroundId);
  const rule = validateCapacityRuleInput(input);
  const client = await getPool().connect();

  try {
    await client.query("begin");
    const campground = await campgroundScope(client, campgroundId);
    await validateRuleTarget(client, campgroundId, rule);

    await beginRls(client, actorUserId);
    const inserted = await client.query(
      `insert into public.capacity_limit_rules (
         organization_id,
         campground_id,
         scope_kind,
         section_id,
         accommodation_kind,
         accommodation_id,
         minimum_site_area_m2,
         maximum_site_area_m2,
         max_occupants,
         max_visitors,
         max_vehicles,
         notes,
         created_by_user_id,
         updated_by_user_id
       )
       values (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$13
       )
       returning *`,
      [
        campground.organization_id,
        campgroundId,
        rule.scopeKind,
        rule.sectionId,
        rule.accommodationKind,
        rule.accommodationId,
        rule.minimumSiteAreaSquareMeters,
        rule.maximumSiteAreaSquareMeters,
        rule.maxOccupants,
        rule.maxVisitors,
        rule.maxVehicles,
        rule.notes,
        actorUserId,
      ],
    );
    const saved = inserted.rows[0];

    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: campground.organization_id,
      campgroundId,
      actionKey: "campground.capacity_rule.create",
      permissionKey: "campground.configuration",
      riskLevel: "standard",
      subjectType: "campground.capacity_rule",
      subjectId: saved.id,
      beforeState: null,
      afterState: mapRule(saved),
    });

    await client.query("commit");
    return mapRule(saved);
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    const message = String(error?.message ?? "");
    if (message.includes("Only one active default capacity rule")) {
      throw new Error(
        "That scope already has an active default capacity rule. Archive it before creating a replacement.",
      );
    }
    if (message.includes("size bands cannot overlap")) {
      throw new Error(
        "That site-area band overlaps another active band in the same scope.",
      );
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function archiveCapacityLimitRule({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  ruleId,
  expectedRowVersion,
}) {
  await assertCanManage(actorUserId, campgroundId);
  const expected = Number(expectedRowVersion);
  if (!Number.isInteger(expected) || expected < 1) {
    throw new Error("Capacity rule row version is invalid.");
  }

  const client = await getPool().connect();
  try {
    await client.query("begin");
    const campground = await campgroundScope(client, campgroundId);

    await beginRls(client, actorUserId);
    const beforeResult = await client.query(
      `select *
       from public.capacity_limit_rules
       where id = $1
         and campground_id = $2
       limit 1
       for update`,
      [ruleId, campgroundId],
    );
    if (beforeResult.rowCount !== 1) {
      throw new Error("Capacity rule is unavailable.");
    }
    const before = beforeResult.rows[0];
    if (!before.is_active) {
      throw new Error("Capacity rule is already archived.");
    }

    const updated = await client.query(
      `update public.capacity_limit_rules
       set is_active = false,
           archived_at = statement_timestamp(),
           updated_by_user_id = $4
       where id = $1
         and campground_id = $2
         and row_version = $3
       returning *`,
      [ruleId, campgroundId, expected, actorUserId],
    );
    if (updated.rowCount !== 1) {
      throw new Error(
        "Capacity rule changed since this page loaded. Refresh and try again.",
      );
    }
    const saved = updated.rows[0];

    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: campground.organization_id,
      campgroundId,
      actionKey: "campground.capacity_rule.archive",
      permissionKey: "campground.configuration",
      riskLevel: "standard",
      subjectType: "campground.capacity_rule",
      subjectId: ruleId,
      beforeState: mapRule(before),
      afterState: mapRule(saved),
    });

    await client.query("commit");
    return mapRule(saved);
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function evaluateAccommodationCapacity({
  userId,
  campgroundId,
  accommodationId,
  occupants,
  visitors,
  vehicles,
}) {
  const snapshot = await getCapacityRuleSnapshot(userId, campgroundId);
  const accommodation = snapshot.accommodations.find(
    (item) => item.id === accommodationId,
  );
  if (!accommodation) {
    throw new Error("Accommodation is unavailable.");
  }

  return evaluateCapacityRules({
    rules: snapshot.rules,
    context: {
      accommodationId: accommodation.id,
      accommodationKind: accommodation.accommodationKind,
      sectionId: accommodation.sectionId,
      siteAreaSquareMeters: accommodation.siteAreaSquareMeters,
      physicalMaxOccupancy: accommodation.physicalMaxOccupancy,
    },
    occupants,
    visitors,
    vehicles,
  });
}
