import pg from "pg";

import { appendAuditEvent } from "../audit/postgres.mjs";
import { assertPrivilegedActionControl } from "../audit/privileged.mjs";
import { hasCampgroundPermission } from "../authz/postgres.mjs";

const { Pool } = pg;
let pool;

const TARGET_KINDS = new Set(["accommodation", "asset", "section"]);
const RESTRICTION_KINDS = new Set(["closure", "hold"]);
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

const targetColumnByKind = Object.freeze({
  accommodation: "accommodation_id",
  asset: "asset_id",
  section: "section_id",
});

const targetQueryByKind = Object.freeze({
  accommodation:
    "select organization_id, id, code, display_name as target_name from public.accommodations where campground_id = $1 and id = $2 and lifecycle_state <> 'archived' limit 1",
  asset:
    "select organization_id, id, code, display_name as target_name from public.operational_assets where campground_id = $1 and id = $2 and lifecycle_state <> 'archived' limit 1",
  section:
    "select organization_id, id, code, name as target_name from public.campground_sections where campground_id = $1 and id = $2 and lifecycle_state <> 'archived' limit 1",
});

function databaseUrl() {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) {
    throw new Error("DATABASE_URL is required for management controls.");
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

export async function closeManagementControlsPoolForTests() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

async function assertOperationsPermission(userId, campgroundId) {
  const allowed = await hasCampgroundPermission(
    userId,
    campgroundId,
    "campground.operations.manage",
  );
  if (!allowed) {
    throw new Error("Not authorized to manage campground closures and holds.");
  }
}

function normalizedChoice(value, label, choices) {
  const normalized = String(value ?? "").trim();
  if (!choices.has(normalized)) {
    throw new Error(label + " is invalid.");
  }
  return normalized;
}

function normalizedDate(value, label) {
  const normalized = String(value ?? "").trim();
  if (!DATE_PATTERN.test(normalized)) {
    throw new Error(label + " must use YYYY-MM-DD.");
  }
  const parsed = new Date(normalized + "T00:00:00Z");
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== normalized) {
    throw new Error(label + " is invalid.");
  }
  return normalized;
}

function normalizedTargetIds(values) {
  const unique = [
    ...new Set(
      (Array.isArray(values) ? values : [values])
        .map((value) => String(value ?? "").trim())
        .filter(Boolean),
    ),
  ];
  if (unique.length < 1 || unique.length > 100) {
    throw new Error("Choose between 1 and 100 management targets.");
  }
  for (const id of unique) {
    if (!UUID_PATTERN.test(id)) {
      throw new Error("A management target identifier is invalid.");
    }
  }
  return unique;
}

function optionalText(value, maxLength) {
  const normalized = String(value ?? "").trim();
  if (normalized.length > maxLength) {
    throw new Error("Notes must be " + maxLength + " characters or fewer.");
  }
  return normalized || null;
}

function restrictionState(row) {
  if (row.cancelled_at) return "cancelled";
  const today = new Date().toISOString().slice(0, 10);
  if (row.ends_on < today) return "ended";
  if (row.starts_on > today) return "upcoming";
  return "active";
}

function mapRestriction(row) {
  return {
    id: row.id,
    batchId: row.batch_id,
    organizationId: row.organization_id,
    campgroundId: row.campground_id,
    targetKind: row.target_kind,
    targetId: row.accommodation_id ?? row.asset_id ?? row.section_id,
    targetCode: row.target_code,
    targetName: row.target_name,
    restrictionKind: row.restriction_kind,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    reason: row.reason,
    notes: row.notes ?? "",
    isOverride: row.is_override,
    supersedesRestrictionId: row.supersedes_restriction_id,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    cancelledByUserId: row.cancelled_by_user_id,
    cancelledAt: row.cancelled_at,
    cancellationReason: row.cancellation_reason,
    rowVersion: Number(row.row_version),
    state: restrictionState(row),
  };
}

async function beginOperationsTransaction(client, actorUserId) {
  await client.query("begin");
  await client.query("set local role icamp_app");
  await client.query("select set_config('icamp.user_id', $1, true)", [
    actorUserId,
  ]);
}

export async function listManagementRestrictionTargets(userId, campgroundId) {
  await assertOperationsPermission(userId, campgroundId);
  const client = await getPool().connect();
  try {
    await beginOperationsTransaction(client, userId);
    const [accommodations, assets, sections] = await Promise.all([
      client.query(
        "select id, code, display_name, section_id from public.accommodations where campground_id = $1 and lifecycle_state <> 'archived' order by code, display_name",
        [campgroundId],
      ),
      client.query(
        "select id, code, display_name, asset_class, section_id from public.operational_assets where campground_id = $1 and lifecycle_state <> 'archived' order by asset_class, code, display_name",
        [campgroundId],
      ),
      client.query(
        "select id, code, name from public.campground_sections where campground_id = $1 and lifecycle_state <> 'archived' order by sort_order, name",
        [campgroundId],
      ),
    ]);
    await client.query("commit");
    return {
      accommodations: accommodations.rows.map((row) => ({
        id: row.id,
        code: row.code,
        displayName: row.display_name,
        sectionId: row.section_id,
      })),
      assets: assets.rows.map((row) => ({
        id: row.id,
        code: row.code,
        displayName: row.display_name,
        assetClass: row.asset_class,
        sectionId: row.section_id,
      })),
      sections: sections.rows.map((row) => ({
        id: row.id,
        code: row.code,
        displayName: row.name,
      })),
    };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function listManagementRestrictions(userId, campgroundId) {
  await assertOperationsPermission(userId, campgroundId);
  const client = await getPool().connect();
  try {
    await beginOperationsTransaction(client, userId);
    const result = await client.query(
      "select r.*, coalesce(a.code, oa.code, s.code) as target_code, coalesce(a.display_name, oa.display_name, s.name) as target_name from public.management_restrictions r left join public.accommodations a on a.id = r.accommodation_id and a.campground_id = r.campground_id left join public.operational_assets oa on oa.id = r.asset_id and oa.campground_id = r.campground_id left join public.campground_sections s on s.id = r.section_id and s.campground_id = r.campground_id where r.campground_id = $1 order by (r.cancelled_at is null) desc, r.starts_on desc, r.created_at desc limit 250",
      [campgroundId],
    );
    await client.query("commit");
    return result.rows.map(mapRestriction);
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function createManagementRestrictions({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  targetKind,
  targetIds,
  restrictionKind,
  startsOn,
  endsOn,
  reason,
  notes = null,
  overrideConflicts = false,
}) {
  await assertOperationsPermission(actorUserId, campgroundId);
  const kind = normalizedChoice(targetKind, "Target type", TARGET_KINDS);
  const restriction = normalizedChoice(
    restrictionKind,
    "Restriction type",
    RESTRICTION_KINDS,
  );
  const ids = normalizedTargetIds(targetIds);
  const startDate = normalizedDate(startsOn, "Start date");
  const endDate = normalizedDate(endsOn, "End date");
  if (endDate < startDate) {
    throw new Error("End date must be on or after the start date.");
  }
  const privileged = assertPrivilegedActionControl({
    riskLevel: "elevated",
    reason,
  });
  const normalizedNotes = optionalText(notes, 1000);
  const batchId = crypto.randomUUID();
  const client = await getPool().connect();

  try {
    await beginOperationsTransaction(client, actorUserId);
    const insertedIds = [];
    let organizationId = null;
    let overrideCount = 0;
    const targetColumn = targetColumnByKind[kind];

    for (const targetId of ids) {
      const target = await client.query(targetQueryByKind[kind], [
        campgroundId,
        targetId,
      ]);
      if (target.rowCount !== 1) {
        throw new Error("A selected management target is unavailable.");
      }
      organizationId ??= target.rows[0].organization_id;
      if (organizationId !== target.rows[0].organization_id) {
        throw new Error("Management targets must belong to one organization.");
      }

      await client.query(
        "select pg_advisory_xact_lock(hashtextextended($1, 0))",
        ["icamp-management-restriction:" + kind + ":" + targetId],
      );

      const conflict = await client.query(
        "select id, row_version from public.management_restrictions where campground_id = $1 and target_kind = $2 and " +
          targetColumn +
          " = $3 and cancelled_at is null and daterange(starts_on, ends_on + 1, '[)') && daterange($4::date, $5::date + 1, '[)') order by created_at desc limit 1 for update",
        [campgroundId, kind, targetId, startDate, endDate],
      );

      let supersedesRestrictionId = null;
      if (conflict.rowCount === 1) {
        if (!overrideConflicts) {
          throw new Error(
            "A selected target already has an overlapping management restriction. Use the audited override only when replacement is intentional.",
          );
        }
        const cancellationReason = (
          "Superseded by management override: " + privileged.reason
        ).slice(0, 500);
        const cancelled = await client.query(
          "update public.management_restrictions set cancelled_at = statement_timestamp(), cancelled_by_user_id = $3, cancellation_reason = $4 where id = $1 and row_version = $2 returning id",
          [
            conflict.rows[0].id,
            Number(conflict.rows[0].row_version),
            actorUserId,
            cancellationReason,
          ],
        );
        if (cancelled.rowCount !== 1) {
          throw new Error(
            "An overlapping management restriction changed. Refresh and try again.",
          );
        }
        supersedesRestrictionId = conflict.rows[0].id;
        overrideCount += 1;
      }

      const targetValues = {
        accommodation: [targetId, null, null],
        asset: [null, targetId, null],
        section: [null, null, targetId],
      }[kind];

      const inserted = await client.query(
        "insert into public.management_restrictions (batch_id, organization_id, campground_id, target_kind, accommodation_id, asset_id, section_id, restriction_kind, starts_on, ends_on, reason, notes, is_override, supersedes_restriction_id, created_by_user_id) values ($1,$2,$3,$4,$5,$6,$7,$8,$9::date,$10::date,$11,$12,$13,$14,$15) returning id",
        [
          batchId,
          organizationId,
          campgroundId,
          kind,
          targetValues[0],
          targetValues[1],
          targetValues[2],
          restriction,
          startDate,
          endDate,
          privileged.reason,
          normalizedNotes,
          Boolean(supersedesRestrictionId),
          supersedesRestrictionId,
          actorUserId,
        ],
      );
      insertedIds.push(inserted.rows[0].id);
    }

    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId,
      campgroundId,
      actionKey: "campground.management.restriction.create",
      permissionKey: "campground.operations.manage",
      riskLevel: "elevated",
      reason: privileged.reason,
      subjectType: "management.restriction.batch",
      subjectId: batchId,
      afterState: {
        targetKind: kind,
        targetIds: ids,
        restrictionKind: restriction,
        startsOn: startDate,
        endsOn: endDate,
        restrictionIds: insertedIds,
        overrideCount,
      },
    });

    await client.query("commit");
    return {
      batchId,
      restrictionIds: insertedIds,
      overrideCount,
    };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function cancelManagementRestriction({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  restrictionId,
  expectedRowVersion,
  reason,
}) {
  await assertOperationsPermission(actorUserId, campgroundId);
  if (!UUID_PATTERN.test(String(restrictionId ?? ""))) {
    throw new Error("Management restriction identifier is invalid.");
  }
  const rowVersion = Number(expectedRowVersion);
  if (!Number.isInteger(rowVersion) || rowVersion < 1) {
    throw new Error("Management restriction row version is invalid.");
  }
  const privileged = assertPrivilegedActionControl({
    riskLevel: "elevated",
    reason,
  });
  const client = await getPool().connect();

  try {
    await beginOperationsTransaction(client, actorUserId);
    const before = await client.query(
      "select * from public.management_restrictions where id = $1 and campground_id = $2 limit 1 for update",
      [restrictionId, campgroundId],
    );
    if (before.rowCount !== 1) {
      throw new Error("Management restriction is unavailable.");
    }
    if (before.rows[0].cancelled_at) {
      throw new Error("Management restriction is already cancelled.");
    }

    const updated = await client.query(
      "update public.management_restrictions set cancelled_at = statement_timestamp(), cancelled_by_user_id = $4, cancellation_reason = $5 where id = $1 and campground_id = $2 and row_version = $3 returning *",
      [
        restrictionId,
        campgroundId,
        rowVersion,
        actorUserId,
        privileged.reason,
      ],
    );
    if (updated.rowCount !== 1) {
      throw new Error(
        "Management restriction changed since this page was loaded. Refresh and try again.",
      );
    }

    await client.query("reset role");
    const row = updated.rows[0];
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: row.organization_id,
      campgroundId,
      actionKey: "campground.management.restriction.cancel",
      permissionKey: "campground.operations.manage",
      riskLevel: "elevated",
      reason: privileged.reason,
      subjectType: "management.restriction",
      subjectId: restrictionId,
      beforeState: {
        restrictionKind: before.rows[0].restriction_kind,
        startsOn: before.rows[0].starts_on,
        endsOn: before.rows[0].ends_on,
        cancelledAt: null,
      },
      afterState: {
        cancelledAt: row.cancelled_at,
        cancellationReason: row.cancellation_reason,
      },
    });

    await client.query("commit");
    return mapRestriction({
      ...row,
      target_code: null,
      target_name: null,
    });
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
