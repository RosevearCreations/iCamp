import pg from "pg";

import { appendAuditEvent } from "../audit/postgres.mjs";
import { hasCampgroundPermission } from "../authz/postgres.mjs";
import {
  sortMaintenancePriorities,
  validateMaintenanceCategoryInput,
  validateMaintenancePriorityTarget,
} from "./core.mjs";

const { Pool } = pg;
let pool;

function databaseUrl() {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) {
    throw new Error("DATABASE_URL is required for maintenance taxonomy.");
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

export async function closeMaintenanceTaxonomyPoolForTests() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

async function allowed(userId, campgroundId, permission) {
  return hasCampgroundPermission(userId, campgroundId, permission);
}

async function assertCanRead(userId, campgroundId) {
  const checks = await Promise.all(
    [
      "maintenance.read",
      "maintenance.create",
      "maintenance.assign",
      "maintenance.complete",
      "campground.configuration",
    ].map((permission) => allowed(userId, campgroundId, permission)),
  );
  if (!checks.some(Boolean)) {
    throw new Error("Not authorized to read maintenance taxonomy.");
  }
}

async function assertCanManage(userId, campgroundId) {
  if (!(await allowed(userId, campgroundId, "maintenance.assign"))) {
    throw new Error("Not authorized to manage maintenance taxonomy.");
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

function mapCategory(row) {
  return {
    id: row.id,
    organizationId: row.organization_id,
    campgroundId: row.campground_id,
    code: row.category_code,
    name: row.display_name,
    description: row.description ?? null,
    isStandard: row.is_standard,
    isActive: row.is_active,
    rowVersion: Number(row.row_version),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPriority(row) {
  return {
    id: row.id,
    organizationId: row.organization_id,
    campgroundId: row.campground_id,
    priorityKey: row.priority_key,
    targetResponseMinutes: Number(row.target_response_minutes),
    targetCompletionMinutes: Number(row.target_completion_minutes),
    instructions: row.instructions ?? null,
    rowVersion: Number(row.row_version),
    updatedAt: row.updated_at,
  };
}

export async function getMaintenanceTaxonomySnapshot(userId, campgroundId) {
  await assertCanRead(userId, campgroundId);
  const client = await getPool().connect();

  try {
    await client.query("begin");
    const campground = await campgroundScope(client, campgroundId);
    await beginRls(client, userId);

    const [categoriesResult, prioritiesResult] = await Promise.all([
      client.query(
        `select *
         from public.maintenance_categories
         where campground_id = $1
         order by is_active desc, is_standard desc, display_name, category_code`,
        [campgroundId],
      ),
      client.query(
        `select *
         from public.maintenance_priority_policies
         where campground_id = $1
         order by priority_key`,
        [campgroundId],
      ),
    ]);

    await client.query("commit");
    return {
      campground: {
        id: campground.id,
        organizationId: campground.organization_id,
        name: campground.name,
        timezone: campground.timezone,
      },
      categories: categoriesResult.rows.map(mapCategory),
      priorities: sortMaintenancePriorities(prioritiesResult.rows.map(mapPriority)),
    };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function createMaintenanceCategory({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  ...input
}) {
  await assertCanManage(actorUserId, campgroundId);
  const category = validateMaintenanceCategoryInput(input);
  const client = await getPool().connect();

  try {
    await client.query("begin");
    const campground = await campgroundScope(client, campgroundId);
    await beginRls(client, actorUserId);

    const inserted = await client.query(
      `insert into public.maintenance_categories (
         organization_id,
         campground_id,
         category_code,
         display_name,
         description,
         is_standard,
         is_active,
         created_by_user_id,
         updated_by_user_id
       )
       values ($1,$2,$3,$4,$5,false,true,$6,$6)
       returning *`,
      [
        campground.organization_id,
        campgroundId,
        category.code,
        category.name,
        category.description,
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
      actionKey: "maintenance.taxonomy.category.create",
      permissionKey: "maintenance.assign",
      riskLevel: "standard",
      subjectType: "maintenance.category",
      subjectId: saved.id,
      beforeState: null,
      afterState: mapCategory(saved),
    });

    await client.query("commit");
    return mapCategory(saved);
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    if (String(error?.message ?? "").includes("maintenance_categories_scope_code_key")) {
      throw new Error("That maintenance category code already exists for this campground.");
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function setMaintenanceCategoryActive({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  categoryId,
  isActive,
  expectedRowVersion,
}) {
  await assertCanManage(actorUserId, campgroundId);
  const expected = Number(expectedRowVersion);
  if (!Number.isInteger(expected) || expected < 1) {
    throw new Error("Maintenance category row version is invalid.");
  }

  const client = await getPool().connect();
  try {
    await client.query("begin");
    const campground = await campgroundScope(client, campgroundId);
    await beginRls(client, actorUserId);

    const beforeResult = await client.query(
      `select *
       from public.maintenance_categories
       where id=$1 and campground_id=$2
       limit 1
       for update`,
      [categoryId, campgroundId],
    );
    if (beforeResult.rowCount !== 1) {
      throw new Error("Maintenance category is unavailable.");
    }
    const before = beforeResult.rows[0];

    const updated = await client.query(
      `update public.maintenance_categories
       set is_active=$4,
           updated_by_user_id=$5
       where id=$1
         and campground_id=$2
         and row_version=$3
       returning *`,
      [categoryId, campgroundId, expected, Boolean(isActive), actorUserId],
    );
    if (updated.rowCount !== 1) {
      throw new Error(
        "Maintenance category changed since this page loaded. Refresh and try again.",
      );
    }
    const saved = updated.rows[0];

    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: campground.organization_id,
      campgroundId,
      actionKey: isActive
        ? "maintenance.taxonomy.category.activate"
        : "maintenance.taxonomy.category.deactivate",
      permissionKey: "maintenance.assign",
      riskLevel: "standard",
      subjectType: "maintenance.category",
      subjectId: categoryId,
      beforeState: mapCategory(before),
      afterState: mapCategory(saved),
    });

    await client.query("commit");
    return mapCategory(saved);
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function updateMaintenancePriorityPolicy({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  expectedRowVersion,
  ...input
}) {
  await assertCanManage(actorUserId, campgroundId);
  const policy = validateMaintenancePriorityTarget(input);
  const expected = Number(expectedRowVersion);
  if (!Number.isInteger(expected) || expected < 1) {
    throw new Error("Maintenance priority row version is invalid.");
  }

  const client = await getPool().connect();
  try {
    await client.query("begin");
    const campground = await campgroundScope(client, campgroundId);
    await beginRls(client, actorUserId);

    const beforeResult = await client.query(
      `select *
       from public.maintenance_priority_policies
       where campground_id=$1 and priority_key=$2
       limit 1
       for update`,
      [campgroundId, policy.priorityKey],
    );
    if (beforeResult.rowCount !== 1) {
      throw new Error("Maintenance priority policy is unavailable.");
    }
    const before = beforeResult.rows[0];

    const updated = await client.query(
      `update public.maintenance_priority_policies
       set target_response_minutes=$4,
           target_completion_minutes=$5,
           instructions=$6,
           updated_by_user_id=$7
       where campground_id=$1
         and priority_key=$2
         and row_version=$3
       returning *`,
      [
        campgroundId,
        policy.priorityKey,
        expected,
        policy.targetResponseMinutes,
        policy.targetCompletionMinutes,
        policy.instructions,
        actorUserId,
      ],
    );
    if (updated.rowCount !== 1) {
      throw new Error(
        "Maintenance priority policy changed since this page loaded. Refresh and try again.",
      );
    }
    const saved = updated.rows[0];

    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: campground.organization_id,
      campgroundId,
      actionKey: "maintenance.priority_policy.update",
      permissionKey: "maintenance.assign",
      riskLevel: "standard",
      subjectType: "maintenance.priority_policy",
      subjectId: saved.id,
      beforeState: mapPriority(before),
      afterState: mapPriority(saved),
    });

    await client.query("commit");
    return mapPriority(saved);
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
