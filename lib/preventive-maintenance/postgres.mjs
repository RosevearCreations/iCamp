import pg from "pg";

import { appendAuditEvent } from "../audit/postgres.mjs";
import { hasCampgroundPermission } from "../authz/postgres.mjs";
import {
  validatePreventiveMaintenanceProgramInput,
  validatePreventiveMaintenanceTemplateInput,
} from "./core.mjs";

const { Pool } = pg;
let pool;

function databaseUrl() {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) {
    throw new Error("DATABASE_URL is required for preventive maintenance.");
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

export async function closePreventiveMaintenancePoolForTests() {
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
      "maintenance.schedule",
      "maintenance.preventive",
    ].map((permission) => allowed(userId, campgroundId, permission)),
  );
  if (!checks.some(Boolean)) {
    throw new Error("Not authorized to read preventive maintenance.");
  }
}

async function assertPermission(userId, campgroundId, permission) {
  if (!(await allowed(userId, campgroundId, permission))) {
    throw new Error(`Not authorized for ${permission}.`);
  }
}

async function campgroundScope(client, campgroundId) {
  const result = await client.query(
    "select organization_id,id,name,timezone from public.campgrounds where id=$1 and lifecycle_state <> 'archived' limit 1",
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

function mapAsset(row) {
  return {
    id: row.id,
    code: row.code,
    name: row.display_name,
    assetClass: row.asset_class,
    lifecycleState: row.lifecycle_state,
    operatingState: row.operating_state,
    facilityType: row.facility_type ?? null,
    equipmentType: row.equipment_type ?? null,
    make: row.make ?? null,
    model: row.model ?? null,
    serialNumber: row.serial_number ?? null,
    meterKind: row.meter_kind ?? "none",
    meterValue: row.meter_value == null ? null : Number(row.meter_value),
  };
}

function mapTemplate(row) {
  return {
    id: row.id,
    targetAssetClass: row.target_asset_class,
    name: row.name,
    description: row.description ?? null,
    serviceInstructions: row.service_instructions,
    isActive: row.is_active === true,
    rowVersion: Number(row.row_version),
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSchedule(row) {
  return {
    id: row.id,
    assetId: row.asset_id,
    assetName: row.asset_name,
    title: row.title,
    description: row.description ?? null,
    recurrenceKind: row.recurrence_kind,
    intervalValue: row.interval_value == null ? null : Number(row.interval_value),
    weekday: row.weekday == null ? null : Number(row.weekday),
    monthDay: row.month_day == null ? null : Number(row.month_day),
    seasonMonth: row.season_month == null ? null : Number(row.season_month),
    seasonDay: row.season_day == null ? null : Number(row.season_day),
    firstOccurrenceLocal: row.first_occurrence_local,
    nextOccurrenceAt: row.next_occurrence_at,
    isActive: row.is_active === true,
  };
}

function mapProgram(row) {
  return {
    id: row.id,
    assetId: row.asset_id,
    assetName: row.asset_name,
    assetClass: row.asset_class,
    templateId: row.template_id,
    templateName: row.template_name,
    targetAssetClass: row.target_asset_class,
    serviceInstructions: row.service_instructions,
    maintenanceScheduleId: row.maintenance_schedule_id,
    maintenanceScheduleTitle: row.schedule_title,
    recurrenceKind: row.recurrence_kind,
    nextOccurrenceAt: row.next_occurrence_at,
    scheduleActive: row.schedule_active === true,
    notes: row.notes ?? null,
    isActive: row.is_active === true,
    rowVersion: Number(row.row_version),
  };
}

function byWorkOrder(rows, mapper) {
  const result = new Map();
  for (const row of rows) {
    const list = result.get(row.work_order_id) ?? [];
    list.push(mapper(row));
    result.set(row.work_order_id, list);
  }
  return result;
}

export async function getPreventiveMaintenanceWorkspace(userId, campgroundId) {
  await assertCanRead(userId, campgroundId);
  const client = await getPool().connect();

  try {
    await client.query("begin");
    const campground = await campgroundScope(client, campgroundId);
    const assetResult = await client.query(
      `select
         a.id,a.code,a.display_name,a.asset_class,a.lifecycle_state,
         a.operating_state,
         f.facility_type,
         e.equipment_type,e.make,e.model,e.serial_number,
         e.meter_kind,e.meter_value
       from public.operational_assets a
       left join public.operational_facilities f on f.asset_id=a.id
       left join public.operational_equipment e on e.asset_id=a.id
       where a.campground_id=$1
         and a.lifecycle_state <> 'archived'
       order by a.asset_class,a.display_name`,
      [campgroundId],
    );

    await beginRls(client, userId);

    const [templateResult, scheduleResult, programResult, historyResult] =
      await Promise.all([
        client.query(
          `select *
           from public.preventive_maintenance_templates
           where campground_id=$1
           order by is_active desc,target_asset_class,name`,
          [campgroundId],
        ),
        client.query(
          `select s.*,a.display_name as asset_name
           from public.maintenance_schedules s
           join public.operational_assets a on a.id=s.asset_id
           where s.campground_id=$1
             and s.asset_id is not null
             and s.accommodation_id is null
           order by s.is_active desc,s.next_occurrence_at,s.title`,
          [campgroundId],
        ),
        client.query(
          `select
             p.*,
             a.display_name as asset_name,
             a.asset_class,
             t.name as template_name,
             t.target_asset_class,
             t.service_instructions,
             s.title as schedule_title,
             s.recurrence_kind,
             s.next_occurrence_at,
             s.is_active as schedule_active
           from public.preventive_maintenance_programs p
           join public.operational_assets a on a.id=p.asset_id
           join public.preventive_maintenance_templates t on t.id=p.template_id
           join public.maintenance_schedules s
             on s.id=p.maintenance_schedule_id
           where p.campground_id=$1
           order by p.is_active desc,a.display_name,t.name`,
          [campgroundId],
        ),
        client.query(
          `select
             p.id as program_id,
             o.id as occurrence_id,
             o.scheduled_for,
             o.state as occurrence_state,
             o.reason_code,
             wo.id as work_order_id,
             wo.title as work_order_title,
             wo.status as work_order_status,
             wo.completed_at,
             wo.completion_summary,
             wo.created_at as work_order_created_at
           from public.preventive_maintenance_programs p
           join public.maintenance_schedule_occurrences o
             on o.schedule_id=p.maintenance_schedule_id
           left join public.maintenance_work_orders wo
             on wo.id=o.work_order_id
           where p.campground_id=$1
           order by o.scheduled_for desc
           limit 250`,
          [campgroundId],
        ),
      ]);

    const workOrderIds = historyResult.rows
      .map((row) => row.work_order_id)
      .filter(Boolean);

    let materialRows = [];
    let laborRows = [];
    if (workOrderIds.length > 0) {
      const [materials, labor] = await Promise.all([
        client.query(
          `select
             work_order_id,item_name,quantity,unit,unit_cost_cents,recorded_at
           from public.maintenance_work_order_materials
           where work_order_id=any($1::uuid[])
           order by recorded_at`,
          [workOrderIds],
        ),
        client.query(
          `select
             work_order_id,worker_user_id,minutes,note,worked_at
           from public.maintenance_work_order_labor
           where work_order_id=any($1::uuid[])
           order by worked_at`,
          [workOrderIds],
        ),
      ]);
      materialRows = materials.rows;
      laborRows = labor.rows;
    }

    await client.query("commit");

    const materialsByWorkOrder = byWorkOrder(materialRows, (row) => ({
      itemName: row.item_name,
      quantity: Number(row.quantity),
      unit: row.unit,
      unitCostCents:
        row.unit_cost_cents == null ? null : Number(row.unit_cost_cents),
      recordedAt: row.recorded_at,
    }));
    const laborByWorkOrder = byWorkOrder(laborRows, (row) => ({
      workerUserId: row.worker_user_id,
      minutes: Number(row.minutes),
      note: row.note ?? null,
      workedAt: row.worked_at,
    }));

    return {
      campground: {
        id: campground.id,
        organizationId: campground.organization_id,
        name: campground.name,
        timezone: campground.timezone,
      },
      generatedAt: new Date().toISOString(),
      assets: assetResult.rows.map(mapAsset),
      templates: templateResult.rows.map(mapTemplate),
      schedules: scheduleResult.rows.map(mapSchedule),
      programs: programResult.rows.map(mapProgram),
      history: historyResult.rows.map((row) => ({
        programId: row.program_id,
        occurrenceId: row.occurrence_id,
        scheduledFor: row.scheduled_for,
        occurrenceState: row.occurrence_state,
        reasonCode: row.reason_code ?? null,
        workOrderId: row.work_order_id ?? null,
        workOrderTitle: row.work_order_title ?? null,
        workOrderStatus: row.work_order_status ?? null,
        completedAt: row.completed_at ?? null,
        completionSummary: row.completion_summary ?? null,
        workOrderCreatedAt: row.work_order_created_at ?? null,
        materials: row.work_order_id
          ? (materialsByWorkOrder.get(row.work_order_id) ?? [])
          : [],
        labor: row.work_order_id
          ? (laborByWorkOrder.get(row.work_order_id) ?? [])
          : [],
      })),
    };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function createPreventiveMaintenanceTemplate({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  ...input
}) {
  await assertPermission(
    actorUserId,
    campgroundId,
    "maintenance.preventive",
  );
  const template = validatePreventiveMaintenanceTemplateInput(input);
  const client = await getPool().connect();

  try {
    await client.query("begin");
    const campground = await campgroundScope(client, campgroundId);
    await beginRls(client, actorUserId);

    const inserted = await client.query(
      `insert into public.preventive_maintenance_templates (
         organization_id,campground_id,target_asset_class,name,description,
         service_instructions,is_active,created_by_user_id,updated_by_user_id
       )
       values ($1,$2,$3,$4,$5,$6,true,$7,$7)
       returning *`,
      [
        campground.organization_id,
        campgroundId,
        template.targetAssetClass,
        template.name,
        template.description,
        template.serviceInstructions,
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
      actionKey: "maintenance.preventive.template.create",
      permissionKey: "maintenance.preventive",
      riskLevel: "elevated",
      subjectType: "preventive_maintenance.template",
      subjectId: saved.id,
      afterState: {
        targetAssetClass: saved.target_asset_class,
        name: saved.name,
        active: saved.is_active,
      },
    });
    await client.query("commit");
    return saved.id;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function setPreventiveMaintenanceTemplateActive({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  templateId,
  isActive,
  expectedRowVersion,
}) {
  await assertPermission(
    actorUserId,
    campgroundId,
    "maintenance.preventive",
  );
  const expected = Number(expectedRowVersion);
  if (!Number.isInteger(expected) || expected < 1) {
    throw new Error("Preventive-maintenance template row version is invalid.");
  }
  const client = await getPool().connect();

  try {
    await client.query("begin");
    await beginRls(client, actorUserId);
    const beforeResult = await client.query(
      `select *
       from public.preventive_maintenance_templates
       where id=$1 and campground_id=$2
       limit 1
       for update`,
      [templateId, campgroundId],
    );
    if (beforeResult.rowCount !== 1) {
      throw new Error("Preventive-maintenance template is unavailable.");
    }

    if (!isActive) {
      const activePrograms = await client.query(
        `select count(*)::integer as count
         from public.preventive_maintenance_programs
         where campground_id=$1 and template_id=$2 and is_active`,
        [campgroundId, templateId],
      );
      if (Number(activePrograms.rows[0]?.count ?? 0) > 0) {
        throw new Error(
          "Deactivate programs using this template before deactivating the template.",
        );
      }
    }

    const before = beforeResult.rows[0];
    const updated = await client.query(
      `update public.preventive_maintenance_templates
       set is_active=$4,updated_by_user_id=$5
       where id=$1 and campground_id=$2 and row_version=$3
       returning *`,
      [templateId, campgroundId, expected, Boolean(isActive), actorUserId],
    );
    if (updated.rowCount !== 1) {
      throw new Error(
        "Preventive-maintenance template changed since this page loaded. Refresh and try again.",
      );
    }
    const saved = updated.rows[0];

    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: saved.organization_id,
      campgroundId,
      actionKey: isActive
        ? "maintenance.preventive.template.activate"
        : "maintenance.preventive.template.deactivate",
      permissionKey: "maintenance.preventive",
      riskLevel: "elevated",
      subjectType: "preventive_maintenance.template",
      subjectId: templateId,
      beforeState: {
        active: before.is_active,
        rowVersion: Number(before.row_version),
      },
      afterState: {
        active: saved.is_active,
        rowVersion: Number(saved.row_version),
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

export async function configurePreventiveMaintenanceProgram({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  ...input
}) {
  await assertPermission(
    actorUserId,
    campgroundId,
    "maintenance.preventive",
  );
  await assertPermission(actorUserId, campgroundId, "maintenance.schedule");
  const program = validatePreventiveMaintenanceProgramInput(input);
  const client = await getPool().connect();

  try {
    await client.query("begin");
    const campground = await campgroundScope(client, campgroundId);
    const [assetResult, templateResult, scheduleResult] = await Promise.all([
      client.query(
        `select id,asset_class,lifecycle_state
         from public.operational_assets
         where id=$1 and campground_id=$2
         limit 1`,
        [program.assetId, campgroundId],
      ),
      client.query(
        `select id,target_asset_class,is_active
         from public.preventive_maintenance_templates
         where id=$1 and campground_id=$2
         limit 1`,
        [program.templateId, campgroundId],
      ),
      client.query(
        `select id,asset_id,accommodation_id
         from public.maintenance_schedules
         where id=$1 and campground_id=$2
         limit 1`,
        [program.maintenanceScheduleId, campgroundId],
      ),
    ]);

    if (
      assetResult.rowCount !== 1 ||
      assetResult.rows[0].lifecycle_state === "archived"
    ) {
      throw new Error("Selected preventive-maintenance asset is unavailable.");
    }
    if (templateResult.rowCount !== 1 || !templateResult.rows[0].is_active) {
      throw new Error(
        "Selected preventive-maintenance template is unavailable.",
      );
    }
    const assetClass = assetResult.rows[0].asset_class;
    const targetClass = templateResult.rows[0].target_asset_class;
    if (targetClass !== "either" && targetClass !== assetClass) {
      throw new Error(
        "Selected preventive-maintenance template does not match the asset class.",
      );
    }
    if (
      scheduleResult.rowCount !== 1 ||
      scheduleResult.rows[0].asset_id !== program.assetId ||
      scheduleResult.rows[0].accommodation_id != null
    ) {
      throw new Error(
        "Selected recurring schedule must target the exact canonical asset.",
      );
    }

    await beginRls(client, actorUserId);
    const inserted = await client.query(
      `insert into public.preventive_maintenance_programs (
         organization_id,campground_id,asset_id,template_id,
         maintenance_schedule_id,notes,is_active,
         created_by_user_id,updated_by_user_id
       )
       values ($1,$2,$3,$4,$5,$6,$7,$8,$8)
       returning *`,
      [
        campground.organization_id,
        campgroundId,
        program.assetId,
        program.templateId,
        program.maintenanceScheduleId,
        program.notes,
        program.isActive,
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
      actionKey: "maintenance.preventive.program.create",
      permissionKey: "maintenance.preventive",
      riskLevel: "elevated",
      subjectType: "preventive_maintenance.program",
      subjectId: saved.id,
      afterState: {
        assetId: saved.asset_id,
        templateId: saved.template_id,
        maintenanceScheduleId: saved.maintenance_schedule_id,
        active: saved.is_active,
      },
    });
    await client.query("commit");
    return saved.id;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function setPreventiveMaintenanceProgramActive({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  programId,
  isActive,
  expectedRowVersion,
}) {
  await assertPermission(
    actorUserId,
    campgroundId,
    "maintenance.preventive",
  );
  const expected = Number(expectedRowVersion);
  if (!Number.isInteger(expected) || expected < 1) {
    throw new Error("Preventive-maintenance program row version is invalid.");
  }
  const client = await getPool().connect();

  try {
    await client.query("begin");
    await beginRls(client, actorUserId);
    const beforeResult = await client.query(
      `select *
       from public.preventive_maintenance_programs
       where id=$1 and campground_id=$2
       limit 1
       for update`,
      [programId, campgroundId],
    );
    if (beforeResult.rowCount !== 1) {
      throw new Error("Preventive-maintenance program is unavailable.");
    }
    const before = beforeResult.rows[0];
    const updated = await client.query(
      `update public.preventive_maintenance_programs
       set is_active=$4,updated_by_user_id=$5
       where id=$1 and campground_id=$2 and row_version=$3
       returning *`,
      [programId, campgroundId, expected, Boolean(isActive), actorUserId],
    );
    if (updated.rowCount !== 1) {
      throw new Error(
        "Preventive-maintenance program changed since this page loaded. Refresh and try again.",
      );
    }
    const saved = updated.rows[0];

    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: saved.organization_id,
      campgroundId,
      actionKey: isActive
        ? "maintenance.preventive.program.activate"
        : "maintenance.preventive.program.deactivate",
      permissionKey: "maintenance.preventive",
      riskLevel: "elevated",
      subjectType: "preventive_maintenance.program",
      subjectId: programId,
      beforeState: {
        active: before.is_active,
        rowVersion: Number(before.row_version),
      },
      afterState: {
        active: saved.is_active,
        rowVersion: Number(saved.row_version),
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
