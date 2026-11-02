import pg from "pg";

import { appendAuditEvent } from "../audit/postgres.mjs";
import { hasCampgroundPermission } from "../authz/postgres.mjs";
import {
  aquaticPublicStateFromOperational,
  validateAquaticDecisionInput,
  validateAquaticProgramInput,
} from "./core.mjs";

const { Pool } = pg;
let pool;

function databaseUrl() {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) {
    throw new Error("DATABASE_URL is required for aquatic operations.");
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

export async function closeAquaticsPoolForTests() {
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

async function assertAnyAquaticPermission(userId, campgroundId) {
  const allowed = await Promise.all(
    ["aquatics.read", "aquatics.manage", "aquatics.reopen"].map((permission) =>
      hasCampgroundPermission(userId, campgroundId, permission),
    ),
  );
  if (!allowed.some(Boolean)) {
    throw new Error("Not authorized to read pool/water-park operations.");
  }
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
    operatingState: row.operating_state,
    publicState: aquaticPublicStateFromOperational(row.operating_state),
    assetRowVersion: Number(row.asset_row_version),
    inspectionTemplateId: row.inspection_template_id,
    inspectionTemplateName: row.inspection_template_name,
    inspectionVersionNumber: Number(row.inspection_version_number),
    maintenanceScheduleId: row.maintenance_schedule_id,
    maintenanceScheduleTitle: row.maintenance_schedule_title,
    recurrenceKind: row.recurrence_kind,
    nextOccurrenceAt: row.next_occurrence_at,
    scheduleActive: row.schedule_active === true,
    reopenInspectionMaxAgeMinutes: Number(
      row.reopen_inspection_max_age_minutes,
    ),
    notes: row.notes ?? null,
    isActive: row.is_active === true,
    rowVersion: Number(row.row_version),
  };
}

export async function getAquaticsWorkspace(userId, campgroundId) {
  await assertAnyAquaticPermission(userId, campgroundId);
  const client = await getPool().connect();

  try {
    await client.query("begin");
    const campground = await campgroundScope(client, campgroundId);

    const [facilityResult, templateResult, scheduleResult] = await Promise.all([
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
           and f.facility_type in ('pool','water_park')
         order by f.facility_type,a.display_name`,
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
    ]);

    // Cross-domain display joins are read through the trusted server connection
    // after the explicit campground-scoped aquatics permission check above.
    // Build 069 tables still FORCE RLS for direct application-role access.
    const [programResult, evidenceResult, decisionResult] = await Promise.all([
      client.query(
        `select
           p.*,
           a.display_name as asset_name,
           a.operating_state,
           a.row_version as asset_row_version,
           f.facility_type,
           t.name as inspection_template_name,
           v.version_number as inspection_version_number,
           s.title as maintenance_schedule_title,
           s.recurrence_kind,
           s.next_occurrence_at,
           s.is_active as schedule_active
         from public.aquatic_facility_programs p
         join public.operational_assets a on a.id=p.asset_id
         join public.operational_facilities f on f.asset_id=p.asset_id
         join public.inspection_templates t on t.id=p.inspection_template_id
         join public.inspection_template_versions v on v.id=t.current_version_id
         join public.maintenance_schedules s on s.id=p.maintenance_schedule_id
         where p.campground_id=$1
         order by p.is_active desc,f.facility_type,a.display_name`,
        [campgroundId],
      ),
      client.query(
        `select
           e.*,
           o.status as inspection_status,
           o.started_at,
           o.submitted_at,
           o.finalized_at,
           t.name as inspection_template_name,
           v.version_number,
           so.scheduled_for,
           wo.status as work_order_status,
           wo.title as work_order_title,
           a.display_name as asset_name
         from public.aquatic_inspection_evidence e
         join public.inspection_occurrences o
           on o.id=e.inspection_occurrence_id
         join public.inspection_templates t on t.id=o.template_id
         join public.inspection_template_versions v
           on v.id=o.template_version_id
         join public.operational_assets a on a.id=e.asset_id
         left join public.maintenance_schedule_occurrences so
           on so.id=e.maintenance_schedule_occurrence_id
         left join public.maintenance_work_orders wo
           on wo.id=e.work_order_id
         where e.campground_id=$1
         order by e.created_at desc
         limit 150`,
        [campgroundId],
      ),
      client.query(
        `select
           d.*,
           a.display_name as asset_name,
           o.finalized_at as inspection_finalized_at
         from public.aquatic_operation_decisions d
         join public.operational_assets a on a.id=d.asset_id
         left join public.inspection_occurrences o
           on o.id=d.signed_inspection_occurrence_id
         where d.campground_id=$1
         order by d.decided_at desc
         limit 150`,
        [campgroundId],
      ),
    ]);
    await client.query("commit");

    const programs = programResult.rows.map(mapProgram);

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
        publicState: aquaticPublicStateFromOperational(row.operating_state),
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
      programs,
      evidence: evidenceResult.rows.map((row) => ({
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
        maintenanceScheduleOccurrenceId:
          row.maintenance_schedule_occurrence_id ?? null,
        scheduledFor: row.scheduled_for ?? null,
        workOrderId: row.work_order_id ?? null,
        workOrderStatus: row.work_order_status ?? null,
        workOrderTitle: row.work_order_title ?? null,
        createdAt: row.created_at,
      })),
      decisions: decisionResult.rows.map((row) => ({
        id: row.id,
        programId: row.program_id,
        assetId: row.asset_id,
        assetName: row.asset_name,
        decisionKey: row.decision_key,
        fromState: row.from_state,
        toState: row.to_state,
        publicState: aquaticPublicStateFromOperational(row.to_state),
        statusRevision: Number(row.status_revision),
        reason: row.reason,
        signedInspectionOccurrenceId:
          row.signed_inspection_occurrence_id ?? null,
        inspectionFinalizedAt: row.inspection_finalized_at ?? null,
        decidedByUserId: row.decided_by_user_id,
        decidedAt: row.decided_at,
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
    `select
       a.id,
       a.organization_id,
       f.facility_type
     from public.operational_assets a
     join public.operational_facilities f
       on f.asset_id=a.id
      and f.organization_id=a.organization_id
      and f.campground_id=a.campground_id
     where a.id=$1
       and a.campground_id=$2
       and a.lifecycle_state <> 'archived'
       and f.facility_type in ('pool','water_park')
     limit 1`,
    [program.assetId, campgroundId],
  );
  if (facility.rowCount !== 1) {
    throw new Error("Pool/water-park facility is unavailable.");
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
  if (
    template.rowCount !== 1 ||
    template.rows[0].published_at == null ||
    template.rows[0].signoff_required !== true
  ) {
    throw new Error(
      "Aquatic program requires a published independent-signoff inspection template for the same facility.",
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
      "Aquatic program requires a recurring maintenance schedule for the same facility.",
    );
  }
  if (
    program.isActive &&
    (template.rows[0].is_active !== true || schedule.rows[0].is_active !== true)
  ) {
    throw new Error(
      "Active aquatic programs require active inspection templates and recurring schedules.",
    );
  }

  return facility.rows[0];
}

export async function configureAquaticProgram({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  expectedRowVersion = null,
  ...input
}) {
  await assertPermission(actorUserId, campgroundId, "aquatics.manage");
  const program = validateAquaticProgramInput(input);
  const client = await getPool().connect();

  try {
    await client.query("begin");
    const campground = await campgroundScope(client, campgroundId);
    await validateProgramDependencies(client, campgroundId, program);
    await beginRls(client, actorUserId);

    const existing = await client.query(
      `select *
       from public.aquatic_facility_programs
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
        `insert into public.aquatic_facility_programs (
           organization_id,campground_id,asset_id,inspection_template_id,
           maintenance_schedule_id,reopen_inspection_max_age_minutes,notes,
           is_active,created_by_user_id,updated_by_user_id
         )
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9)
         returning *`,
        [
          campground.organization_id,
          campgroundId,
          program.assetId,
          program.inspectionTemplateId,
          program.maintenanceScheduleId,
          program.reopenInspectionMaxAgeMinutes,
          program.notes,
          program.isActive,
          actorUserId,
        ],
      );
      saved = inserted.rows[0];
      actionKey = "aquatics.program.create";
    } else {
      const current = existing.rows[0];
      const expected = Number(expectedRowVersion);
      if (!Number.isInteger(expected) || expected < 1) {
        throw new Error(
          "Aquatic program row version is required when updating.",
        );
      }
      beforeState = {
        inspectionTemplateId: current.inspection_template_id,
        maintenanceScheduleId: current.maintenance_schedule_id,
        reopenInspectionMaxAgeMinutes: Number(
          current.reopen_inspection_max_age_minutes,
        ),
        active: current.is_active,
      };
      const updated = await client.query(
        `update public.aquatic_facility_programs
         set
           inspection_template_id=$4,
           maintenance_schedule_id=$5,
           reopen_inspection_max_age_minutes=$6,
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
          program.inspectionTemplateId,
          program.maintenanceScheduleId,
          program.reopenInspectionMaxAgeMinutes,
          program.notes,
          program.isActive,
          actorUserId,
        ],
      );
      if (updated.rowCount !== 1) {
        throw new Error(
          "Aquatic program changed since this page loaded. Refresh and try again.",
        );
      }
      saved = updated.rows[0];
      actionKey = "aquatics.program.update";
    }

    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: campground.organization_id,
      campgroundId,
      actionKey,
      permissionKey: "aquatics.manage",
      riskLevel: "elevated",
      subjectType: "aquatic.facility.program",
      subjectId: saved.id,
      beforeState,
      afterState: {
        assetId: saved.asset_id,
        inspectionTemplateId: saved.inspection_template_id,
        maintenanceScheduleId: saved.maintenance_schedule_id,
        reopenInspectionMaxAgeMinutes: Number(
          saved.reopen_inspection_max_age_minutes,
        ),
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

export async function startAquaticInspection({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  programId,
}) {
  await assertAnyAquaticPermission(actorUserId, campgroundId);
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
       from public.aquatic_facility_programs p
       join public.inspection_templates t on t.id=p.inspection_template_id
       join public.inspection_template_versions v
         on v.id=t.current_version_id
       where p.id=$1
         and p.campground_id=$2
         and p.is_active
       limit 1`,
      [programId, campgroundId],
    );
    if (programResult.rowCount !== 1) {
      throw new Error("Active aquatic operating program is unavailable.");
    }
    const program = programResult.rows[0];
    if (
      program.template_active !== true ||
      program.signoff_required !== true ||
      program.published_at == null
    ) {
      throw new Error(
        "Aquatic inspection template is not active, published and sign-off protected.",
      );
    }

    const activeInspection = await client.query(
      `select o.id
       from public.aquatic_inspection_evidence e
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
        "This aquatic program already has an inspection in progress or awaiting sign-off.",
      );
    }

    const dueResult = await client.query(
      `select
         so.id as schedule_occurrence_id,
         so.work_order_id
       from public.maintenance_schedule_occurrences so
       join public.maintenance_work_orders wo on wo.id=so.work_order_id
       left join public.aquatic_inspection_evidence e
         on e.maintenance_schedule_occurrence_id=so.id
       where so.schedule_id=$1
         and so.state='materialized'
         and wo.status not in ('completed','cancelled')
         and e.id is null
       order by so.scheduled_for desc
       limit 1`,
      [program.maintenance_schedule_id],
    );
    const due = dueResult.rows[0] ?? null;

    await beginRls(client, actorUserId);
    const occurrence = await client.query(
      `insert into public.inspection_occurrences (
         organization_id,campground_id,template_id,template_version_id,
         target_kind,asset_id,accommodation_id,inspector_user_id,
         signoff_required
       )
       values ($1,$2,$3,$4,'asset',$5,null,$6,true)
       returning id`,
      [
        campground.organization_id,
        campgroundId,
        program.inspection_template_id,
        program.current_version_id,
        program.asset_id,
        actorUserId,
      ],
    );
    const inspectionOccurrenceId = occurrence.rows[0].id;

    await client.query(
      `insert into public.aquatic_inspection_evidence (
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
        source: "aquatics.operations",
      },
    });
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: campground.organization_id,
      campgroundId,
      actionKey: "aquatics.inspection.start",
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

async function latestSignedAquaticInspection(client, programId) {
  const result = await client.query(
    `select o.id,o.finalized_at
     from public.aquatic_inspection_evidence e
     join public.inspection_occurrences o
       on o.id=e.inspection_occurrence_id
     where e.program_id=$1
       and o.status='signed_off'
       and o.finalized_at is not null
     order by o.finalized_at desc
     limit 1`,
    [programId],
  );
  return result.rows[0] ?? null;
}

async function assertReopenInspectionReady(client, occurrenceId) {
  const unresolved = await client.query(
    `select r.id,i.label,wo.status
     from public.inspection_results r
     join public.inspection_template_items i on i.id=r.template_item_id
     left join public.inspection_corrective_actions ca
       on ca.inspection_result_id=r.id
     left join public.maintenance_work_orders wo
       on wo.id=ca.work_order_id
     where r.occurrence_id=$1
       and r.result_value='fail'
       and (
         ca.id is null
         or wo.id is null
         or wo.status not in ('completed','cancelled')
       )
     order by i.position`,
    [occurrenceId],
  );
  if (unresolved.rowCount > 0) {
    throw new Error(
      "Aquatic reopening is blocked until all failed inspection corrective work is resolved.",
    );
  }
}

export async function transitionAquaticFacility({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  programId,
  expectedAssetRowVersion,
  ...input
}) {
  const decision = validateAquaticDecisionInput(input);
  const permission =
    decision.publicState === "open" ? "aquatics.reopen" : "aquatics.manage";
  await assertPermission(actorUserId, campgroundId, permission);
  await assertPermission(actorUserId, campgroundId, "asset.manage");

  const expected = Number(expectedAssetRowVersion);
  if (!Number.isInteger(expected) || expected < 1) {
    throw new Error("Aquatic facility row version is invalid.");
  }

  const client = await getPool().connect();

  try {
    await client.query("begin");
    const campground = await campgroundScope(client, campgroundId);

    const programResult = await client.query(
      `select *
       from public.aquatic_facility_programs
       where id=$1
         and campground_id=$2
         and is_active
       limit 1`,
      [programId, campgroundId],
    );
    if (programResult.rowCount !== 1) {
      throw new Error("Active aquatic operating program is unavailable.");
    }
    const program = programResult.rows[0];

    let signedInspection = null;
    if (decision.publicState === "open") {
      signedInspection = await latestSignedAquaticInspection(client, programId);
      if (!signedInspection) {
        throw new Error(
          "Aquatic reopening requires a completed independent signed inspection.",
        );
      }
      await assertReopenInspectionReady(client, signedInspection.id);
    }

    await beginRls(client, actorUserId);
    await client.query("select set_config('icamp.status_reason',$1,true)", [
      decision.reason,
    ]);

    const beforeResult = await client.query(
      `select *
       from public.operational_assets
       where id=$1
         and campground_id=$2
       limit 1
       for update`,
      [program.asset_id, campgroundId],
    );
    if (beforeResult.rowCount !== 1) {
      throw new Error("Aquatic facility is unavailable.");
    }
    const before = beforeResult.rows[0];

    if (before.operating_state === decision.operationalState) {
      throw new Error(
        "Aquatic facility is already in the requested operating state.",
      );
    }

    const updated = await client.query(
      `update public.operational_assets
       set operating_state=$3,updated_by_user_id=$4
       where id=$1
         and campground_id=$2
         and row_version=$5
       returning *`,
      [
        program.asset_id,
        campgroundId,
        decision.operationalState,
        actorUserId,
        expected,
      ],
    );
    if (updated.rowCount !== 1) {
      throw new Error(
        "Aquatic facility changed since this page loaded. Refresh and try again.",
      );
    }
    const saved = updated.rows[0];

    const decisionKey =
      decision.publicState === "open"
        ? "reopen"
        : decision.publicState === "limited"
          ? "limit"
          : "close";

    const decisionResult = await client.query(
      `insert into public.aquatic_operation_decisions (
         organization_id,campground_id,program_id,asset_id,decision_key,
         from_state,to_state,status_revision,reason,
         signed_inspection_occurrence_id,decided_by_user_id
       )
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       returning id,decided_at`,
      [
        campground.organization_id,
        campgroundId,
        program.id,
        program.asset_id,
        decisionKey,
        before.operating_state,
        saved.operating_state,
        Number(saved.status_revision),
        decision.reason,
        signedInspection?.id ?? null,
        actorUserId,
      ],
    );

    await client.query("reset role");

    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: campground.organization_id,
      campgroundId,
      actionKey: "operational_asset.status.transition",
      permissionKey: "asset.manage",
      riskLevel: "standard",
      subjectType: "operational_asset",
      subjectId: program.asset_id,
      beforeState: {
        operatingState: before.operating_state,
        statusRevision: Number(before.status_revision),
      },
      afterState: {
        operatingState: saved.operating_state,
        statusRevision: Number(saved.status_revision),
        reason: decision.reason,
        source: "aquatics.operations",
      },
    });

    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: campground.organization_id,
      campgroundId,
      actionKey: `aquatics.operation.${decisionKey}`,
      permissionKey: permission,
      riskLevel: decisionKey === "reopen" ? "high" : "elevated",
      subjectType: "aquatic.facility.program",
      subjectId: program.id,
      beforeState: {
        operatingState: before.operating_state,
      },
      afterState: {
        operatingState: saved.operating_state,
        statusRevision: Number(saved.status_revision),
        decisionId: decisionResult.rows[0].id,
        signedInspectionOccurrenceId: signedInspection?.id ?? null,
        reason: decision.reason,
      },
    });

    await client.query("commit");
    return {
      decisionId: decisionResult.rows[0].id,
      operatingState: saved.operating_state,
      publicState: aquaticPublicStateFromOperational(saved.operating_state),
      rowVersion: Number(saved.row_version),
      statusRevision: Number(saved.status_revision),
    };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
