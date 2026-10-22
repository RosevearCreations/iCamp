import pg from "pg";

import { appendAuditEvent } from "../audit/postgres.mjs";
import { hasCampgroundPermission } from "../authz/postgres.mjs";
import { validateDepartureCleanupProgramInput } from "./core.mjs";

const { Pool } = pg;
let pool;

function databaseUrl() {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) {
    throw new Error("DATABASE_URL is required for departure campsite cleanup.");
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

export async function closeCampsiteDepartureCleanupPoolForTests() {
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
    "maintenance.read",
    "maintenance.create",
    "maintenance.complete",
    "maintenance.schedule",
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
    throw new Error("Not authorized to read departure campsite cleanup.");
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

function iso(value) {
  return value == null ? null : new Date(value).toISOString();
}

export async function getCampsiteDepartureCleanupWorkspace(
  userId,
  campgroundId,
) {
  await assertAnyReadPermission(userId, campgroundId);
  const client = await getPool().connect();

  try {
    await client.query("begin");
    const campground = await campgroundScope(client, campgroundId);

    const [campsiteResult, templateResult] = await Promise.all([
      client.query(
        `select
           a.id,
           a.code,
           a.display_name,
           a.status_state,
           a.row_version,
           cs.campsite_type
         from public.accommodations a
         join public.campsites cs
           on cs.accommodation_id=a.id
          and cs.organization_id=a.organization_id
          and cs.campground_id=a.campground_id
         where a.campground_id=$1
           and a.lifecycle_state <> 'archived'
           and a.accommodation_kind='campsite'
         order by a.code,a.display_name`,
        [campgroundId],
      ),
      client.query(
        `select
           t.id,
           t.accommodation_id,
           t.name,
           t.is_active,
           v.version_number,
           v.signoff_required
         from public.inspection_templates t
         join public.inspection_template_versions v
           on v.id=t.current_version_id
         where t.campground_id=$1
           and t.target_kind='site'
           and t.current_version_id is not null
           and v.published_at is not null
         order by t.is_active desc,t.name`,
        [campgroundId],
      ),
    ]);

    await beginRls(client, userId);

    const [programResult, taskResult] = await Promise.all([
      client.query(
        `select
           p.*,
           a.code as campsite_code,
           a.display_name as campsite_name,
           t.name as inspection_template_name,
           v.version_number as inspection_version_number,
           v.signoff_required as inspection_signoff_required
         from public.campsite_departure_cleanup_programs p
         join public.accommodations a on a.id=p.accommodation_id
         join public.inspection_templates t on t.id=p.inspection_template_id
         join public.inspection_template_versions v on v.id=t.current_version_id
         where p.campground_id=$1
         order by p.is_active desc,a.code,a.display_name`,
        [campgroundId],
      ),
      client.query(
        `select
           task.*,
           co.checked_out_at,
           a.code as campsite_code,
           a.display_name as campsite_name,
           a.status_state as accommodation_status_state,
           a.row_version as accommodation_row_version,
           o.status as inspection_status,
           t.name as inspection_template_name,
           v.version_number as inspection_version_number,
           coalesce(ca.corrective_work_orders,0)::integer as corrective_work_orders,
           coalesce(ca.open_corrective_work_orders,0)::integer
             as open_corrective_work_orders
         from public.campsite_departure_cleanup_tasks task
         join public.reservation_check_outs co
           on co.id=task.reservation_check_out_id
         join public.accommodations a on a.id=task.accommodation_id
         left join public.inspection_occurrences o
           on o.id=task.inspection_occurrence_id
         left join public.inspection_templates t on t.id=o.template_id
         left join public.inspection_template_versions v
           on v.id=o.template_version_id
         left join lateral (
           select
             count(*)::integer as corrective_work_orders,
             count(*) filter (
               where wo.status not in ('completed','cancelled')
             )::integer as open_corrective_work_orders
           from public.inspection_results ir
           join public.inspection_corrective_actions action
             on action.inspection_result_id=ir.id
           join public.maintenance_work_orders wo
             on wo.id=action.work_order_id
           where ir.occurrence_id=task.inspection_occurrence_id
         ) ca on true
         where task.campground_id=$1
         order by
           case when task.cleared_at is null then 0 else 1 end,
           task.created_at desc
         limit 250`,
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
      campsites: campsiteResult.rows.map((row) => ({
        id: row.id,
        code: row.code,
        name: row.display_name,
        campsiteType: row.campsite_type,
        statusState: row.status_state,
        rowVersion: Number(row.row_version),
      })),
      templates: templateResult.rows.map((row) => ({
        id: row.id,
        accommodationId: row.accommodation_id,
        name: row.name,
        isActive: row.is_active === true,
        versionNumber: Number(row.version_number),
        signoffRequired: row.signoff_required === true,
      })),
      programs: programResult.rows.map((row) => ({
        id: row.id,
        accommodationId: row.accommodation_id,
        campsiteCode: row.campsite_code,
        campsiteName: row.campsite_name,
        campsiteType: row.campsite_type,
        inspectionTemplateId: row.inspection_template_id,
        inspectionTemplateName: row.inspection_template_name,
        inspectionVersionNumber: Number(row.inspection_version_number),
        inspectionSignoffRequired:
          row.inspection_signoff_required === true,
        blockRebookingUntilClear:
          row.block_rebooking_until_clear === true,
        notes: row.notes ?? null,
        isActive: row.is_active === true,
        rowVersion: Number(row.row_version),
      })),
      tasks: taskResult.rows.map((row) => ({
        id: row.id,
        reservationCheckOutId: row.reservation_check_out_id,
        reservationId: row.reservation_id,
        accommodationId: row.accommodation_id,
        campsiteCode: row.campsite_code,
        campsiteName: row.campsite_name,
        campsiteType: row.campsite_type,
        accommodationStatusState: row.accommodation_status_state,
        accommodationRowVersion: Number(row.accommodation_row_version),
        programId: row.program_id ?? null,
        inspectionOccurrenceId: row.inspection_occurrence_id ?? null,
        inspectionStatus: row.inspection_status ?? null,
        inspectionTemplateName: row.inspection_template_name ?? null,
        inspectionVersionNumber:
          row.inspection_version_number == null
            ? null
            : Number(row.inspection_version_number),
        correctiveWorkOrders: Number(row.corrective_work_orders ?? 0),
        openCorrectiveWorkOrders: Number(
          row.open_corrective_work_orders ?? 0,
        ),
        blockRebookingUntilClear:
          row.block_rebooking_until_clear === true,
        clearedAt: iso(row.cleared_at),
        clearedByUserId: row.cleared_by_user_id ?? null,
        checkedOutAt: iso(row.checked_out_at),
        createdAt: iso(row.created_at),
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

async function validateProgramDependencies(
  client,
  campgroundId,
  program,
) {
  const campsite = await client.query(
    `select a.id,a.organization_id,cs.campsite_type
     from public.accommodations a
     join public.campsites cs
       on cs.accommodation_id=a.id
      and cs.organization_id=a.organization_id
      and cs.campground_id=a.campground_id
     where a.id=$1
       and a.campground_id=$2
       and a.accommodation_kind='campsite'
       and a.lifecycle_state <> 'archived'
     limit 1`,
    [program.accommodationId, campgroundId],
  );
  if (campsite.rowCount !== 1) {
    throw new Error("Campsite is unavailable.");
  }
  if (campsite.rows[0].campsite_type !== program.campsiteType) {
    throw new Error(
      "Departure cleanup campsite type must match the canonical campsite type.",
    );
  }

  const template = await client.query(
    `select t.id,t.is_active,v.published_at
     from public.inspection_templates t
     join public.inspection_template_versions v
       on v.id=t.current_version_id
     where t.id=$1
       and t.campground_id=$2
       and t.target_kind='site'
       and t.accommodation_id=$3
     limit 1`,
    [
      program.inspectionTemplateId,
      campgroundId,
      program.accommodationId,
    ],
  );
  if (
    template.rowCount !== 1 ||
    template.rows[0].published_at == null ||
    (program.isActive && template.rows[0].is_active !== true)
  ) {
    throw new Error(
      "Departure cleanup requires an active published site inspection template for the same campsite.",
    );
  }

  return campsite.rows[0];
}

export async function configureCampsiteDepartureCleanupProgram({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  expectedRowVersion = null,
  ...input
}) {
  await assertPermission(actorUserId, campgroundId, "maintenance.schedule");
  const program = validateDepartureCleanupProgramInput(input);
  const client = await getPool().connect();

  try {
    await client.query("begin");
    const campground = await campgroundScope(client, campgroundId);
    await validateProgramDependencies(client, campgroundId, program);
    await beginRls(client, actorUserId);

    const existing = await client.query(
      `select id,row_version
       from public.campsite_departure_cleanup_programs
       where campground_id=$1 and accommodation_id=$2
       limit 1
       for update`,
      [campgroundId, program.accommodationId],
    );

    let programId;
    let actionKey;

    if (existing.rowCount === 0) {
      const inserted = await client.query(
        `insert into public.campsite_departure_cleanup_programs (
           organization_id,campground_id,accommodation_id,campsite_type,
           inspection_template_id,block_rebooking_until_clear,notes,is_active,
           created_by_user_id,updated_by_user_id
         )
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9)
         returning id`,
        [
          campground.organization_id,
          campgroundId,
          program.accommodationId,
          program.campsiteType,
          program.inspectionTemplateId,
          program.blockRebookingUntilClear,
          program.notes,
          program.isActive,
          actorUserId,
        ],
      );
      programId = inserted.rows[0].id;
      actionKey = "campsite.departure_cleanup.program.create";
    } else {
      const expected = Number(expectedRowVersion);
      if (!Number.isInteger(expected) || expected < 1) {
        throw new Error(
          "Departure cleanup program changed since this page loaded. Refresh and try again.",
        );
      }
      const updated = await client.query(
        `update public.campsite_departure_cleanup_programs
         set campsite_type=$4,
             inspection_template_id=$5,
             block_rebooking_until_clear=$6,
             notes=$7,
             is_active=$8,
             updated_by_user_id=$9
         where id=$1
           and campground_id=$2
           and accommodation_id=$3
           and row_version=$10
         returning id`,
        [
          existing.rows[0].id,
          campgroundId,
          program.accommodationId,
          program.campsiteType,
          program.inspectionTemplateId,
          program.blockRebookingUntilClear,
          program.notes,
          program.isActive,
          actorUserId,
          expected,
        ],
      );
      if (updated.rowCount !== 1) {
        throw new Error(
          "Departure cleanup program changed since this page loaded. Refresh and try again.",
        );
      }
      programId = updated.rows[0].id;
      actionKey = "campsite.departure_cleanup.program.update";
    }

    if (program.isActive) {
      await client.query(
        `update public.campsite_departure_cleanup_tasks
         set program_id=$3,
             block_rebooking_until_clear=$4
         where campground_id=$1
           and accommodation_id=$2
           and cleared_at is null
           and inspection_occurrence_id is null`,
        [
          campgroundId,
          program.accommodationId,
          programId,
          program.blockRebookingUntilClear,
        ],
      );
    }

    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: campground.organization_id,
      campgroundId,
      actionKey,
      permissionKey: "maintenance.schedule",
      riskLevel: "standard",
      subjectType: "campsite.departure_cleanup.program",
      subjectId: programId,
      afterState: {
        accommodationId: program.accommodationId,
        campsiteType: program.campsiteType,
        inspectionTemplateId: program.inspectionTemplateId,
        blockRebookingUntilClear: program.blockRebookingUntilClear,
        isActive: program.isActive,
      },
    });

    await client.query("commit");
    return programId;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function startCampsiteDepartureCleanupInspection({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  taskId,
}) {
  await assertPermission(actorUserId, campgroundId, "inspection.perform");
  const client = await getPool().connect();

  try {
    await client.query("begin");
    const campground = await campgroundScope(client, campgroundId);
    await beginRls(client, actorUserId);
    await client.query(
      "select pg_advisory_xact_lock(hashtextextended($1,0))",
      ["icamp-campsite-departure-cleanup:" + taskId],
    );

    const taskResult = await client.query(
      `select
         task.*,
         p.inspection_template_id,
         p.is_active as program_active,
         t.current_version_id,
         t.is_active as template_active,
         v.signoff_required,
         v.published_at
       from public.campsite_departure_cleanup_tasks task
       left join public.campsite_departure_cleanup_programs p
         on p.id=task.program_id
       left join public.inspection_templates t
         on t.id=p.inspection_template_id
       left join public.inspection_template_versions v
         on v.id=t.current_version_id
       where task.id=$1 and task.campground_id=$2
       limit 1
       for update of task`,
      [taskId, campgroundId],
    );
    if (taskResult.rowCount !== 1) {
      throw new Error("Departure cleanup task is unavailable.");
    }
    const task = taskResult.rows[0];

    if (task.cleared_at) {
      throw new Error("Departure cleanup is already cleared.");
    }
    if (task.inspection_occurrence_id) {
      await client.query("commit");
      return task.inspection_occurrence_id;
    }
    if (
      !task.program_id ||
      task.program_active !== true ||
      !task.inspection_template_id ||
      task.template_active !== true ||
      task.published_at == null
    ) {
      throw new Error(
        "Configure an active published campsite cleanup inspection before starting this task.",
      );
    }

    const inserted = await client.query(
      `insert into public.inspection_occurrences (
         organization_id,campground_id,template_id,template_version_id,
         target_kind,asset_id,accommodation_id,inspector_user_id,
         signoff_required
       )
       values ($1,$2,$3,$4,'site',null,$5,$6,$7)
       returning id`,
      [
        campground.organization_id,
        campgroundId,
        task.inspection_template_id,
        task.current_version_id,
        task.accommodation_id,
        actorUserId,
        task.signoff_required,
      ],
    );
    const occurrenceId = inserted.rows[0].id;

    await client.query(
      `update public.campsite_departure_cleanup_tasks
       set inspection_occurrence_id=$3
       where id=$1 and campground_id=$2`,
      [taskId, campgroundId, occurrenceId],
    );

    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: campground.organization_id,
      campgroundId,
      actionKey: "campsite.departure_cleanup.inspection.start",
      permissionKey: "inspection.perform",
      riskLevel: "standard",
      subjectType: "campsite.departure_cleanup.task",
      subjectId: taskId,
      metadata: {
        inspectionOccurrenceId: occurrenceId,
        inspectionTemplateId: task.inspection_template_id,
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

async function assertClearPermission(userId, campgroundId) {
  const [complete, signoff] = await Promise.all([
    hasCampgroundPermission(userId, campgroundId, "maintenance.complete"),
    hasCampgroundPermission(userId, campgroundId, "inspection.signoff"),
  ]);
  if (!complete && !signoff) {
    throw new Error(
      "maintenance.complete or inspection.signoff permission is required to clear departure cleanup.",
    );
  }
  return complete ? "maintenance.complete" : "inspection.signoff";
}

export async function clearCampsiteDepartureCleanupTask({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  taskId,
  expectedRowVersion,
}) {
  const permissionKey = await assertClearPermission(
    actorUserId,
    campgroundId,
  );
  const expected = Number(expectedRowVersion);
  if (!Number.isInteger(expected) || expected < 1) {
    throw new Error("Departure cleanup task row version is invalid.");
  }

  const client = await getPool().connect();

  try {
    await client.query("begin");
    const campground = await campgroundScope(client, campgroundId);
    await beginRls(client, actorUserId);

    const taskResult = await client.query(
      `select
         task.*,
         o.status as inspection_status,
         a.status_state as accommodation_status_state,
         a.row_version as accommodation_row_version
       from public.campsite_departure_cleanup_tasks task
       left join public.inspection_occurrences o
         on o.id=task.inspection_occurrence_id
       join public.accommodations a on a.id=task.accommodation_id
       where task.id=$1 and task.campground_id=$2
       limit 1
       for update of task,a`,
      [taskId, campgroundId],
    );
    if (taskResult.rowCount !== 1) {
      throw new Error("Departure cleanup task is unavailable.");
    }
    const task = taskResult.rows[0];

    if (task.cleared_at) {
      await client.query("commit");
      return;
    }
    if (Number(task.row_version) !== expected) {
      throw new Error(
        "Departure cleanup task changed since this page loaded. Refresh and try again.",
      );
    }
    if (
      !task.inspection_occurrence_id ||
      task.inspection_status !== "signed_off"
    ) {
      throw new Error(
        "The canonical campsite inspection must be signed off before cleanup can clear.",
      );
    }

    const unresolved = await client.query(
      `select count(*)::integer as count
       from public.inspection_results ir
       join public.inspection_corrective_actions action
         on action.inspection_result_id=ir.id
       join public.maintenance_work_orders wo
         on wo.id=action.work_order_id
       where ir.occurrence_id=$1
         and wo.status not in ('completed','cancelled')`,
      [task.inspection_occurrence_id],
    );
    if (Number(unresolved.rows[0].count) > 0) {
      throw new Error(
        "Corrective maintenance work must be completed or cancelled before departure cleanup can clear.",
      );
    }

    if (task.block_rebooking_until_clear) {
      const canManageAccommodation = await hasCampgroundPermission(
        actorUserId,
        campgroundId,
        "accommodation.manage",
      );
      if (!canManageAccommodation) {
        throw new Error(
          "accommodation.manage permission is required to release a campsite that was blocked for rebooking.",
        );
      }
    }

    const cleared = await client.query(
      `update public.campsite_departure_cleanup_tasks
       set cleared_at=statement_timestamp(),
           cleared_by_user_id=$4
       where id=$1
         and campground_id=$2
         and row_version=$3
         and cleared_at is null
       returning cleared_at`,
      [taskId, campgroundId, expected, actorUserId],
    );
    if (cleared.rowCount !== 1) {
      throw new Error(
        "Departure cleanup changed during clearance. Refresh and try again.",
      );
    }

    let releasedToAvailable = false;
    if (
      task.block_rebooking_until_clear &&
      task.accommodation_status_state === "inspection"
    ) {
      await client.query(
        "select set_config('icamp.status_reason',$1,true)",
        ["Build 073 departure campsite cleanup cleared."],
      );
      const released = await client.query(
        `update public.accommodations
         set status_state='available',
             updated_by_user_id=$3
         where id=$1
           and campground_id=$2
           and row_version=$4
           and status_state='inspection'
         returning id`,
        [
          task.accommodation_id,
          campgroundId,
          actorUserId,
          Number(task.accommodation_row_version),
        ],
      );
      if (released.rowCount !== 1) {
        throw new Error(
          "Campsite availability changed during cleanup clearance. Refresh and try again.",
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
      actionKey: "campsite.departure_cleanup.clear",
      permissionKey,
      riskLevel: "standard",
      subjectType: "campsite.departure_cleanup.task",
      subjectId: taskId,
      beforeState: {
        accommodationStatus: task.accommodation_status_state,
        inspectionStatus: task.inspection_status,
        blockRebookingUntilClear: task.block_rebooking_until_clear,
      },
      afterState: {
        cleared: true,
        releasedToAvailable,
      },
      metadata: {
        inspectionOccurrenceId: task.inspection_occurrence_id,
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
