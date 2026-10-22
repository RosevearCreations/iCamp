import pg from "pg";

import { appendAuditEvent } from "../audit/postgres.mjs";
import { hasCampgroundPermission } from "../authz/postgres.mjs";
import { createMaintenanceWorkOrder } from "../maintenance-work-orders/postgres.mjs";
import {
  validateInfrastructureIssueInput,
  validateInfrastructureSnapshotInput,
  validateInfrastructureMaintenanceProgramInput,
} from "./core.mjs";

const { Pool } = pg;
let pool;

function databaseUrl() {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) {
    throw new Error("DATABASE_URL is required for infrastructure maintenance.");
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

export async function closeInfrastructureMaintenancePoolForTests() {
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

async function assertAnyUpkeepPermission(userId, campgroundId) {
  const allowed = await Promise.all(
    [
      "maintenance.read",
      "maintenance.create",
      "maintenance.assign",
      "maintenance.complete",
      "maintenance.schedule",
    ].map((permission) =>
      hasCampgroundPermission(userId, campgroundId, permission),
    ),
  );
  if (!allowed.some(Boolean)) {
    throw new Error("Not authorized to read infrastructure maintenance.");
  }
}

async function assertSnapshotPermission(userId, campgroundId) {
  const createAllowed = await hasCampgroundPermission(
    userId,
    campgroundId,
    "maintenance.create",
  );
  if (createAllowed) return "maintenance.create";

  const completeAllowed = await hasCampgroundPermission(
    userId,
    campgroundId,
    "maintenance.complete",
  );
  if (completeAllowed) return "maintenance.complete";

  throw new Error(
    "Not authorized to record infrastructure maintenance status.",
  );
}

async function campgroundScope(client, campgroundId) {
  const result = await client.query(
    `select organization_id,id,name,timezone
     from public.campgrounds
     where id=$1 and lifecycle_state <> 'archived'
     limit 1`,
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

function mapProgram(row) {
  return {
    id: row.id,
    assetId: row.asset_id,
    assetName: row.asset_name,
    facilityType: row.facility_type,
    profileKind: row.profile_kind,
    operatingState: row.operating_state,
    inspectionTemplateId: row.inspection_template_id,
    inspectionTemplateName: row.inspection_template_name,
    inspectionVersionNumber: Number(row.inspection_version_number),
    inspectionSignoffRequired: row.inspection_signoff_required === true,
    maintenanceScheduleId: row.maintenance_schedule_id,
    maintenanceScheduleTitle: row.maintenance_schedule_title,
    recurrenceKind: row.recurrence_kind,
    nextOccurrenceAt: row.next_occurrence_at,
    scheduleActive: row.schedule_active === true,
    notes: row.notes ?? null,
    isActive: row.is_active === true,
    rowVersion: Number(row.row_version),
  };
}

export async function getInfrastructureMaintenanceWorkspace(
  userId,
  campgroundId,
) {
  await assertAnyUpkeepPermission(userId, campgroundId);
  const client = await getPool().connect();

  try {
    await client.query("begin");
    const campground = await campgroundScope(client, campgroundId);

    const [
      facilityResult,
      templateResult,
      scheduleResult,
      categoryResult,
      priorityResult,
      programResult,
      inspectionResult,
      snapshotResult,
      issueResult,
    ] = await Promise.all([
      client.query(
        `select
           a.id,
           a.display_name,
           a.operating_state,
           a.row_version,
           f.facility_type
         from public.operational_assets a
         join public.operational_facilities f
           on f.asset_id=a.id
          and f.organization_id=a.organization_id
          and f.campground_id=a.campground_id
         where a.campground_id=$1
           and a.lifecycle_state <> 'archived'
           and f.facility_type in ('road','parking','utility','garbage_area','septic_area')
         order by
           case f.facility_type when 'road' then 1 when 'parking' then 2 when 'utility' then 3 when 'garbage_area' then 4 when 'septic_area' then 5 else 6 end,
           a.display_name`,
        [campgroundId],
      ),
      client.query(
        `select
           t.id,
           t.asset_id,
           t.name,
           t.is_active,
           v.version_number,
           v.signoff_required
         from public.inspection_templates t
         join public.inspection_template_versions v
           on v.id=t.current_version_id
         where t.campground_id=$1
           and t.target_kind='asset'
           and t.current_version_id is not null
           and v.published_at is not null
         order by t.name`,
        [campgroundId],
      ),
      client.query(
        `select
           s.id,
           s.asset_id,
           s.title,
           s.recurrence_kind,
           s.next_occurrence_at,
           s.is_active
         from public.maintenance_schedules s
         where s.campground_id=$1
           and s.asset_id is not null
         order by s.is_active desc,s.next_occurrence_at,s.title`,
        [campgroundId],
      ),
      client.query(
        `select id,category_code,display_name
         from public.maintenance_categories
         where campground_id=$1 and is_active
         order by display_name`,
        [campgroundId],
      ),
      client.query(
        `select id,priority_key,target_response_minutes,target_completion_minutes
         from public.maintenance_priority_policies
         where campground_id=$1
         order by
           case priority_key
             when 'emergency' then 1
             when 'urgent' then 2
             when 'normal' then 3
             when 'preventive' then 4
             else 5
           end`,
        [campgroundId],
      ),
      client.query(
        `select
           p.*,
           a.display_name as asset_name,
           a.operating_state,
           f.facility_type,
           t.name as inspection_template_name,
           v.version_number as inspection_version_number,
           v.signoff_required as inspection_signoff_required,
           s.title as maintenance_schedule_title,
           s.recurrence_kind,
           s.next_occurrence_at,
           s.is_active as schedule_active
         from public.infrastructure_maintenance_programs p
         join public.operational_assets a on a.id=p.asset_id
         join public.operational_facilities f on f.asset_id=p.asset_id
         join public.inspection_templates t on t.id=p.inspection_template_id
         join public.inspection_template_versions v on v.id=t.current_version_id
         join public.maintenance_schedules s on s.id=p.maintenance_schedule_id
         where p.campground_id=$1
         order by p.is_active desc,p.profile_kind,a.display_name`,
        [campgroundId],
      ),
      client.query(
        `select
           e.*,
           a.display_name as asset_name,
           o.status as inspection_status,
           o.started_at,
           o.submitted_at,
           o.finalized_at,
           t.name as inspection_template_name,
           v.version_number,
           so.scheduled_for,
           wo.status as work_order_status
         from public.infrastructure_maintenance_inspection_evidence e
         join public.operational_assets a on a.id=e.asset_id
         join public.inspection_occurrences o on o.id=e.inspection_occurrence_id
         join public.inspection_templates t on t.id=o.template_id
         join public.inspection_template_versions v on v.id=o.template_version_id
         left join public.maintenance_schedule_occurrences so
           on so.id=e.maintenance_schedule_occurrence_id
         left join public.maintenance_work_orders wo on wo.id=e.work_order_id
         where e.campground_id=$1
         order by e.created_at desc
         limit 150`,
        [campgroundId],
      ),
      client.query(
        `select
           s.*,
           a.display_name as asset_name,
           p.profile_kind,
           so.scheduled_for,
           wo.status as work_order_status
         from public.infrastructure_maintenance_snapshots s
         join public.infrastructure_maintenance_programs p on p.id=s.program_id
         join public.operational_assets a on a.id=s.asset_id
         left join public.maintenance_schedule_occurrences so
           on so.id=s.maintenance_schedule_occurrence_id
         left join public.maintenance_work_orders wo on wo.id=s.work_order_id
         where s.campground_id=$1
         order by s.recorded_at desc
         limit 200`,
        [campgroundId],
      ),
      client.query(
        `select
           i.*,
           a.display_name as asset_name,
           p.profile_kind,
           wo.title as work_order_title,
           wo.status as work_order_status,
           pp.priority_key
         from public.infrastructure_maintenance_issue_links i
         join public.infrastructure_maintenance_programs p on p.id=i.program_id
         join public.operational_assets a on a.id=i.asset_id
         join public.maintenance_work_orders wo on wo.id=i.work_order_id
         join public.maintenance_priority_policies pp
           on pp.id=wo.priority_policy_id
         where i.campground_id=$1
         order by
           case wo.status
             when 'in_progress' then 1
             when 'assigned' then 2
             when 'blocked' then 3
             when 'open' then 4
             else 5
           end,
           i.created_at desc
         limit 200`,
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
      generatedAt: new Date().toISOString(),
      facilities: facilityResult.rows.map((row) => ({
        id: row.id,
        name: row.display_name,
        facilityType: row.facility_type,
        operatingState: row.operating_state,
        rowVersion: Number(row.row_version),
      })),
      templates: templateResult.rows.map((row) => ({
        id: row.id,
        assetId: row.asset_id,
        name: row.name,
        isActive: row.is_active === true,
        versionNumber: Number(row.version_number),
        signoffRequired: row.signoff_required === true,
      })),
      schedules: scheduleResult.rows.map((row) => ({
        id: row.id,
        assetId: row.asset_id,
        title: row.title,
        recurrenceKind: row.recurrence_kind,
        nextOccurrenceAt: row.next_occurrence_at,
        isActive: row.is_active === true,
      })),
      categories: categoryResult.rows.map((row) => ({
        id: row.id,
        code: row.category_code,
        name: row.display_name,
      })),
      priorities: priorityResult.rows.map((row) => ({
        id: row.id,
        priorityKey: row.priority_key,
        targetResponseMinutes: Number(row.target_response_minutes),
        targetCompletionMinutes: Number(row.target_completion_minutes),
      })),
      programs: programResult.rows.map(mapProgram),
      inspections: inspectionResult.rows.map((row) => ({
        id: row.id,
        programId: row.program_id,
        assetId: row.asset_id,
        assetName: row.asset_name,
        inspectionOccurrenceId: row.inspection_occurrence_id,
        inspectionStatus: row.inspection_status,
        inspectionTemplateName: row.inspection_template_name,
        versionNumber: Number(row.version_number),
        startedAt: row.started_at,
        submittedAt: row.submitted_at ?? null,
        finalizedAt: row.finalized_at ?? null,
        scheduledFor: row.scheduled_for ?? null,
        workOrderId: row.work_order_id ?? null,
        workOrderStatus: row.work_order_status ?? null,
      })),
      snapshots: snapshotResult.rows.map((row) => ({
        id: row.id,
        programId: row.program_id,
        assetId: row.asset_id,
        assetName: row.asset_name,
        profileKind: row.profile_kind,
        surfaceState: row.surface_state,
        safetyState: row.safety_state,
        serviceState: row.service_state,
        notes: row.notes ?? null,
        scheduledFor: row.scheduled_for ?? null,
        workOrderId: row.work_order_id ?? null,
        workOrderStatus: row.work_order_status ?? null,
        recordedByUserId: row.recorded_by_user_id,
        recordedAt: row.recorded_at,
      })),
      issues: issueResult.rows.map((row) => ({
        id: row.id,
        programId: row.program_id,
        assetId: row.asset_id,
        assetName: row.asset_name,
        profileKind: row.profile_kind,
        issueKind: row.issue_kind,
        workOrderId: row.work_order_id,
        workOrderTitle: row.work_order_title,
        workOrderStatus: row.work_order_status,
        priorityKey: row.priority_key,
        createdAt: row.created_at,
        resolved: ["completed", "cancelled"].includes(row.work_order_status),
      })),
    };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function validateProgramDependencies(client, campgroundId, program) {
  const facility = await client.query(
    `select a.id,a.organization_id,f.facility_type
     from public.operational_assets a
     join public.operational_facilities f
       on f.asset_id=a.id
      and f.organization_id=a.organization_id
      and f.campground_id=a.campground_id
     where a.id=$1
       and a.campground_id=$2
       and a.lifecycle_state <> 'archived'
       and f.facility_type in ('road','parking','utility','garbage_area','septic_area')
     limit 1`,
    [program.assetId, campgroundId],
  );
  if (facility.rowCount !== 1) {
    throw new Error(
      "Road, parking, utility, garbage/recycling or septic facility is unavailable.",
    );
  }
  const facilityType = facility.rows[0].facility_type;
  const validProfile = program.profileKind === facilityType;
  if (!validProfile) {
    throw new Error(
      "Infrastructure profile must exactly match the canonical facility type.",
    );
  }

  const template = await client.query(
    `select t.id,t.is_active,v.signoff_required,v.published_at
     from public.inspection_templates t
     join public.inspection_template_versions v
       on v.id=t.current_version_id
     where t.id=$1
       and t.campground_id=$2
       and t.target_kind='asset'
       and t.asset_id=$3
     limit 1`,
    [program.inspectionTemplateId, campgroundId, program.assetId],
  );
  if (template.rowCount !== 1 || template.rows[0].published_at == null) {
    throw new Error(
      "Infrastructure maintenance requires a published inspection template for the same facility.",
    );
  }

  const schedule = await client.query(
    `select id,is_active
     from public.maintenance_schedules
     where id=$1
       and campground_id=$2
       and asset_id=$3
     limit 1`,
    [program.maintenanceScheduleId, campgroundId, program.assetId],
  );
  if (schedule.rowCount !== 1) {
    throw new Error(
      "Infrastructure maintenance requires a recurring maintenance schedule for the same facility.",
    );
  }

  if (
    program.isActive &&
    (template.rows[0].is_active !== true || schedule.rows[0].is_active !== true)
  ) {
    throw new Error(
      "Active infrastructure maintenance requires active inspection template and recurring schedule.",
    );
  }

  return facility.rows[0];
}

export async function configureInfrastructureMaintenanceProgram({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  expectedRowVersion = null,
  ...input
}) {
  await assertPermission(actorUserId, campgroundId, "maintenance.schedule");
  const program = validateInfrastructureMaintenanceProgramInput(input);
  const client = await getPool().connect();

  try {
    await client.query("begin");
    const campground = await campgroundScope(client, campgroundId);
    await validateProgramDependencies(client, campgroundId, program);
    await beginRls(client, actorUserId);

    const existing = await client.query(
      `select *
       from public.infrastructure_maintenance_programs
       where asset_id=$1 and campground_id=$2
       limit 1
       for update`,
      [program.assetId, campgroundId],
    );

    let saved;
    let actionKey;
    let beforeState = null;

    if (existing.rowCount === 0) {
      const inserted = await client.query(
        `insert into public.infrastructure_maintenance_programs (
           organization_id,campground_id,asset_id,profile_kind,
           inspection_template_id,maintenance_schedule_id,notes,is_active,
           created_by_user_id,updated_by_user_id
         )
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9)
         returning *`,
        [
          campground.organization_id,
          campgroundId,
          program.assetId,
          program.profileKind,
          program.inspectionTemplateId,
          program.maintenanceScheduleId,
          program.notes,
          program.isActive,
          actorUserId,
        ],
      );
      saved = inserted.rows[0];
      actionKey = "infrastructure_maintenance.program.create";
    } else {
      const current = existing.rows[0];
      const expected = Number(expectedRowVersion);
      if (!Number.isInteger(expected) || expected < 1) {
        throw new Error(
          "Infrastructure maintenance program row version is required when updating.",
        );
      }
      beforeState = {
        profileKind: current.profile_kind,
        inspectionTemplateId: current.inspection_template_id,
        maintenanceScheduleId: current.maintenance_schedule_id,
        active: current.is_active,
      };
      const updated = await client.query(
        `update public.infrastructure_maintenance_programs
         set
           profile_kind=$4,
           inspection_template_id=$5,
           maintenance_schedule_id=$6,
           notes=$7,
           is_active=$8,
           updated_by_user_id=$9
         where asset_id=$1
           and campground_id=$2
           and row_version=$3
         returning *`,
        [
          program.assetId,
          campgroundId,
          expected,
          program.profileKind,
          program.inspectionTemplateId,
          program.maintenanceScheduleId,
          program.notes,
          program.isActive,
          actorUserId,
        ],
      );
      if (updated.rowCount !== 1) {
        throw new Error(
          "Infrastructure maintenance program changed since this page loaded. Refresh and try again.",
        );
      }
      saved = updated.rows[0];
      actionKey = "infrastructure_maintenance.program.update";
    }

    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: campground.organization_id,
      campgroundId,
      actionKey,
      permissionKey: "maintenance.schedule",
      riskLevel: "elevated",
      subjectType: "infrastructure.maintenance.program",
      subjectId: saved.id,
      beforeState,
      afterState: {
        assetId: saved.asset_id,
        profileKind: saved.profile_kind,
        inspectionTemplateId: saved.inspection_template_id,
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

async function latestUnlinkedInspectionDue(client, program) {
  const result = await client.query(
    `select so.id as schedule_occurrence_id,so.work_order_id
     from public.maintenance_schedule_occurrences so
     join public.maintenance_work_orders wo on wo.id=so.work_order_id
     left join public.infrastructure_maintenance_inspection_evidence e
       on e.maintenance_schedule_occurrence_id=so.id
     where so.schedule_id=$1
       and so.state='materialized'
       and wo.status not in ('completed','cancelled')
       and e.id is null
     order by so.scheduled_for desc
     limit 1`,
    [program.maintenance_schedule_id],
  );
  return result.rows[0] ?? null;
}

async function latestActiveScheduleDue(client, program) {
  const result = await client.query(
    `select so.id as schedule_occurrence_id,so.work_order_id
     from public.maintenance_schedule_occurrences so
     join public.maintenance_work_orders wo on wo.id=so.work_order_id
     where so.schedule_id=$1
       and so.state='materialized'
       and wo.status not in ('completed','cancelled')
     order by so.scheduled_for desc
     limit 1`,
    [program.maintenance_schedule_id],
  );
  return result.rows[0] ?? null;
}

export async function startInfrastructureMaintenanceInspection({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  programId,
}) {
  await assertAnyUpkeepPermission(actorUserId, campgroundId);
  await assertPermission(actorUserId, campgroundId, "inspection.perform");
  const client = await getPool().connect();

  try {
    await client.query("begin");
    const campground = await campgroundScope(client, campgroundId);

    const programResult = await client.query(
      `select
         p.*,
         t.current_version_id,
         t.is_active as template_active,
         v.signoff_required,
         v.published_at
       from public.infrastructure_maintenance_programs p
       join public.inspection_templates t on t.id=p.inspection_template_id
       join public.inspection_template_versions v on v.id=t.current_version_id
       where p.id=$1
         and p.campground_id=$2
         and p.is_active
       limit 1`,
      [programId, campgroundId],
    );
    if (programResult.rowCount !== 1) {
      throw new Error(
        "Active infrastructure maintenance program is unavailable.",
      );
    }
    const program = programResult.rows[0];
    if (program.template_active !== true || program.published_at == null) {
      throw new Error(
        "Infrastructure inspection template is not active and published.",
      );
    }

    const activeInspection = await client.query(
      `select o.id
       from public.infrastructure_maintenance_inspection_evidence e
       join public.inspection_occurrences o
         on o.id=e.inspection_occurrence_id
       where e.program_id=$1
         and o.status in ('in_progress','submitted')
       order by o.started_at desc
       limit 1`,
      [programId],
    );
    if (activeInspection.rowCount > 0) {
      throw new Error(
        "This facility already has an inspection in progress or awaiting sign-off.",
      );
    }

    const due = await latestUnlinkedInspectionDue(client, program);

    await beginRls(client, actorUserId);
    const occurrence = await client.query(
      `insert into public.inspection_occurrences (
         organization_id,campground_id,template_id,template_version_id,
         target_kind,asset_id,accommodation_id,inspector_user_id,
         signoff_required
       )
       values ($1,$2,$3,$4,'asset',$5,null,$6,$7)
       returning id`,
      [
        campground.organization_id,
        campgroundId,
        program.inspection_template_id,
        program.current_version_id,
        program.asset_id,
        actorUserId,
        program.signoff_required === true,
      ],
    );
    const inspectionOccurrenceId = occurrence.rows[0].id;

    await client.query(
      `insert into public.infrastructure_maintenance_inspection_evidence (
         organization_id,campground_id,program_id,asset_id,
         inspection_occurrence_id,maintenance_schedule_occurrence_id,
         work_order_id,created_by_user_id
       )
       values ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        campground.organization_id,
        campgroundId,
        program.id,
        program.asset_id,
        inspectionOccurrenceId,
        due?.schedule_occurrence_id ?? null,
        due?.work_order_id ?? null,
        actorUserId,
      ],
    );

    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: campground.organization_id,
      campgroundId,
      actionKey: "inspection.occurrence.start",
      permissionKey: "inspection.perform",
      riskLevel: "standard",
      subjectType: "inspection.occurrence",
      subjectId: inspectionOccurrenceId,
      metadata: {
        templateId: program.inspection_template_id,
        templateVersionId: program.current_version_id,
        source: "infrastructure_maintenance",
      },
    });
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: campground.organization_id,
      campgroundId,
      actionKey: "infrastructure_maintenance.inspection.start",
      permissionKey: "inspection.perform",
      riskLevel: "standard",
      subjectType: "inspection.occurrence",
      subjectId: inspectionOccurrenceId,
      metadata: {
        programId,
        assetId: program.asset_id,
        maintenanceScheduleOccurrenceId: due?.schedule_occurrence_id ?? null,
        workOrderId: due?.work_order_id ?? null,
      },
    });

    await client.query("commit");
    return inspectionOccurrenceId;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function recordInfrastructureMaintenanceSnapshot({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  programId,
  ...input
}) {
  const snapshotPermission = await assertSnapshotPermission(
    actorUserId,
    campgroundId,
  );
  const snapshot = validateInfrastructureSnapshotInput(input);
  const client = await getPool().connect();

  try {
    await client.query("begin");
    const campground = await campgroundScope(client, campgroundId);
    const programResult = await client.query(
      `select *
       from public.infrastructure_maintenance_programs
       where id=$1 and campground_id=$2 and is_active
       limit 1`,
      [programId, campgroundId],
    );
    if (programResult.rowCount !== 1) {
      throw new Error(
        "Active infrastructure maintenance program is unavailable.",
      );
    }
    const program = programResult.rows[0];
    const due = await latestActiveScheduleDue(client, program);

    await beginRls(client, actorUserId);
    const inserted = await client.query(
      `insert into public.infrastructure_maintenance_snapshots (
         organization_id,campground_id,program_id,asset_id,
         maintenance_schedule_occurrence_id,work_order_id,
         surface_state,safety_state,service_state,notes,
         recorded_by_user_id
       )
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       returning id,recorded_at`,
      [
        campground.organization_id,
        campgroundId,
        program.id,
        program.asset_id,
        due?.schedule_occurrence_id ?? null,
        due?.work_order_id ?? null,
        snapshot.surfaceState,
        snapshot.safetyState,
        snapshot.serviceState,
        snapshot.notes,
        actorUserId,
      ],
    );

    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: campground.organization_id,
      campgroundId,
      actionKey: "infrastructure_maintenance.snapshot.record",
      permissionKey: snapshotPermission,
      riskLevel: "standard",
      subjectType: "infrastructure.maintenance.snapshot",
      subjectId: inserted.rows[0].id,
      afterState: {
        programId,
        assetId: program.asset_id,
        surfaceState: snapshot.surfaceState,
        safetyState: snapshot.safetyState,
        serviceState: snapshot.serviceState,
        maintenanceScheduleOccurrenceId: due?.schedule_occurrence_id ?? null,
        workOrderId: due?.work_order_id ?? null,
      },
    });

    await client.query("commit");
    return inserted.rows[0].id;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function reportInfrastructureMaintenanceIssue({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  programId,
  ...input
}) {
  await assertPermission(actorUserId, campgroundId, "maintenance.create");
  const issue = validateInfrastructureIssueInput(input);
  const client = await getPool().connect();

  let campground;
  let program;
  try {
    campground = await campgroundScope(client, campgroundId);
    const programResult = await client.query(
      `select *
       from public.infrastructure_maintenance_programs
       where id=$1 and campground_id=$2 and is_active
       limit 1`,
      [programId, campgroundId],
    );
    if (programResult.rowCount !== 1) {
      throw new Error(
        "Active infrastructure maintenance program is unavailable.",
      );
    }
    program = programResult.rows[0];
  } finally {
    client.release();
  }

  const workOrderId = await createMaintenanceWorkOrder({
    actorUserId,
    actorSessionId,
    campgroundId,
    title: issue.title,
    description: issue.description,
    categoryId: issue.categoryId,
    priorityPolicyId: issue.priorityPolicyId,
    assetId: program.asset_id,
  });

  const linkClient = await getPool().connect();
  try {
    await linkClient.query("begin");
    await beginRls(linkClient, actorUserId);
    const inserted = await linkClient.query(
      `insert into public.infrastructure_maintenance_issue_links (
         organization_id,campground_id,program_id,asset_id,
         work_order_id,issue_kind,created_by_user_id
       )
       values ($1,$2,$3,$4,$5,$6,$7)
       returning id`,
      [
        campground.organization_id,
        campgroundId,
        program.id,
        program.asset_id,
        workOrderId,
        issue.issueKind,
        actorUserId,
      ],
    );

    await linkClient.query("reset role");
    await appendAuditEvent(linkClient, {
      actorUserId,
      actorSessionId,
      organizationId: campground.organization_id,
      campgroundId,
      actionKey: "infrastructure_maintenance.issue.link",
      permissionKey: "maintenance.create",
      riskLevel: "standard",
      subjectType: "maintenance.work_order",
      subjectId: workOrderId,
      metadata: {
        infrastructureMaintenanceIssueId: inserted.rows[0].id,
        programId,
        assetId: program.asset_id,
        issueKind: issue.issueKind,
      },
    });

    await linkClient.query("commit");
    return workOrderId;
  } catch (error) {
    await linkClient.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    linkClient.release();
  }
}
