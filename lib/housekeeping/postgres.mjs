import pg from "pg";

import { appendAuditEvent } from "../audit/postgres.mjs";
import { hasCampgroundPermission } from "../authz/postgres.mjs";

const { Pool } = pg;
let pool;

function databaseUrl() {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) {
    throw new Error("DATABASE_URL is required for cottage housekeeping operations.");
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

function requiredText(value, label, maxLength) {
  const normalized = String(value ?? "").trim();
  if (!normalized || normalized.length > maxLength) {
    throw new Error(label + " must be between 1 and " + maxLength + " characters.");
  }
  return normalized;
}

function optionalText(value, label, maxLength) {
  const normalized = String(value ?? "").trim();
  if (normalized.length > maxLength) {
    throw new Error(label + " must be no more than " + maxLength + " characters.");
  }
  return normalized;
}

function boundedInteger(value, label, minimum, maximum) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < minimum || number > maximum) {
    throw new Error(
      label + " must be a whole number between " + minimum + " and " + maximum + ".",
    );
  }
  return number;
}

function normalizeChoice(value, label, allowed) {
  const normalized = String(value ?? "").trim();
  if (!allowed.includes(normalized)) {
    throw new Error(label + " is invalid.");
  }
  return normalized;
}

async function assertPermission(userId, campgroundId, permissionKey) {
  if (!(await hasCampgroundPermission(userId, campgroundId, permissionKey))) {
    throw new Error("Not authorized for this cottage housekeeping operation.");
  }
}

async function setAppRole(client, userId) {
  await client.query("set local role icamp_app");
  await client.query("select set_config('icamp.user_id', $1, true)", [userId]);
}

async function resetAppRole(client) {
  await client.query("reset role");
}

function groupBy(rows, key) {
  const grouped = new Map();
  for (const row of rows) {
    const value = row[key];
    const current = grouped.get(value) ?? [];
    current.push(row);
    grouped.set(value, current);
  }
  return grouped;
}

function mapChecklistItem(row) {
  return {
    id: row.id,
    category: row.item_category,
    name: row.item_name,
    requiredQuantity: Number(row.required_quantity),
    unit: row.unit,
    expectedCondition: row.expected_condition,
    sortOrder: Number(row.sort_order),
    isRequired: row.is_required,
    isActive: row.is_active,
    rowVersion: Number(row.row_version),
  };
}

function mapTurnoverCheck(row) {
  return {
    id: row.id,
    checklistItemId: row.checklist_item_id,
    category: row.item_category,
    name: row.item_name,
    requiredQuantity: Number(row.required_quantity),
    unit: row.unit,
    expectedCondition: row.expected_condition,
    isRequired: row.is_required,
    checked: row.checked,
    issueFound: row.issue_found,
    notes: row.notes,
    checkedAt: row.checked_at,
    rowVersion: Number(row.row_version),
  };
}

function mapInspection(row) {
  return {
    id: row.id,
    result: row.inspection_result,
    linenComplete: row.linen_complete,
    housekeepingComplete: row.housekeeping_complete,
    inventoryComplete: row.inventory_complete,
    damageFound: row.damage_found,
    securityIssueFound: row.security_issue_found,
    damageNotes: row.damage_notes,
    securityNotes: row.security_notes,
    inspectedAt: row.inspected_at,
    rowVersion: Number(row.row_version),
  };
}

export async function closeCottageHousekeepingPoolForTests() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

export async function listCottageHousekeeping(userId, campgroundId) {
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
    throw new Error("Not authorized to read cottage housekeeping data.");
  }

  const client = await getPool().connect();
  try {
    await client.query("begin");
    await setAppRole(client, userId);

    const cottages = await client.query(
      [
        "select rc.accommodation_id",
        "from public.rental_cottages rc",
        "join public.accommodations a on a.id = rc.accommodation_id",
        "  and a.organization_id = rc.organization_id",
        "  and a.campground_id = rc.campground_id",
        "where rc.campground_id = $1",
        "  and a.lifecycle_state <> 'archived'",
        "order by a.code",
      ].join("\n"),
      [campgroundId],
    );

    const templates = await client.query(
      [
        "select *",
        "from public.cottage_housekeeping_templates",
        "where campground_id = $1",
        "order by accommodation_id, is_active desc, name",
      ].join("\n"),
      [campgroundId],
    );

    const items = await client.query(
      [
        "select *",
        "from public.cottage_inventory_checklist_items",
        "where campground_id = $1",
        "order by template_id, sort_order, item_name",
      ].join("\n"),
      [campgroundId],
    );

    const turnovers = await client.query(
      [
        "select *",
        "from public.cottage_turnovers",
        "where campground_id = $1",
        "order by accommodation_id, scheduled_for desc, created_at desc",
      ].join("\n"),
      [campgroundId],
    );

    const checks = await client.query(
      [
        "select *",
        "from public.cottage_turnover_item_checks",
        "where campground_id = $1",
        "order by turnover_id, item_category, item_name",
      ].join("\n"),
      [campgroundId],
    );

    const inspections = await client.query(
      [
        "select *",
        "from public.cottage_damage_inspections",
        "where campground_id = $1",
        "order by turnover_id, inspected_at desc",
      ].join("\n"),
      [campgroundId],
    );

    await client.query("commit");

    const itemsByTemplate = groupBy(items.rows, "template_id");
    const checksByTurnover = groupBy(checks.rows, "turnover_id");
    const inspectionsByTurnover = groupBy(inspections.rows, "turnover_id");
    const templatesByCottage = groupBy(templates.rows, "accommodation_id");
    const turnoversByCottage = groupBy(turnovers.rows, "accommodation_id");

    return cottages.rows.map((cottage) => ({
      accommodationId: cottage.accommodation_id,
      templates: (templatesByCottage.get(cottage.accommodation_id) ?? []).map(
        (template) => ({
          id: template.id,
          name: template.name,
          turnoverType: template.turnover_type,
          expectedMinutes: Number(template.expected_minutes),
          linenRequirements: template.linen_requirements,
          housekeepingRequirements: template.housekeeping_requirements,
          damageInspectionRequired: template.damage_inspection_required,
          securityInspectionRequired: template.security_inspection_required,
          isActive: template.is_active,
          rowVersion: Number(template.row_version),
          items: (itemsByTemplate.get(template.id) ?? []).map(mapChecklistItem),
        }),
      ),
      turnovers: (turnoversByCottage.get(cottage.accommodation_id) ?? [])
        .slice(0, 12)
        .map((turnover) => ({
          id: turnover.id,
          templateId: turnover.template_id,
          status: turnover.status,
          scheduledFor: turnover.scheduled_for,
          startedAt: turnover.started_at,
          completedAt: turnover.completed_at,
          notes: turnover.notes,
          blockedReason: turnover.blocked_reason,
          rowVersion: Number(turnover.row_version),
          itemChecks: (checksByTurnover.get(turnover.id) ?? []).map(
            mapTurnoverCheck,
          ),
          inspections: (inspectionsByTurnover.get(turnover.id) ?? []).map(
            mapInspection,
          ),
        })),
    }));
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function createCottageHousekeepingTemplate({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  accommodationId,
  name,
  turnoverType,
  expectedMinutes,
  linenRequirements,
  housekeepingRequirements,
  damageInspectionRequired = false,
  securityInspectionRequired = false,
}) {
  await assertPermission(actorUserId, campgroundId, "accommodation.manage");

  const normalizedName = requiredText(name, "Template name", 120);
  const normalizedType = normalizeChoice(turnoverType, "Turnover type", [
    "departure",
    "deep_clean",
    "winter_open",
    "winter_close",
    "maintenance_reset",
  ]);
  const normalizedMinutes = boundedInteger(
    expectedMinutes,
    "Expected minutes",
    5,
    1440,
  );
  const normalizedLinen = optionalText(
    linenRequirements,
    "Linen requirements",
    2000,
  );
  const normalizedHousekeeping = optionalText(
    housekeepingRequirements,
    "Housekeeping requirements",
    4000,
  );

  const client = await getPool().connect();
  try {
    await client.query("begin");

    const cottage = await client.query(
      [
        "select organization_id",
        "from public.rental_cottages",
        "where accommodation_id = $1 and campground_id = $2",
        "limit 1",
      ].join("\n"),
      [accommodationId, campgroundId],
    );
    if (cottage.rowCount !== 1) {
      throw new Error("Rental cottage is unavailable.");
    }

    await setAppRole(client, actorUserId);
    const inserted = await client.query(
      [
        "insert into public.cottage_housekeeping_templates (",
        "  organization_id, campground_id, accommodation_id, name, turnover_type,",
        "  expected_minutes, linen_requirements, housekeeping_requirements,",
        "  damage_inspection_required, security_inspection_required,",
        "  created_by_user_id, updated_by_user_id",
        ") values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11)",
        "returning *",
      ].join("\n"),
      [
        cottage.rows[0].organization_id,
        campgroundId,
        accommodationId,
        normalizedName,
        normalizedType,
        normalizedMinutes,
        normalizedLinen,
        normalizedHousekeeping,
        Boolean(damageInspectionRequired),
        Boolean(securityInspectionRequired),
        actorUserId,
      ],
    );
    await resetAppRole(client);

    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: cottage.rows[0].organization_id,
      campgroundId,
      actionKey: "accommodation.cottage.housekeeping_template.create",
      permissionKey: "accommodation.manage",
      riskLevel: "standard",
      subjectType: "cottage_housekeeping_template",
      subjectId: inserted.rows[0].id,
      afterState: {
        accommodationId,
        name: normalizedName,
        turnoverType: normalizedType,
        expectedMinutes: normalizedMinutes,
        damageInspectionRequired: Boolean(damageInspectionRequired),
        securityInspectionRequired: Boolean(securityInspectionRequired),
      },
    });

    await client.query("commit");
    return inserted.rows[0].id;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function addCottageInventoryChecklistItem({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  templateId,
  category,
  name,
  requiredQuantity,
  unit,
  expectedCondition,
  sortOrder,
  isRequired = false,
}) {
  await assertPermission(actorUserId, campgroundId, "accommodation.manage");

  const normalizedCategory = normalizeChoice(category, "Checklist category", [
    "linen",
    "kitchen",
    "bathroom",
    "safety",
    "security",
    "equipment",
    "consumable",
    "other",
  ]);
  const normalizedName = requiredText(name, "Checklist item", 160);
  const normalizedQuantity = boundedInteger(
    requiredQuantity,
    "Required quantity",
    1,
    999,
  );
  const normalizedUnit = requiredText(unit, "Checklist unit", 32);
  const normalizedCondition = optionalText(
    expectedCondition,
    "Expected condition",
    500,
  );
  const normalizedSort = boundedInteger(sortOrder, "Sort order", 0, 99999);

  const client = await getPool().connect();
  try {
    await client.query("begin");

    const template = await client.query(
      [
        "select organization_id, accommodation_id",
        "from public.cottage_housekeeping_templates",
        "where id = $1 and campground_id = $2 and is_active",
        "limit 1",
      ].join("\n"),
      [templateId, campgroundId],
    );
    if (template.rowCount !== 1) {
      throw new Error("Active housekeeping template is unavailable.");
    }

    const scope = template.rows[0];
    await setAppRole(client, actorUserId);
    const inserted = await client.query(
      [
        "insert into public.cottage_inventory_checklist_items (",
        "  organization_id, campground_id, accommodation_id, template_id,",
        "  item_category, item_name, required_quantity, unit, expected_condition,",
        "  sort_order, is_required, created_by_user_id, updated_by_user_id",
        ") values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12)",
        "returning *",
      ].join("\n"),
      [
        scope.organization_id,
        campgroundId,
        scope.accommodation_id,
        templateId,
        normalizedCategory,
        normalizedName,
        normalizedQuantity,
        normalizedUnit,
        normalizedCondition,
        normalizedSort,
        Boolean(isRequired),
        actorUserId,
      ],
    );
    await resetAppRole(client);

    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: scope.organization_id,
      campgroundId,
      actionKey: "accommodation.cottage.inventory_checklist.add",
      permissionKey: "accommodation.manage",
      riskLevel: "standard",
      subjectType: "cottage_inventory_checklist_item",
      subjectId: inserted.rows[0].id,
      afterState: {
        templateId,
        accommodationId: scope.accommodation_id,
        category: normalizedCategory,
        name: normalizedName,
        requiredQuantity: normalizedQuantity,
        unit: normalizedUnit,
        isRequired: Boolean(isRequired),
      },
    });

    await client.query("commit");
    return inserted.rows[0].id;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function createCottageTurnover({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  templateId,
  notes = "",
}) {
  await assertPermission(actorUserId, campgroundId, "accommodation.manage");
  const normalizedNotes = optionalText(notes, "Turnover notes", 2000);

  const client = await getPool().connect();
  try {
    await client.query("begin");

    const template = await client.query(
      [
        "select organization_id, accommodation_id",
        "from public.cottage_housekeeping_templates",
        "where id = $1 and campground_id = $2 and is_active",
        "limit 1",
      ].join("\n"),
      [templateId, campgroundId],
    );
    if (template.rowCount !== 1) {
      throw new Error("Active housekeeping template is unavailable.");
    }

    const scope = template.rows[0];
    await setAppRole(client, actorUserId);
    const turnover = await client.query(
      [
        "insert into public.cottage_turnovers (",
        "  organization_id, campground_id, accommodation_id, template_id,",
        "  status, scheduled_for, assigned_user_id, notes,",
        "  created_by_user_id, updated_by_user_id",
        ") values ($1,$2,$3,$4,'scheduled',statement_timestamp(),$5,$6,$5,$5)",
        "returning *",
      ].join("\n"),
      [
        scope.organization_id,
        campgroundId,
        scope.accommodation_id,
        templateId,
        actorUserId,
        normalizedNotes,
      ],
    );

    const snapshots = await client.query(
      [
        "insert into public.cottage_turnover_item_checks (",
        "  organization_id, campground_id, accommodation_id, turnover_id,",
        "  checklist_item_id, item_category, item_name, required_quantity,",
        "  unit, expected_condition, is_required, updated_by_user_id",
        ")",
        "select organization_id, campground_id, accommodation_id, $1,",
        "  id, item_category, item_name, required_quantity, unit, expected_condition,",
        "  is_required, $2",
        "from public.cottage_inventory_checklist_items",
        "where template_id = $3 and campground_id = $4 and is_active",
        "order by sort_order, item_name",
        "returning id",
      ].join("\n"),
      [turnover.rows[0].id, actorUserId, templateId, campgroundId],
    );
    await resetAppRole(client);

    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: scope.organization_id,
      campgroundId,
      actionKey: "accommodation.cottage.turnover.create",
      permissionKey: "accommodation.manage",
      riskLevel: "standard",
      subjectType: "cottage_turnover",
      subjectId: turnover.rows[0].id,
      afterState: {
        accommodationId: scope.accommodation_id,
        templateId,
        status: "scheduled",
        checklistSnapshotCount: snapshots.rowCount,
      },
    });

    await client.query("commit");
    return turnover.rows[0].id;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function recordCottageTurnoverItemCheck({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  turnoverId,
  checkId,
  issueFound = false,
  notes = "",
}) {
  await assertPermission(actorUserId, campgroundId, "accommodation.manage");
  const normalizedNotes = optionalText(notes, "Checklist notes", 1000);

  const client = await getPool().connect();
  try {
    await client.query("begin");

    const before = await client.query(
      [
        "select c.*, t.organization_id, t.accommodation_id, t.status as turnover_status",
        "from public.cottage_turnover_item_checks c",
        "join public.cottage_turnovers t on t.id = c.turnover_id",
        "  and t.organization_id = c.organization_id",
        "  and t.campground_id = c.campground_id",
        "where c.id = $1 and c.turnover_id = $2 and c.campground_id = $3",
        "limit 1",
        "for update",
      ].join("\n"),
      [checkId, turnoverId, campgroundId],
    );
    if (before.rowCount !== 1) {
      throw new Error("Turnover checklist item is unavailable.");
    }
    if (["ready", "cancelled"].includes(before.rows[0].turnover_status)) {
      throw new Error("Completed or cancelled turnover cannot be changed.");
    }

    await setAppRole(client, actorUserId);
    const updated = await client.query(
      [
        "update public.cottage_turnover_item_checks",
        "set checked = true,",
        "    issue_found = $1,",
        "    notes = $2,",
        "    checked_at = statement_timestamp(),",
        "    checked_by_user_id = $3,",
        "    updated_by_user_id = $3",
        "where id = $4 and turnover_id = $5 and campground_id = $6",
        "returning *",
      ].join("\n"),
      [
        Boolean(issueFound),
        normalizedNotes,
        actorUserId,
        checkId,
        turnoverId,
        campgroundId,
      ],
    );

    await client.query(
      [
        "update public.cottage_turnovers",
        "set status = 'in_progress',",
        "    started_at = coalesce(started_at, statement_timestamp()),",
        "    updated_by_user_id = $1",
        "where id = $2 and campground_id = $3 and status = 'scheduled'",
      ].join("\n"),
      [actorUserId, turnoverId, campgroundId],
    );
    await resetAppRole(client);

    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: before.rows[0].organization_id,
      campgroundId,
      actionKey: "accommodation.cottage.turnover.item_check",
      permissionKey: "accommodation.manage",
      riskLevel: "standard",
      subjectType: "cottage_turnover_item_check",
      subjectId: checkId,
      beforeState: {
        checked: before.rows[0].checked,
        issueFound: before.rows[0].issue_found,
      },
      afterState: {
        turnoverId,
        checked: true,
        issueFound: Boolean(issueFound),
        notes: normalizedNotes,
      },
    });

    await client.query("commit");
    return Number(updated.rows[0].row_version);
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function recordCottageDamageInspection({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  turnoverId,
  linenComplete = false,
  housekeepingComplete = false,
  damageFound = false,
  securityIssueFound = false,
  damageNotes = "",
  securityNotes = "",
}) {
  await assertPermission(actorUserId, campgroundId, "accommodation.manage");

  const normalizedDamageNotes = optionalText(damageNotes, "Damage notes", 2000);
  const normalizedSecurityNotes = optionalText(
    securityNotes,
    "Security notes",
    2000,
  );

  const client = await getPool().connect();
  try {
    await client.query("begin");

    const turnoverResult = await client.query(
      [
        "select *",
        "from public.cottage_turnovers",
        "where id = $1 and campground_id = $2",
        "limit 1",
        "for update",
      ].join("\n"),
      [turnoverId, campgroundId],
    );
    if (turnoverResult.rowCount !== 1) {
      throw new Error("Cottage turnover is unavailable.");
    }

    const turnover = turnoverResult.rows[0];
    if (turnover.status === "cancelled") {
      throw new Error("Cancelled turnover cannot be inspected.");
    }

    const checklistSummary = await client.query(
      [
        "select",
        "  count(*) filter (where is_required and not checked) as unchecked_required,",
        "  count(*) filter (where issue_found) as checklist_issues",
        "from public.cottage_turnover_item_checks",
        "where turnover_id = $1 and campground_id = $2",
      ].join("\n"),
      [turnoverId, campgroundId],
    );

    const uncheckedRequired = Number(
      checklistSummary.rows[0].unchecked_required,
    );
    const checklistIssues = Number(checklistSummary.rows[0].checklist_issues);
    const inventoryComplete = uncheckedRequired === 0;
    const ready =
      Boolean(linenComplete) &&
      Boolean(housekeepingComplete) &&
      inventoryComplete &&
      checklistIssues === 0 &&
      !Boolean(damageFound) &&
      !Boolean(securityIssueFound);
    const result = ready ? "pass" : "issues_found";
    const nextStatus = ready ? "ready" : "blocked";
    const blockedReason = ready
      ? ""
      : "Housekeeping, inventory, damage or security follow-up is required.";

    await setAppRole(client, actorUserId);
    const inspection = await client.query(
      [
        "insert into public.cottage_damage_inspections (",
        "  organization_id, campground_id, accommodation_id, turnover_id,",
        "  inspection_result, linen_complete, housekeeping_complete, inventory_complete,",
        "  damage_found, security_issue_found, damage_notes, security_notes,",
        "  inspected_by_user_id, created_by_user_id, updated_by_user_id",
        ") values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$13,$13)",
        "returning *",
      ].join("\n"),
      [
        turnover.organization_id,
        campgroundId,
        turnover.accommodation_id,
        turnoverId,
        result,
        Boolean(linenComplete),
        Boolean(housekeepingComplete),
        inventoryComplete,
        Boolean(damageFound),
        Boolean(securityIssueFound),
        normalizedDamageNotes,
        normalizedSecurityNotes,
        actorUserId,
      ],
    );

    const updatedTurnover = await client.query(
      [
        "update public.cottage_turnovers",
        "set status = $1,",
        "    started_at = coalesce(started_at, statement_timestamp()),",
        "    completed_at = case when $1 = 'ready' then statement_timestamp() else null end,",
        "    blocked_reason = $2,",
        "    updated_by_user_id = $3",
        "where id = $4 and campground_id = $5",
        "returning *",
      ].join("\n"),
      [nextStatus, blockedReason, actorUserId, turnoverId, campgroundId],
    );
    await resetAppRole(client);

    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: turnover.organization_id,
      campgroundId,
      actionKey: "accommodation.cottage.turnover.inspect",
      permissionKey: "accommodation.manage",
      riskLevel: "standard",
      subjectType: "cottage_turnover",
      subjectId: turnoverId,
      beforeState: {
        status: turnover.status,
      },
      afterState: {
        status: nextStatus,
        inspectionId: inspection.rows[0].id,
        inspectionResult: result,
        linenComplete: Boolean(linenComplete),
        housekeepingComplete: Boolean(housekeepingComplete),
        inventoryComplete,
        damageFound: Boolean(damageFound),
        securityIssueFound: Boolean(securityIssueFound),
        uncheckedRequired,
        checklistIssues,
      },
    });

    await client.query("commit");
    return {
      status: updatedTurnover.rows[0].status,
      inspectionId: inspection.rows[0].id,
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
