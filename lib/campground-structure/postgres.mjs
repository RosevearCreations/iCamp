import pg from "pg";

import { appendAuditEvent } from "../audit/postgres.mjs";
import { hasCampgroundPermission } from "../authz/postgres.mjs";

const { Pool } = pg;
let pool;

const CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u;
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/u;
const OPERATING_MODES = new Set(["standard", "quiet", "restricted"]);

function databaseUrl() {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) {
    throw new Error("DATABASE_URL is required for campground administration.");
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
    throw new Error(`${label} must be between 1 and ${maxLength} characters.`);
  }
  return normalized;
}

function optionalText(value, label, maxLength) {
  const normalized = String(value ?? "").trim();
  if (normalized.length > maxLength) {
    throw new Error(`${label} must be ${maxLength} characters or fewer.`);
  }
  return normalized;
}

function normalizeCode(value) {
  const code = requiredText(value, "Code", 64).toUpperCase();
  if (!CODE_PATTERN.test(code)) {
    throw new Error("Code contains unsupported characters.");
  }
  return code;
}

function normalizeSortOrder(value) {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < 0 || numeric > 100000) {
    throw new Error("Sort order must be a whole number from 0 to 100000.");
  }
  return numeric;
}

function normalizeLifecycle(value) {
  const lifecycleState = String(value ?? "");
  if (!["active", "inactive"].includes(lifecycleState)) {
    throw new Error("Lifecycle state must be active or inactive.");
  }
  return lifecycleState;
}

function normalizeTime(value, label) {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    return null;
  }
  if (!TIME_PATTERN.test(normalized)) {
    throw new Error(`${label} must use 24-hour HH:MM format.`);
  }
  return normalized;
}

export function normalizeSectionSettings(value = {}) {
  const operatingMode = String(value.operatingMode ?? "standard");
  if (!OPERATING_MODES.has(operatingMode)) {
    throw new Error("Operating mode must be standard, quiet or restricted.");
  }

  return Object.freeze({
    operatingMode,
    quietHoursStart: normalizeTime(value.quietHoursStart, "Quiet-hours start"),
    quietHoursEnd: normalizeTime(value.quietHoursEnd, "Quiet-hours end"),
    staffNote: optionalText(value.staffNote, "Staff note", 500),
  });
}

async function assertMayConfigure(actorUserId, campgroundId) {
  const allowed = await hasCampgroundPermission(
    actorUserId,
    campgroundId,
    "campground.configuration",
  );
  if (!allowed) {
    throw new Error("Not authorized to configure this campground.");
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

async function withConfiguredMutation({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  actionKey,
  subjectType,
  subjectId = null,
  requestId = null,
  mutate,
}) {
  await assertMayConfigure(actorUserId, campgroundId);
  const client = await getPool().connect();

  try {
    await client.query("begin");
    await client.query("set local role icamp_app");
    await client.query("select set_config('icamp.user_id', $1, true)", [
      actorUserId,
    ]);

    const mutation = await mutate(client);
    await client.query("reset role");

    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: mutation.organizationId,
      campgroundId,
      actionKey,
      permissionKey: "campground.configuration",
      riskLevel: "standard",
      subjectType,
      subjectId: subjectId ?? mutation.id ?? campgroundId,
      requestId,
      beforeState: mutation.beforeState ?? null,
      afterState: mutation.afterState ?? null,
    });

    await client.query("commit");
    return mutation.result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function closeCampgroundStructurePoolForTests() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

export async function listCampgroundStructure(userId, campgroundId) {
  return withRls(userId, async (client) => {
    const campgroundResult = await client.query(
      `select
         id,
         organization_id,
         name,
         slug,
         timezone,
         lifecycle_state,
         row_version
       from public.campgrounds
       where id = $1
       limit 1`,
      [campgroundId],
    );

    if (campgroundResult.rowCount !== 1) {
      return null;
    }

    const sectionResult = await client.query(
      `select
         id,
         organization_id,
         campground_id,
         name,
         code,
         sort_order,
         lifecycle_state,
         settings,
         row_version
       from public.campground_sections
       where campground_id = $1
         and lifecycle_state <> 'archived'
       order by sort_order, name, id`,
      [campgroundId],
    );

    const subsectionResult = await client.query(
      `select
         id,
         section_id,
         name,
         code,
         sort_order,
         lifecycle_state,
         row_version
       from public.campground_subsections
       where campground_id = $1
         and lifecycle_state <> 'archived'
       order by section_id, sort_order, name, id`,
      [campgroundId],
    );

    const subsectionsBySection = new Map();
    for (const row of subsectionResult.rows) {
      const items = subsectionsBySection.get(row.section_id) ?? [];
      items.push({
        id: row.id,
        sectionId: row.section_id,
        name: row.name,
        code: row.code,
        sortOrder: row.sort_order,
        lifecycleState: row.lifecycle_state,
        rowVersion: Number(row.row_version),
      });
      subsectionsBySection.set(row.section_id, items);
    }

    return {
      campground: {
        id: campgroundResult.rows[0].id,
        organizationId: campgroundResult.rows[0].organization_id,
        name: campgroundResult.rows[0].name,
        slug: campgroundResult.rows[0].slug,
        timezone: campgroundResult.rows[0].timezone,
        lifecycleState: campgroundResult.rows[0].lifecycle_state,
        rowVersion: Number(campgroundResult.rows[0].row_version),
      },
      sections: sectionResult.rows.map((row) => ({
        id: row.id,
        organizationId: row.organization_id,
        campgroundId: row.campground_id,
        name: row.name,
        code: row.code,
        sortOrder: row.sort_order,
        lifecycleState: row.lifecycle_state,
        settings: normalizeSectionSettings(row.settings ?? {}),
        rowVersion: Number(row.row_version),
        subsections: subsectionsBySection.get(row.id) ?? [],
      })),
    };
  });
}

export async function updateCampgroundConfiguration({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  expectedRowVersion,
  name,
  timezone,
  lifecycleState,
}) {
  const normalizedName = requiredText(name, "Campground name");
  const normalizedTimezone = requiredText(timezone, "Timezone", 100);
  const normalizedLifecycle = normalizeLifecycle(lifecycleState);

  return withConfiguredMutation({
    actorUserId,
    actorSessionId,
    campgroundId,
    actionKey: "campground.configuration.update",
    subjectType: "campground",
    mutate: async (client) => {
      const before = await client.query(
        `select organization_id, name, timezone, lifecycle_state, row_version
         from public.campgrounds
         where id = $1
         limit 1`,
        [campgroundId],
      );
      if (before.rowCount !== 1) {
        throw new Error("Campground is not available.");
      }

      const updated = await client.query(
        `update public.campgrounds
         set name = $2,
             timezone = $3,
             lifecycle_state = $4
         where id = $1
           and row_version = $5
         returning organization_id, name, timezone, lifecycle_state, row_version`,
        [
          campgroundId,
          normalizedName,
          normalizedTimezone,
          normalizedLifecycle,
          Number(expectedRowVersion),
        ],
      );

      if (updated.rowCount !== 1) {
        throw new Error("Campground changed since this page was loaded. Refresh and try again.");
      }

      const row = updated.rows[0];
      return {
        organizationId: row.organization_id,
        beforeState: {
          name: before.rows[0].name,
          timezone: before.rows[0].timezone,
          lifecycleState: before.rows[0].lifecycle_state,
          rowVersion: Number(before.rows[0].row_version),
        },
        afterState: {
          name: row.name,
          timezone: row.timezone,
          lifecycleState: row.lifecycle_state,
          rowVersion: Number(row.row_version),
        },
        result: { rowVersion: Number(row.row_version) },
      };
    },
  });
}

export async function createSection({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  name,
  code,
  sortOrder,
  lifecycleState = "active",
  settings = {},
}) {
  const normalizedName = requiredText(name, "Section name");
  const normalizedCode = normalizeCode(code);
  const normalizedOrder = normalizeSortOrder(sortOrder);
  const normalizedLifecycle = normalizeLifecycle(lifecycleState);
  const normalizedSettings = normalizeSectionSettings(settings);

  return withConfiguredMutation({
    actorUserId,
    actorSessionId,
    campgroundId,
    actionKey: "campground.section.create",
    subjectType: "campground.section",
    mutate: async (client) => {
      const campground = await client.query(
        `select organization_id
         from public.campgrounds
         where id = $1
         limit 1`,
        [campgroundId],
      );
      if (campground.rowCount !== 1) {
        throw new Error("Campground is not available.");
      }

      const inserted = await client.query(
        `insert into public.campground_sections (
           organization_id,
           campground_id,
           name,
           code,
           sort_order,
           lifecycle_state,
           settings
         )
         values ($1, $2, $3, $4, $5, $6, $7::jsonb)
         returning id, organization_id, name, code, sort_order, lifecycle_state, settings, row_version`,
        [
          campground.rows[0].organization_id,
          campgroundId,
          normalizedName,
          normalizedCode,
          normalizedOrder,
          normalizedLifecycle,
          JSON.stringify(normalizedSettings),
        ],
      );

      const row = inserted.rows[0];
      const afterState = {
        id: row.id,
        name: row.name,
        code: row.code,
        sortOrder: row.sort_order,
        lifecycleState: row.lifecycle_state,
        settings: normalizeSectionSettings(row.settings),
        rowVersion: Number(row.row_version),
      };
      return {
        id: row.id,
        organizationId: row.organization_id,
        afterState,
        result: afterState,
      };
    },
  });
}

export async function updateSection({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  sectionId,
  expectedRowVersion,
  name,
  code,
  sortOrder,
  lifecycleState,
  settings = {},
}) {
  const normalizedName = requiredText(name, "Section name");
  const normalizedCode = normalizeCode(code);
  const normalizedOrder = normalizeSortOrder(sortOrder);
  const normalizedLifecycle = normalizeLifecycle(lifecycleState);
  const normalizedSettings = normalizeSectionSettings(settings);

  return withConfiguredMutation({
    actorUserId,
    actorSessionId,
    campgroundId,
    actionKey: "campground.section.update",
    subjectType: "campground.section",
    subjectId: sectionId,
    mutate: async (client) => {
      const before = await client.query(
        `select organization_id, name, code, sort_order, lifecycle_state, settings, row_version
         from public.campground_sections
         where id = $1
           and campground_id = $2
         limit 1`,
        [sectionId, campgroundId],
      );
      if (before.rowCount !== 1) {
        throw new Error("Section is not available.");
      }

      const updated = await client.query(
        `update public.campground_sections
         set name = $3,
             code = $4,
             sort_order = $5,
             lifecycle_state = $6,
             settings = $7::jsonb
         where id = $1
           and campground_id = $2
           and row_version = $8
         returning organization_id, name, code, sort_order, lifecycle_state, settings, row_version`,
        [
          sectionId,
          campgroundId,
          normalizedName,
          normalizedCode,
          normalizedOrder,
          normalizedLifecycle,
          JSON.stringify(normalizedSettings),
          Number(expectedRowVersion),
        ],
      );
      if (updated.rowCount !== 1) {
        throw new Error("Section changed since this page was loaded. Refresh and try again.");
      }

      const beforeRow = before.rows[0];
      const row = updated.rows[0];
      const serialize = (item) => ({
        name: item.name,
        code: item.code,
        sortOrder: item.sort_order,
        lifecycleState: item.lifecycle_state,
        settings: normalizeSectionSettings(item.settings),
        rowVersion: Number(item.row_version),
      });
      return {
        organizationId: row.organization_id,
        beforeState: serialize(beforeRow),
        afterState: serialize(row),
        result: serialize(row),
      };
    },
  });
}

export async function createSubsection({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  sectionId,
  name,
  code,
  sortOrder,
  lifecycleState = "active",
}) {
  const normalizedName = requiredText(name, "Subsection name");
  const normalizedCode = normalizeCode(code);
  const normalizedOrder = normalizeSortOrder(sortOrder);
  const normalizedLifecycle = normalizeLifecycle(lifecycleState);

  return withConfiguredMutation({
    actorUserId,
    actorSessionId,
    campgroundId,
    actionKey: "campground.subsection.create",
    subjectType: "campground.subsection",
    mutate: async (client) => {
      const section = await client.query(
        `select organization_id
         from public.campground_sections
         where id = $1
           and campground_id = $2
         limit 1`,
        [sectionId, campgroundId],
      );
      if (section.rowCount !== 1) {
        throw new Error("Parent section is not available.");
      }

      const inserted = await client.query(
        `insert into public.campground_subsections (
           organization_id,
           campground_id,
           section_id,
           name,
           code,
           sort_order,
           lifecycle_state
         )
         values ($1, $2, $3, $4, $5, $6, $7)
         returning id, organization_id, section_id, name, code, sort_order, lifecycle_state, row_version`,
        [
          section.rows[0].organization_id,
          campgroundId,
          sectionId,
          normalizedName,
          normalizedCode,
          normalizedOrder,
          normalizedLifecycle,
        ],
      );

      const row = inserted.rows[0];
      const afterState = {
        id: row.id,
        sectionId: row.section_id,
        name: row.name,
        code: row.code,
        sortOrder: row.sort_order,
        lifecycleState: row.lifecycle_state,
        rowVersion: Number(row.row_version),
      };
      return {
        id: row.id,
        organizationId: row.organization_id,
        afterState,
        result: afterState,
      };
    },
  });
}

export async function updateSubsection({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  subsectionId,
  expectedRowVersion,
  name,
  code,
  sortOrder,
  lifecycleState,
}) {
  const normalizedName = requiredText(name, "Subsection name");
  const normalizedCode = normalizeCode(code);
  const normalizedOrder = normalizeSortOrder(sortOrder);
  const normalizedLifecycle = normalizeLifecycle(lifecycleState);

  return withConfiguredMutation({
    actorUserId,
    actorSessionId,
    campgroundId,
    actionKey: "campground.subsection.update",
    subjectType: "campground.subsection",
    subjectId: subsectionId,
    mutate: async (client) => {
      const before = await client.query(
        `select organization_id, section_id, name, code, sort_order, lifecycle_state, row_version
         from public.campground_subsections
         where id = $1
           and campground_id = $2
         limit 1`,
        [subsectionId, campgroundId],
      );
      if (before.rowCount !== 1) {
        throw new Error("Subsection is not available.");
      }

      const updated = await client.query(
        `update public.campground_subsections
         set name = $3,
             code = $4,
             sort_order = $5,
             lifecycle_state = $6
         where id = $1
           and campground_id = $2
           and row_version = $7
         returning organization_id, section_id, name, code, sort_order, lifecycle_state, row_version`,
        [
          subsectionId,
          campgroundId,
          normalizedName,
          normalizedCode,
          normalizedOrder,
          normalizedLifecycle,
          Number(expectedRowVersion),
        ],
      );
      if (updated.rowCount !== 1) {
        throw new Error("Subsection changed since this page was loaded. Refresh and try again.");
      }

      const serialize = (item) => ({
        sectionId: item.section_id,
        name: item.name,
        code: item.code,
        sortOrder: item.sort_order,
        lifecycleState: item.lifecycle_state,
        rowVersion: Number(item.row_version),
      });
      const row = updated.rows[0];
      return {
        organizationId: row.organization_id,
        beforeState: serialize(before.rows[0]),
        afterState: serialize(row),
        result: serialize(row),
      };
    },
  });
}
