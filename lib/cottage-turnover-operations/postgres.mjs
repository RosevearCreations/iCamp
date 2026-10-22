import pg from "pg";

import { appendAuditEvent } from "../audit/postgres.mjs";
import { hasCampgroundPermission } from "../authz/postgres.mjs";

const { Pool } = pg;
let pool;

function databaseUrl() {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) {
    throw new Error(\n      "DATABASE_URL is required for cottage housekeeping turnover.",\n    );
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

export async function closeCottageTurnoverOperationsPoolForTests() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

async function assertPermission(userId, campgroundId, permission) {
  if (!(await hasCampgroundPermission(userId, campgroundId, permission))) {
    throw new Error(`Not authorized for ${permission}.`);
  }
}

async function assertAnyReadPermission(userId, campgroundId) {
  const permissions = [
    "accommodation.read",
    "accommodation.manage",
    "maintenance.read",
    "maintenance.complete",
    "inspection.perform",
    "inspection.signoff",
    "inspection.template.manage",
    "reservation.read",
    "reservation.modify",
  ];
  const allowed = await Promise.all(
    permissions.map((permission) =>
      hasCampgroundPermission(userId, campgroundId, permission),
    ),
  );
  if (!allowed.some(Boolean)) {
    throw new Error("Not authorized to read cottage housekeeping turnover.");
  }
}

async function campgroundScope(client, campgroundId) {
  const result = await client.query(
    [
      "select organization_id,id,name,timezone",
      "from public.campgrounds",
      "where id=$1 and lifecycle_state <> 'archived'",
      "limit 1",
    ].join("\n"),
    [campgroundId],
  );
  if (result.rowCount !== 1) {
    throw new Error("Campground is unavailable.");
  }
  return result.rows[0];
}

async function beginRls(client, userId) {
  await client.query("set local role icamp_app");
  await client.query("select set_config('icamp.user_id',$1,true)", [userId]);
}

function iso(value) {
  return value == null ? null : new Date(value).toISOString();
}

function text(value) {
  return String(value ?? "").trim();
}

export async function getCottageHousekeepingTurnoverWorkspace(
  userId,
  campgroundId,
) {
  await assertAnyReadPermission(userId, campgroundId);
  const client = await getPool().connect();

  try {
    await client.query("begin");
    const campground = await campgroundScope(client, campgroundId);

    const [
      cottageResult,
      inspectionTemplateResult,
      housekeepingTemplateResult,
    ] = await Promise.all([
      client.query(
        [
          "select a.id,a.code,a.display_name,a.status_state,a.row_version",
          "from public.accommodations a",
          "join public.rental_cottages rc",
          "  on rc.accommodation_id=a.id",
          " and rc.organization_id=a.organization_id",
          " and rc.campground_id=a.campground_id",
          "where a.campground_id=$1",
          "  and a.accommodation_kind='rental_cottage'",
          "  and a.lifecycle_state <> 'archived'",
          "order by a.code,a.display_name",
        ].join("\n"),
        [campgroundId],
      ),
      client.query(
        [
          "select t.id,t.accommodation_id,t.name,t.is_active,",
          "       v.version_number,v.signoff_required,v.published_at",
          "from public.inspection_templates t",
          "join public.inspection_template_versions v",
          "  on v.id=t.current_version_id",
          "where t.campground_id=$1",
          "  and t.target_kind='cottage'",
          "  and t.current_version_id is not null",
          "  and v.published_at is not null",
          "order by t.is_active desc,t.name",
        ].join("\n"),
        [campgroundId],
      ),
      client.query(
        [
          "select ht.*,a.code as cottage_code,a.display_name as cottage_name,",
          "       it.name as final_inspection_template_name,",
          "       iv.version_number as final_inspection_version_number,",
          "       iv.signoff_required as final_inspection_signoff_required",
          "from public.cottage_housekeeping_templates ht",
          "join public.accommodations a on a.id=ht.accommodation_id",
          "left join public.inspection_templates it",
          "  on it.id=ht.final_inspection_template_id",
          "left join public.inspection_template_versions iv",
          "  on iv.id=it.current_version_id",
          "where ht.campground_id=$1",
          "order by ht.is_active desc,a.code,ht.name",
        ].join("\n"),
        [campgroundId],
      ),
    ]);

    const turnoverResult = await client.query(
      [
        "select",
        "  ct.*,",
        "  a.code as cottage_code,",
        "  a.display_name as cottage_name,",
        "  a.status_state as accommodation_status_state,",
        "  a.row_version as accommodation_row_version,",
        "  ht.name as housekeeping_template_name,",
        "  ht.final_inspection_template_id,",
        "  coalesce(ch.required_items,0)::integer as required_items,",
        "  coalesce(ch.checked_required_items,0)::integer as checked_required_items,",
        "  coalesce(ch.checklist_issues,0)::integer as checklist_issues,",
        "  di.inspection_result as housekeeping_inspection_result,",
        "  di.linen_complete,",
        "  di.housekeeping_complete,",
        "  di.inventory_complete,",
        "  di.damage_found,",
        "  di.security_issue_found,",
        "  di.inspected_at as housekeeping_inspected_at,",
        "  fi.inspection_occurrence_id,",
        "  fi.inspection_status,",
        "  fi.inspection_template_name,",
        "  fi.inspection_version_number,",
        "  fi.inspection_signoff_required,",
        "  fi.inspection_started_at,",
        "  coalesce(ca.corrective_work_orders,0)::integer as corrective_work_orders,",
        "  coalesce(ca.open_corrective_work_orders,0)::integer as open_corrective_work_orders",
        "from public.cottage_turnovers ct",
        "join public.accommodations a on a.id=ct.accommodation_id",
        "join public.cottage_housekeeping_templates ht on ht.id=ct.template_id",
        "left join lateral (",
        "  select",
        "    count(*) filter (where c.is_required)::integer as required_items,",
        "    count(*) filter (where c.is_required and c.checked)::integer as checked_required_items,",
        "    count(*) filter (where c.issue_found)::integer as checklist_issues",
        "  from public.cottage_turnover_item_checks c",
        "  where c.turnover_id=ct.id",
        ") ch on true",
        "left join lateral (",
        "  select d.*",
        "  from public.cottage_damage_inspections d",
        "  where d.turnover_id=ct.id",
        "  order by d.inspected_at desc,d.created_at desc",
        "  limit 1",
        ") di on true",
        "left join lateral (",
        "  select",
        "    e.inspection_occurrence_id,",
        "    o.status as inspection_status,",
        "    t.name as inspection_template_name,",
        "    v.version_number as inspection_version_number,",
        "    v.signoff_required as inspection_signoff_required,",
        "    e.created_at as inspection_started_at",
        "  from public.cottage_turnover_inspection_evidence e",
        "  join public.inspection_occurrences o on o.id=e.inspection_occurrence_id",
        "  join public.inspection_templates t on t.id=o.template_id",
        "  join public.inspection_template_versions v on v.id=o.template_version_id",
        "  where e.turnover_id=ct.id",
        "  order by e.created_at desc,e.id desc",
        "  limit 1",
        ") fi on true",
        "left join lateral (",
        "  select",
        "    count(*)::integer as corrective_work_orders,",
        "    count(*) filter (where wo.status not in ('completed','cancelled'))::integer",
        "      as open_corrective_work_orders",
        "  from public.inspection_results ir",
        "  join public.inspection_corrective_actions action",
        "    on action.inspection_result_id=ir.id",
        "  join public.maintenance_work_orders wo",
        "    on wo.id=action.work_order_id",
        "  where ir.occurrence_id=fi.inspection_occurrence_id",
        ") ca on true",
        "where ct.campground_id=$1",
        "order by",
        "  case when ct.released_at is null and ct.status <> 'cancelled' then 0 else 1 end,",
        "  ct.scheduled_for desc,ct.created_at desc",
        "limit 250",
      ].join("\n"),
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
      generatedAt: new Date().toISOString(),
      cottages: cottageResult.rows.map((row) => ({
        id: row.id,
        code: row.code,
        name: row.display_name,
        statusState: row.status_state,
        rowVersion: Number(row.row_version),
      })),
      inspectionTemplates: inspectionTemplateResult.rows.map((row) => ({
        id: row.id,
        accommodationId: row.accommodation_id,
        name: row.name,
        isActive: row.is_active === true,
        versionNumber: Number(row.version_number),
        signoffRequired: row.signoff_required === true,
      })),
      housekeepingTemplates: housekeepingTemplateResult.rows.map((row) => ({
        id: row.id,
        accommodationId: row.accommodation_id,
        cottageCode: row.cottage_code,
        cottageName: row.cottage_name,
        name: row.name,
        turnoverType: row.turnover_type,
        expectedMinutes: Number(row.expected_minutes),
        finalInspectionTemplateId: row.final_inspection_template_id ?? null,
        finalInspectionTemplateName: row.final_inspection_template_name ?? null,
        finalInspectionVersionNumber:
          row.final_inspection_version_number == null
            ? null
            : Number(row.final_inspection_version_number),
        finalInspectionSignoffRequired:
          row.final_inspection_signoff_required === true,
        isActive: row.is_active === true,
        rowVersion: Number(row.row_version),
      })),
      turnovers: turnoverResult.rows.map((row) => ({
        id: row.id,
        accommodationId: row.accommodation_id,
        cottageCode: row.cottage_code,
        cottageName: row.cottage_name,
        accommodationStatusState: row.accommodation_status_state,
        accommodationRowVersion: Number(row.accommodation_row_version),
        housekeepingTemplateId: row.template_id,
        housekeepingTemplateName: row.housekeeping_template_name,
        finalInspectionTemplateId: row.final_inspection_template_id ?? null,
        status: row.status,
        releaseRequired: row.release_required === true,
        scheduledFor: iso(row.scheduled_for),
        startedAt: iso(row.started_at),
        completedAt: iso(row.completed_at),
        releasedAt: iso(row.released_at),
        releasedByUserId: row.released_by_user_id ?? null,
        notes: row.notes,
        blockedReason: row.blocked_reason,
        requiredItems: Number(row.required_items ?? 0),
        checkedRequiredItems: Number(row.checked_required_items ?? 0),
        checklistIssues: Number(row.checklist_issues ?? 0),
        housekeepingInspectionResult:
          row.housekeeping_inspection_result ?? null,
        linenComplete: row.linen_complete === true,
        housekeepingComplete: row.housekeeping_complete === true,
        inventoryComplete: row.inventory_complete === true,
        damageFound: row.damage_found === true,
        securityIssueFound: row.security_issue_found === true,
        housekeepingInspectedAt: iso(row.housekeeping_inspected_at),
        inspectionOccurrenceId: row.inspection_occurrence_id ?? null,
        inspectionStatus: row.inspection_status ?? null,
        inspectionTemplateName: row.inspection_template_name ?? null,
        inspectionVersionNumber:
          row.inspection_version_number == null
            ? null
            : Number(row.inspection_version_number),
        inspectionSignoffRequired: row.inspection_signoff_required === true,
        inspectionStartedAt: iso(row.inspection_started_at),
        correctiveWorkOrders: Number(row.corrective_work_orders ?? 0),
        openCorrectiveWorkOrders: Number(row.open_corrective_work_orders ?? 0),
        rowVersion: Number(row.row_version),
      })),
    };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function configureCottageTurnoverFinalInspection({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  housekeepingTemplateId,
  inspectionTemplateId,
  expectedRowVersion,
}) {
  await assertPermission(actorUserId, campgroundId, "accommodation.manage");

  if (!text(housekeepingTemplateId) || !text(inspectionTemplateId)) {
    throw new Error(\n      "Housekeeping and final inspection templates are required.",\n    );
  }
  const expected = Number(expectedRowVersion);
  if (!Number.isInteger(expected) || expected < 1) {
    throw new Error(
      "Housekeeping template changed since this page loaded. Refresh and try again.",
    );
  }

  const client = await getPool().connect();
  try {
    await client.query("begin");
    const campground = await campgroundScope(client, campgroundId);

    const dependency = await client.query(
      [
        "select",
        "  ht.id as housekeeping_template_id,",
        "  ht.accommodation_id,",
        "  it.id as inspection_template_id,",
        "  it.target_kind,",
        "  it.accommodation_id as inspection_accommodation_id,",
        "  it.is_active,",
        "  iv.published_at",
        "from public.cottage_housekeeping_templates ht",
        "join public.inspection_templates it",
        "  on it.id=$2",
        " and it.campground_id=ht.campground_id",
        "join public.inspection_template_versions iv",
        "  on iv.id=it.current_version_id",
        "where ht.id=$1 and ht.campground_id=$3",
        "limit 1",
      ].join("\n"),
      [housekeepingTemplateId, inspectionTemplateId, campgroundId],
    );

    if (dependency.rowCount !== 1) {
      throw new Error(\n        "Housekeeping or cottage inspection template is unavailable.",\n      );
    }
    const row = dependency.rows[0];
    if (
      row.target_kind !== "cottage" ||
      row.inspection_accommodation_id !== row.accommodation_id ||
      row.is_active !== true ||
      row.published_at == null
    ) {
      throw new Error(
        "Final turnover inspection must be an active published cottage inspection for the same cottage.",
      );
    }

    await beginRls(client, actorUserId);
    const updated = await client.query(
      [
        "update public.cottage_housekeeping_templates",
        "set final_inspection_template_id=$3,",
        "    updated_by_user_id=$4",
        "where id=$1 and campground_id=$2 and row_version=$5",
        "returning id,row_version",
      ].join("\n"),
      [
        housekeepingTemplateId,
        campgroundId,
        inspectionTemplateId,
        actorUserId,
        expected,
      ],
    );
    if (updated.rowCount !== 1) {
      throw new Error(
        "Housekeeping template changed since this page loaded. Refresh and try again.",
      );
    }

    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: campground.organization_id,
      campgroundId,
      actionKey: "cottage.turnover.final_inspection.configure",
      permissionKey: "accommodation.manage",
      riskLevel: "standard",
      subjectType: "cottage_housekeeping_template",
      subjectId: housekeepingTemplateId,
      afterState: {
        inspectionTemplateId,
        accommodationId: row.accommodation_id,
      },
    });

    await client.query("commit");
    return Number(updated.rows[0].row_version);
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function startCottageTurnoverFinalInspection({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  turnoverId,
}) {
  await assertPermission(actorUserId, campgroundId, "inspection.perform");
  const client = await getPool().connect();

  try {
    await client.query("begin");
    const campground = await campgroundScope(client, campgroundId);
    await beginRls(client, actorUserId);
    await client.query("select pg_advisory_xact_lock(hashtextextended($1,0))", [
      "icamp-cottage-turnover:" + turnoverId,
    ]);

    const turnoverResult = await client.query(
      [
        "select",
        "  ct.*,",
        "  ht.final_inspection_template_id,",
        "  it.current_version_id,",
        "  it.is_active as inspection_template_active,",
        "  iv.signoff_required,",
        "  iv.published_at,",
        "  coalesce(ch.unchecked_required,0)::integer as unchecked_required,",
        "  coalesce(ch.checklist_issues,0)::integer as checklist_issues,",
        "  di.inspection_result as housekeeping_inspection_result,",
        "  di.linen_complete,di.housekeeping_complete,di.inventory_complete,",
        "  di.damage_found,di.security_issue_found",
        "from public.cottage_turnovers ct",
        "join public.cottage_housekeeping_templates ht on ht.id=ct.template_id",
        "left join public.inspection_templates it",
        "  on it.id=ht.final_inspection_template_id",
        "left join public.inspection_template_versions iv",
        "  on iv.id=it.current_version_id",
        "left join lateral (",
        "  select",
        "    count(*) filter (where is_required and not checked)::integer",
        "      as unchecked_required,",
        "    count(*) filter (where issue_found)::integer as checklist_issues",
        "  from public.cottage_turnover_item_checks c",
        "  where c.turnover_id=ct.id",
        ") ch on true",
        "left join lateral (",
        "  select d.*",
        "  from public.cottage_damage_inspections d",
        "  where d.turnover_id=ct.id",
        "  order by d.inspected_at desc,d.created_at desc",
        "  limit 1",
        ") di on true",
        "where ct.id=$1 and ct.campground_id=$2",
        "limit 1",
        "for update of ct",
      ].join("\n"),
      [turnoverId, campgroundId],
    );

    if (turnoverResult.rowCount !== 1) {
      throw new Error("Cottage turnover is unavailable.");
    }
    const turnover = turnoverResult.rows[0];

    if (turnover.status === "cancelled") {
      throw new Error("Cancelled cottage turnover cannot be inspected.");
    }
    if (turnover.release_required !== true) {
      throw new Error(\n        "Legacy completed cottage turnover does not require Build 074 release.",\n      );
    }
    if (turnover.released_at) {
      throw new Error("Cottage turnover is already released.");
    }
    if (
      !turnover.final_inspection_template_id ||
      !turnover.current_version_id ||
      turnover.inspection_template_active !== true ||
      turnover.published_at == null
    ) {
      throw new Error(
        "Configure an active published final cottage inspection before starting release inspection.",
      );
    }
    if (
      Number(turnover.unchecked_required) > 0 ||
      Number(turnover.checklist_issues) > 0
    ) {
      throw new Error(
        "Complete the required cottage inventory checklist and resolve checklist issues first.",
      );
    }
    if (
      turnover.housekeeping_inspection_result !== "pass" ||
      turnover.linen_complete !== true ||
      turnover.housekeeping_complete !== true ||
      turnover.inventory_complete !== true ||
      turnover.damage_found === true ||
      turnover.security_issue_found === true
    ) {
      throw new Error(
        "Record a passing housekeeping, linen, inventory, damage and security readiness inspection before final inspection.",
      );
    }

    const prior = await client.query(
      [
        "select e.inspection_occurrence_id,o.status",
        "from public.cottage_turnover_inspection_evidence e",
        "join public.inspection_occurrences o on o.id=e.inspection_occurrence_id",
        "where e.turnover_id=$1 and e.campground_id=$2",
        "order by e.created_at desc,e.id desc",
        "limit 1",
      ].join("\n"),
      [turnoverId, campgroundId],
    );
    if (prior.rowCount === 1 && prior.rows[0].status !== "rejected") {
      await client.query("commit");
      return prior.rows[0].inspection_occurrence_id;
    }

    const occurrence = await client.query(
      [
        "insert into public.inspection_occurrences (",
        "  organization_id,campground_id,template_id,template_version_id,",
        "  target_kind,asset_id,accommodation_id,inspector_user_id,",
        "  signoff_required",
        ") values ($1,$2,$3,$4,'cottage',null,$5,$6,$7)",
        "returning id",
      ].join("\n"),
      [
        campground.organization_id,
        campgroundId,
        turnover.final_inspection_template_id,
        turnover.current_version_id,
        turnover.accommodation_id,
        actorUserId,
        turnover.signoff_required,
      ],
    );
    const occurrenceId = occurrence.rows[0].id;

    await client.query(
      [
        "insert into public.cottage_turnover_inspection_evidence (",
        "  organization_id,campground_id,turnover_id,inspection_occurrence_id,",
        "  started_by_user_id",
        ") values ($1,$2,$3,$4,$5)",
      ].join("\n"),
      [
        campground.organization_id,
        campgroundId,
        turnoverId,
        occurrenceId,
        actorUserId,
      ],
    );

    await client.query(
      [
        "update public.cottage_turnovers",
        "set status='inspection',",
        "    started_at=coalesce(started_at,statement_timestamp()),",
        "    completed_at=null,",
        "    blocked_reason='',",
        "    updated_by_user_id=$3",
        "where id=$1 and campground_id=$2",
      ].join("\n"),
      [turnoverId, campgroundId, actorUserId],
    );

    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: campground.organization_id,
      campgroundId,
      actionKey: "cottage.turnover.final_inspection.start",
      permissionKey: "inspection.perform",
      riskLevel: "standard",
      subjectType: "cottage_turnover",
      subjectId: turnoverId,
      metadata: {
        inspectionOccurrenceId: occurrenceId,
        inspectionTemplateId: turnover.final_inspection_template_id,
      },
    });

    await client.query("commit");
    return occurrenceId;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function releaseCottageTurnover({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  turnoverId,
  expectedRowVersion,
}) {
  await assertPermission(actorUserId, campgroundId, "accommodation.manage");
  const expected = Number(expectedRowVersion);
  if (!Number.isInteger(expected) || expected < 1) {
    throw new Error("Cottage turnover row version is invalid.");
  }

  const client = await getPool().connect();
  try {
    await client.query("begin");
    const campground = await campgroundScope(client, campgroundId);
    await beginRls(client, actorUserId);
    await client.query("select pg_advisory_xact_lock(hashtextextended($1,0))", [
      "icamp-cottage-turnover-release:" + turnoverId,
    ]);

    const result = await client.query(
      [
        "select",
        "  ct.*,",
        "  a.status_state as accommodation_status_state,",
        "  a.row_version as accommodation_row_version,",
        "  fi.inspection_occurrence_id,",
        "  fi.inspection_status,",
        "  coalesce(ca.open_corrective_work_orders,0)::integer",
        "    as open_corrective_work_orders,",
        "  coalesce(ch.unchecked_required,0)::integer as unchecked_required,",
        "  coalesce(ch.checklist_issues,0)::integer as checklist_issues,",
        "  di.inspection_result as housekeeping_inspection_result",
        "from public.cottage_turnovers ct",
        "join public.accommodations a on a.id=ct.accommodation_id",
        "left join lateral (",
        "  select e.inspection_occurrence_id,o.status as inspection_status",
        "  from public.cottage_turnover_inspection_evidence e",
        "  join public.inspection_occurrences o on o.id=e.inspection_occurrence_id",
        "  where e.turnover_id=ct.id",
        "  order by e.created_at desc,e.id desc",
        "  limit 1",
        ") fi on true",
        "left join lateral (",
        "  select count(*) filter (",
        "    where wo.status not in ('completed','cancelled')",
        "  )::integer as open_corrective_work_orders",
        "  from public.inspection_results ir",
        "  join public.inspection_corrective_actions action",
        "    on action.inspection_result_id=ir.id",
        "  join public.maintenance_work_orders wo on wo.id=action.work_order_id",
        "  where ir.occurrence_id=fi.inspection_occurrence_id",
        ") ca on true",
        "left join lateral (",
        "  select",
        "    count(*) filter (where is_required and not checked)::integer",
        "      as unchecked_required,",
        "    count(*) filter (where issue_found)::integer as checklist_issues",
        "  from public.cottage_turnover_item_checks c",
        "  where c.turnover_id=ct.id",
        ") ch on true",
        "left join lateral (",
        "  select d.inspection_result",
        "  from public.cottage_damage_inspections d",
        "  where d.turnover_id=ct.id",
        "  order by d.inspected_at desc,d.created_at desc",
        "  limit 1",
        ") di on true",
        "where ct.id=$1 and ct.campground_id=$2",
        "limit 1",
        "for update of ct,a",
      ].join("\n"),
      [turnoverId, campgroundId],
    );

    if (result.rowCount !== 1) {
      throw new Error("Cottage turnover is unavailable.");
    }
    const turnover = result.rows[0];

    if (turnover.released_at) {
      await client.query("commit");
      return;
    }
    if (turnover.release_required !== true) {
      throw new Error(\n        "Legacy completed cottage turnover does not require Build 074 release.",\n      );
    }
    if (Number(turnover.row_version) !== expected) {
      throw new Error(
        "Cottage turnover changed since this page loaded. Refresh and try again.",
      );
    }
    if (
      !turnover.inspection_occurrence_id ||
      turnover.inspection_status !== "signed_off"
    ) {
      throw new Error(
        "The canonical final cottage inspection must be signed off before release.",
      );
    }
    if (Number(turnover.open_corrective_work_orders) > 0) {
      throw new Error(
        "Corrective maintenance work must be completed or cancelled before release.",
      );
    }
    if (
      Number(turnover.unchecked_required) > 0 ||
      Number(turnover.checklist_issues) > 0 ||
      turnover.housekeeping_inspection_result !== "pass"
    ) {
      throw new Error(
        "Housekeeping, linen, inventory and damage readiness must remain clear before release.",
      );
    }

    const released = await client.query(
      [
        "update public.cottage_turnovers",
        "set status='ready',",
        "    completed_at=coalesce(completed_at,statement_timestamp()),",
        "    released_at=statement_timestamp(),",
        "    released_by_user_id=$4,",
        "    blocked_reason='',",
        "    updated_by_user_id=$4",
        "where id=$1 and campground_id=$2 and row_version=$3",
        "returning released_at",
      ].join("\n"),
      [turnoverId, campgroundId, expected, actorUserId],
    );
    if (released.rowCount !== 1) {
      throw new Error(
        "Cottage turnover changed during release. Refresh and try again.",
      );
    }

    let releasedToAvailable = false;
    if (turnover.accommodation_status_state === "inspection") {
      await client.query("select set_config('icamp.status_reason',$1,true)", [
        "Build 074 cottage housekeeping turnover cleared.",
      ]);
      const availability = await client.query(
        [
          "update public.accommodations",
          "set status_state='available',updated_by_user_id=$3",
          "where id=$1 and campground_id=$2",
          "  and row_version=$4 and status_state='inspection'",
          "returning id",
        ].join("\n"),
        [
          turnover.accommodation_id,
          campgroundId,
          actorUserId,
          Number(turnover.accommodation_row_version),
        ],
      );
      if (availability.rowCount !== 1) {
        throw new Error(
          "Cottage availability changed during turnover release. Refresh and try again.",
        );
      }
      releasedToAvailable = true;
    }

    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: campground.organization_id,
      campgroundId,
      actionKey: "cottage.turnover.release",
      permissionKey: "accommodation.manage",
      riskLevel: "standard",
      subjectType: "cottage_turnover",
      subjectId: turnoverId,
      beforeState: {
        status: turnover.status,
        accommodationStatus: turnover.accommodation_status_state,
      },
      afterState: {
        status: "ready",
        released: true,
        releasedToAvailable,
      },
      metadata: {
        inspectionOccurrenceId: turnover.inspection_occurrence_id,
      },
    });

    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
