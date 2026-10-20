import pg from "pg";

import { appendAuditEvent } from "../audit/postgres.mjs";
import { hasCampgroundPermission } from "../authz/postgres.mjs";
import {
  validateCompletionSummary,
  validateMaintenanceLaborInput,
  validateMaintenanceMaterialInput,
  validateMaintenanceNote,
  validateMaintenanceStatusTransition,
  validateMaintenanceWorkOrderInput,
  validateWorkOrderStatus,
} from "./core.mjs";

const { Pool } = pg;
let pool;

function databaseUrl() {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) {
    throw new Error("DATABASE_URL is required for maintenance work orders.");
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

export async function closeMaintenanceWorkOrderPoolForTests() {
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
    ].map((permission) => allowed(userId, campgroundId, permission)),
  );
  if (!checks.some(Boolean)) {
    throw new Error("Not authorized to read maintenance work orders.");
  }
}

async function assertPermission(userId, campgroundId, permission) {
  if (!(await allowed(userId, campgroundId, permission))) {
    throw new Error(`Not authorized for ${permission}.`);
  }
}

async function assertCanAddEvidence(userId, campgroundId) {
  const checks = await Promise.all(
    ["maintenance.create", "maintenance.assign", "maintenance.complete"].map(
      (permission) => allowed(userId, campgroundId, permission),
    ),
  );
  if (!checks.some(Boolean)) {
    throw new Error("Not authorized to add maintenance evidence.");
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

async function activeStaff(client, campgroundId) {
  const result = await client.query(
    `select distinct u.id,u.email_normalized
     from icamp_private.campground_assignments a
     join icamp_private.user_accounts u on u.id=a.user_id
     where a.campground_id=$1
       and a.assignment_state='active'
       and a.starts_at <= statement_timestamp()
       and (a.ends_at is null or a.ends_at > statement_timestamp())
       and u.account_type='staff'
       and u.account_state='active'
     order by u.email_normalized`,
    [campgroundId],
  );
  return result.rows.map((row) => ({
    id: row.id,
    label: row.email_normalized,
  }));
}

async function assertActiveStaff(client, campgroundId, userId) {
  const result = await client.query(
    `select 1
     from icamp_private.campground_assignments a
     join icamp_private.user_accounts u on u.id=a.user_id
     where a.campground_id=$1
       and a.user_id=$2
       and a.assignment_state='active'
       and a.starts_at <= statement_timestamp()
       and (a.ends_at is null or a.ends_at > statement_timestamp())
       and u.account_type='staff'
       and u.account_state='active'
     limit 1`,
    [campgroundId, userId],
  );
  if (result.rowCount !== 1) {
    throw new Error("Selected worker does not have an active campground assignment.");
  }
}

function mapWorkOrder(row, staffById) {
  return {
    id: row.id,
    categoryId: row.category_id,
    categoryName: row.category_name,
    categoryCode: row.category_code,
    priorityPolicyId: row.priority_policy_id,
    priorityKey: row.priority_key,
    sectionId: row.section_id ?? null,
    sectionName: row.section_name ?? null,
    assetId: row.asset_id ?? null,
    assetName: row.asset_name ?? null,
    accommodationId: row.accommodation_id ?? null,
    accommodationName: row.accommodation_name ?? null,
    locationDescription: row.location_description ?? null,
    title: row.title,
    description: row.description ?? null,
    status: row.status,
    assignedToUserId: row.assigned_to_user_id ?? null,
    assignedToLabel: row.assigned_to_user_id
      ? staffById.get(row.assigned_to_user_id) ?? row.assigned_to_user_id
      : null,
    responseDueAt: row.response_due_at,
    completionDueAt: row.completion_due_at,
    respondedAt: row.responded_at ?? null,
    completedAt: row.completed_at ?? null,
    completedByUserId: row.completed_by_user_id ?? null,
    completionSummary: row.completion_summary ?? null,
    cancelledAt: row.cancelled_at ?? null,
    cancellationReason: row.cancellation_reason ?? null,
    rowVersion: Number(row.row_version),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
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

export async function getMaintenanceWorkOrderBoard(userId, campgroundId) {
  await assertCanRead(userId, campgroundId);
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const campground = await campgroundScope(client, campgroundId);
    const [staff, categoryResult, priorityResult, sectionResult, assetResult, accommodationResult] =
      await Promise.all([
        activeStaff(client, campgroundId),
        client.query(
          `select id,category_code,display_name
           from public.maintenance_categories
           where campground_id=$1 and is_active
           order by is_standard desc,display_name`,
          [campgroundId],
        ),
        client.query(
          `select id,priority_key,target_response_minutes,target_completion_minutes
           from public.maintenance_priority_policies
           where campground_id=$1`,
          [campgroundId],
        ),
        client.query(
          `select id,name
           from public.campground_sections
           where campground_id=$1 and lifecycle_state <> 'archived'
           order by sort_order,name`,
          [campgroundId],
        ),
        client.query(
          `select id,display_name
           from public.operational_assets
           where campground_id=$1 and lifecycle_state <> 'archived'
           order by display_name`,
          [campgroundId],
        ),
        client.query(
          `select id,code,display_name
           from public.accommodations
           where campground_id=$1 and lifecycle_state <> 'archived'
           order by code,display_name`,
          [campgroundId],
        ),
      ]);

    await beginRls(client, userId);
    const [ordersResult, notesResult, mediaResult, materialsResult, laborResult, eventsResult] =
      await Promise.all([
        client.query(
          `select
             w.*,
             c.category_code,
             c.display_name as category_name,
             p.priority_key,
             s.name as section_name,
             a.display_name as asset_name,
             ac.display_name as accommodation_name
           from public.maintenance_work_orders w
           join public.maintenance_categories c on c.id=w.category_id
           join public.maintenance_priority_policies p on p.id=w.priority_policy_id
           left join public.campground_sections s on s.id=w.section_id
           left join public.operational_assets a on a.id=w.asset_id
           left join public.accommodations ac on ac.id=w.accommodation_id
           where w.campground_id=$1
           order by
             case w.status
               when 'in_progress' then 1
               when 'assigned' then 2
               when 'blocked' then 3
               when 'open' then 4
               when 'completed' then 5
               else 6
             end,
             w.completion_due_at,
             w.created_at desc`,
          [campgroundId],
        ),
        client.query(
          `select * from public.maintenance_work_order_notes
           where campground_id=$1 order by created_at desc`,
          [campgroundId],
        ),
        client.query(
          `select * from public.maintenance_work_order_media
           where campground_id=$1 order by created_at desc`,
          [campgroundId],
        ),
        client.query(
          `select * from public.maintenance_work_order_materials
           where campground_id=$1 order by recorded_at desc`,
          [campgroundId],
        ),
        client.query(
          `select * from public.maintenance_work_order_labor
           where campground_id=$1 order by worked_at desc`,
          [campgroundId],
        ),
        client.query(
          `select * from public.maintenance_work_order_status_events
           where campground_id=$1 order by occurred_at desc`,
          [campgroundId],
        ),
      ]);

    const staffById = new Map(staff.map((entry) => [entry.id, entry.label]));
    const notes = byWorkOrder(notesResult.rows, (row) => ({
      id: row.id,
      noteText: row.note_text,
      createdByUserId: row.created_by_user_id,
      createdAt: row.created_at,
    }));
    const media = byWorkOrder(mediaResult.rows, (row) => ({
      id: row.id,
      mediaAssetId: row.media_asset_id,
      caption: row.caption ?? null,
      createdByUserId: row.created_by_user_id,
      createdAt: row.created_at,
    }));
    const materials = byWorkOrder(materialsResult.rows, (row) => ({
      id: row.id,
      itemName: row.item_name,
      quantity: Number(row.quantity),
      unit: row.unit,
      unitCostCents:
        row.unit_cost_cents == null ? null : Number(row.unit_cost_cents),
      recordedAt: row.recorded_at,
    }));
    const labor = byWorkOrder(laborResult.rows, (row) => ({
      id: row.id,
      workerUserId: row.worker_user_id,
      workerLabel: staffById.get(row.worker_user_id) ?? row.worker_user_id,
      minutes: Number(row.minutes),
      note: row.note ?? null,
      workedAt: row.worked_at,
    }));
    const events = byWorkOrder(eventsResult.rows, (row) => ({
      id: row.id,
      fromStatus: row.from_status ?? null,
      toStatus: row.to_status,
      actorUserId: row.actor_user_id ?? null,
      note: row.note ?? null,
      occurredAt: row.occurred_at,
    }));

    await client.query("commit");
    return {
      campground: {
        id: campground.id,
        organizationId: campground.organization_id,
        name: campground.name,
        timezone: campground.timezone,
      },
      staff,
      categories: categoryResult.rows.map((row) => ({
        id: row.id,
        code: row.category_code,
        name: row.display_name,
      })),
      priorities: priorityResult.rows
        .map((row) => ({
          id: row.id,
          priorityKey: row.priority_key,
          targetResponseMinutes: Number(row.target_response_minutes),
          targetCompletionMinutes: Number(row.target_completion_minutes),
        }))
        .sort(
          (a, b) =>
            ["emergency", "urgent", "normal", "preventive"].indexOf(
              a.priorityKey,
            ) -
            ["emergency", "urgent", "normal", "preventive"].indexOf(
              b.priorityKey,
            ),
        ),
      sections: sectionResult.rows.map((row) => ({
        id: row.id,
        name: row.name,
      })),
      assets: assetResult.rows.map((row) => ({
        id: row.id,
        name: row.display_name,
      })),
      accommodations: accommodationResult.rows.map((row) => ({
        id: row.id,
        code: row.code,
        name: row.display_name,
      })),
      workOrders: ordersResult.rows.map((row) => {
        const order = mapWorkOrder(row, staffById);
        return {
          ...order,
          notes: notes.get(order.id) ?? [],
          media: media.get(order.id) ?? [],
          materials: materials.get(order.id) ?? [],
          labor: labor.get(order.id) ?? [],
          statusEvents: events.get(order.id) ?? [],
        };
      }),
    };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function validateTarget(client, campgroundId, table, id) {
  if (!id) {
    return;
  }
  const allowedTables = new Map([
    ["section", ["public.campground_sections", "id"]],
    ["asset", ["public.operational_assets", "id"]],
    ["accommodation", ["public.accommodations", "id"]],
  ]);
  const target = allowedTables.get(table);
  if (!target) {
    throw new Error("Unsupported maintenance target type.");
  }
  const result = await client.query(
    `select 1 from ${target[0]} where ${target[1]}=$1 and campground_id=$2 and lifecycle_state <> 'archived' limit 1`,
    [id, campgroundId],
  );
  if (result.rowCount !== 1) {
    throw new Error(`Selected maintenance ${table} is unavailable.`);
  }
}

export async function createMaintenanceWorkOrder({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  ...input
}) {
  await assertPermission(actorUserId, campgroundId, "maintenance.create");
  const workOrder = validateMaintenanceWorkOrderInput(input);
  const client = await getPool().connect();

  try {
    await client.query("begin");
    const campground = await campgroundScope(client, campgroundId);

    const [category, priority] = await Promise.all([
      client.query(
        `select id from public.maintenance_categories
         where id=$1 and campground_id=$2 and is_active limit 1`,
        [workOrder.categoryId, campgroundId],
      ),
      client.query(
        `select id,target_response_minutes,target_completion_minutes
         from public.maintenance_priority_policies
         where id=$1 and campground_id=$2 limit 1`,
        [workOrder.priorityPolicyId, campgroundId],
      ),
      validateTarget(client, campgroundId, "section", workOrder.sectionId),
      validateTarget(client, campgroundId, "asset", workOrder.assetId),
      validateTarget(
        client,
        campgroundId,
        "accommodation",
        workOrder.accommodationId,
      ),
    ]);

    if (category.rowCount !== 1) {
      throw new Error("Selected maintenance category is unavailable.");
    }
    if (priority.rowCount !== 1) {
      throw new Error("Selected maintenance priority is unavailable.");
    }

    await beginRls(client, actorUserId);
    const inserted = await client.query(
      `insert into public.maintenance_work_orders (
         organization_id,campground_id,category_id,priority_policy_id,
         section_id,asset_id,accommodation_id,location_description,
         title,description,status,response_due_at,completion_due_at,
         created_by_user_id,updated_by_user_id
       )
       values (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'open',
         statement_timestamp() + make_interval(mins => $11::int),
         statement_timestamp() + make_interval(mins => $12::int),
         $13,$13
       )
       returning *`,
      [
        campground.organization_id,
        campgroundId,
        workOrder.categoryId,
        workOrder.priorityPolicyId,
        workOrder.sectionId,
        workOrder.assetId,
        workOrder.accommodationId,
        workOrder.locationDescription,
        workOrder.title,
        workOrder.description,
        Number(priority.rows[0].target_response_minutes),
        Number(priority.rows[0].target_completion_minutes),
        actorUserId,
      ],
    );
    const saved = inserted.rows[0];

    await client.query("reset role");
    await client.query(
      `insert into public.maintenance_work_order_status_events (
         organization_id,campground_id,work_order_id,from_status,to_status,
         actor_user_id,note
       ) values ($1,$2,$3,null,'open',$4,'Work order created')`,
      [campground.organization_id, campgroundId, saved.id, actorUserId],
    );
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: campground.organization_id,
      campgroundId,
      actionKey: "maintenance.work_order.create",
      permissionKey: "maintenance.create",
      riskLevel: "standard",
      subjectType: "maintenance.work_order",
      subjectId: saved.id,
      afterState: {
        status: saved.status,
        categoryId: saved.category_id,
        priorityPolicyId: saved.priority_policy_id,
        sectionId: saved.section_id,
        assetId: saved.asset_id,
        accommodationId: saved.accommodation_id,
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

export async function assignMaintenanceWorkOrder({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  workOrderId,
  assignedToUserId,
  expectedRowVersion,
}) {
  await assertPermission(actorUserId, campgroundId, "maintenance.assign");
  const expected = Number(expectedRowVersion);
  if (!Number.isInteger(expected) || expected < 1) {
    throw new Error("Work-order row version is invalid.");
  }

  const assignee = String(assignedToUserId ?? "").trim() || null;
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const campground = await campgroundScope(client, campgroundId);
    if (assignee) {
      await assertActiveStaff(client, campgroundId, assignee);
    }

    await beginRls(client, actorUserId);
    const beforeResult = await client.query(
      `select * from public.maintenance_work_orders
       where id=$1 and campground_id=$2 limit 1 for update`,
      [workOrderId, campgroundId],
    );
    if (beforeResult.rowCount !== 1) {
      throw new Error("Maintenance work order is unavailable.");
    }
    const before = beforeResult.rows[0];
    if (["completed", "cancelled"].includes(before.status)) {
      throw new Error("Closed maintenance work orders cannot be reassigned.");
    }

    const nextStatus =
      assignee && before.status === "open"
        ? "assigned"
        : !assignee && before.status === "assigned"
          ? "open"
          : before.status;

    const updated = await client.query(
      `update public.maintenance_work_orders
       set assigned_to_user_id=$4,status=$5,updated_by_user_id=$6
       where id=$1 and campground_id=$2 and row_version=$3
       returning *`,
      [
        workOrderId,
        campgroundId,
        expected,
        assignee,
        nextStatus,
        actorUserId,
      ],
    );
    if (updated.rowCount !== 1) {
      throw new Error(
        "Maintenance work order changed while you were editing it. Refresh and try again.",
      );
    }
    const saved = updated.rows[0];

    await client.query("reset role");
    if (before.status !== saved.status) {
      await client.query(
        `insert into public.maintenance_work_order_status_events (
           organization_id,campground_id,work_order_id,from_status,to_status,
           actor_user_id,note
         ) values ($1,$2,$3,$4,$5,$6,$7)`,
        [
          campground.organization_id,
          campgroundId,
          workOrderId,
          before.status,
          saved.status,
          actorUserId,
          assignee ? "Assignment created" : "Assignment cleared",
        ],
      );
    }
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: campground.organization_id,
      campgroundId,
      actionKey: "maintenance.work_order.assign",
      permissionKey: "maintenance.assign",
      riskLevel: "standard",
      subjectType: "maintenance.work_order",
      subjectId: workOrderId,
      beforeState: {
        assignedToUserId: before.assigned_to_user_id,
        status: before.status,
        rowVersion: Number(before.row_version),
      },
      afterState: {
        assignedToUserId: saved.assigned_to_user_id,
        status: saved.status,
        rowVersion: Number(saved.row_version),
      },
    });

    await client.query("commit");
    return Number(saved.row_version);
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function transitionMaintenanceWorkOrder({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  workOrderId,
  toStatus,
  expectedRowVersion,
  completionSummary = null,
  note = null,
}) {
  const targetStatus = validateWorkOrderStatus(toStatus);
  await assertPermission(
    actorUserId,
    campgroundId,
    targetStatus === "completed" ? "maintenance.complete" : "maintenance.assign",
  );
  const expected = Number(expectedRowVersion);
  if (!Number.isInteger(expected) || expected < 1) {
    throw new Error("Work-order row version is invalid.");
  }

  const transitionNote = String(note ?? "").trim() || null;
  if (transitionNote && transitionNote.length > 1000) {
    throw new Error("Transition note must be 1,000 characters or fewer.");
  }
  const completion =
    targetStatus === "completed"
      ? validateCompletionSummary(completionSummary)
      : null;
  if (targetStatus === "cancelled" && (!transitionNote || transitionNote.length < 3)) {
    throw new Error("Cancellation requires a reason of at least 3 characters.");
  }

  const client = await getPool().connect();
  try {
    await client.query("begin");
    const campground = await campgroundScope(client, campgroundId);
    await beginRls(client, actorUserId);
    const beforeResult = await client.query(
      `select * from public.maintenance_work_orders
       where id=$1 and campground_id=$2 limit 1 for update`,
      [workOrderId, campgroundId],
    );
    if (beforeResult.rowCount !== 1) {
      throw new Error("Maintenance work order is unavailable.");
    }
    const before = beforeResult.rows[0];
    validateMaintenanceStatusTransition(before.status, targetStatus);

    const effectiveAssignee =
      targetStatus === "in_progress" && !before.assigned_to_user_id
        ? actorUserId
        : before.assigned_to_user_id;

    const updated = await client.query(
      `update public.maintenance_work_orders
       set
         status=$4,
         assigned_to_user_id=$5,
         responded_at=case
           when $4 in ('in_progress','completed') and responded_at is null
             then statement_timestamp()
           else responded_at
         end,
         completed_at=case when $4='completed' then statement_timestamp() else null end,
         completed_by_user_id=case when $4='completed' then $6 else null end,
         completion_summary=case when $4='completed' then $7 else null end,
         cancelled_at=case when $4='cancelled' then statement_timestamp() else null end,
         cancelled_by_user_id=case when $4='cancelled' then $6 else null end,
         cancellation_reason=case when $4='cancelled' then $8 else null end,
         updated_by_user_id=$6
       where id=$1 and campground_id=$2 and row_version=$3
       returning *`,
      [
        workOrderId,
        campgroundId,
        expected,
        targetStatus,
        effectiveAssignee,
        actorUserId,
        completion,
        targetStatus === "cancelled" ? transitionNote : null,
      ],
    );
    if (updated.rowCount !== 1) {
      throw new Error(
        "Maintenance work order changed while you were editing it. Refresh and try again.",
      );
    }
    const saved = updated.rows[0];

    await client.query("reset role");
    await client.query(
      `insert into public.maintenance_work_order_status_events (
         organization_id,campground_id,work_order_id,from_status,to_status,
         actor_user_id,note
       ) values ($1,$2,$3,$4,$5,$6,$7)`,
      [
        campground.organization_id,
        campgroundId,
        workOrderId,
        before.status,
        saved.status,
        actorUserId,
        transitionNote,
      ],
    );
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: campground.organization_id,
      campgroundId,
      actionKey:
        targetStatus === "completed"
          ? "maintenance.work_order.complete"
          : "maintenance.work_order.transition",
      permissionKey:
        targetStatus === "completed"
          ? "maintenance.complete"
          : "maintenance.assign",
      riskLevel: "standard",
      subjectType: "maintenance.work_order",
      subjectId: workOrderId,
      beforeState: {
        status: before.status,
        assignedToUserId: before.assigned_to_user_id,
        rowVersion: Number(before.row_version),
      },
      afterState: {
        status: saved.status,
        assignedToUserId: saved.assigned_to_user_id,
        rowVersion: Number(saved.row_version),
      },
    });

    await client.query("commit");
    return Number(saved.row_version);
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function loadWorkOrderScope(client, campgroundId, workOrderId) {
  const result = await client.query(
    `select organization_id,id,status
     from public.maintenance_work_orders
     where id=$1 and campground_id=$2 limit 1`,
    [workOrderId, campgroundId],
  );
  if (result.rowCount !== 1) {
    throw new Error("Maintenance work order is unavailable.");
  }
  if (["completed", "cancelled"].includes(result.rows[0].status)) {
    throw new Error("Closed maintenance work orders cannot accept new work evidence.");
  }
  return result.rows[0];
}

export async function addMaintenanceWorkOrderNote({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  workOrderId,
  note,
}) {
  await assertCanAddEvidence(actorUserId, campgroundId);
  const noteText = validateMaintenanceNote(note);
  const client = await getPool().connect();
  try {
    await client.query("begin");
    await campgroundScope(client, campgroundId);
    await beginRls(client, actorUserId);
    const order = await loadWorkOrderScope(client, campgroundId, workOrderId);
    const inserted = await client.query(
      `insert into public.maintenance_work_order_notes (
         organization_id,campground_id,work_order_id,note_text,created_by_user_id
       ) values ($1,$2,$3,$4,$5) returning id`,
      [
        order.organization_id,
        campgroundId,
        workOrderId,
        noteText,
        actorUserId,
      ],
    );
    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: order.organization_id,
      campgroundId,
      actionKey: "maintenance.work_order.note.add",
      permissionKey: "maintenance.create",
      riskLevel: "standard",
      subjectType: "maintenance.work_order",
      subjectId: workOrderId,
      metadata: { noteId: inserted.rows[0].id },
    });
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function attachMaintenanceWorkOrderMedia({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  workOrderId,
  mediaAssetId,
  caption = null,
}) {
  await assertCanAddEvidence(actorUserId, campgroundId);
  const assetId = String(mediaAssetId ?? "").trim();
  const cleanCaption = String(caption ?? "").trim() || null;
  if (!assetId) {
    throw new Error("Secure media asset ID is required.");
  }
  if (cleanCaption && cleanCaption.length > 500) {
    throw new Error("Media caption must be 500 characters or fewer.");
  }

  const client = await getPool().connect();
  try {
    await client.query("begin");
    const media = await client.query(
      `select id
       from icamp_private.media_assets
       where id=$1
         and campground_id=$2
         and classification='internal'
         and validation_state='validated'
         and lifecycle_state='active'
       limit 1`,
      [assetId, campgroundId],
    );
    if (media.rowCount !== 1) {
      throw new Error(
        "Maintenance evidence must reference an active validated internal secure-media asset.",
      );
    }

    await beginRls(client, actorUserId);
    const order = await loadWorkOrderScope(client, campgroundId, workOrderId);
    const inserted = await client.query(
      `insert into public.maintenance_work_order_media (
         organization_id,campground_id,work_order_id,media_asset_id,caption,
         created_by_user_id
       ) values ($1,$2,$3,$4,$5,$6) returning id`,
      [
        order.organization_id,
        campgroundId,
        workOrderId,
        assetId,
        cleanCaption,
        actorUserId,
      ],
    );
    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: order.organization_id,
      campgroundId,
      actionKey: "maintenance.work_order.media.attach",
      permissionKey: "maintenance.create",
      riskLevel: "standard",
      subjectType: "maintenance.work_order",
      subjectId: workOrderId,
      metadata: { workOrderMediaId: inserted.rows[0].id, mediaAssetId: assetId },
    });
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    if (
      String(error?.message ?? "").includes(
        "maintenance_work_order_media_unique",
      )
    ) {
      throw new Error("That secure-media asset is already attached to this work order.");
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function addMaintenanceWorkOrderMaterial({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  workOrderId,
  ...input
}) {
  await assertCanAddEvidence(actorUserId, campgroundId);
  const material = validateMaintenanceMaterialInput(input);
  const client = await getPool().connect();
  try {
    await client.query("begin");
    await beginRls(client, actorUserId);
    const order = await loadWorkOrderScope(client, campgroundId, workOrderId);
    const inserted = await client.query(
      `insert into public.maintenance_work_order_materials (
         organization_id,campground_id,work_order_id,item_name,quantity,unit,
         unit_cost_cents,recorded_by_user_id
       ) values ($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
      [
        order.organization_id,
        campgroundId,
        workOrderId,
        material.itemName,
        material.quantity,
        material.unit,
        material.unitCostCents,
        actorUserId,
      ],
    );
    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: order.organization_id,
      campgroundId,
      actionKey: "maintenance.work_order.material.add",
      permissionKey: "maintenance.create",
      riskLevel: "standard",
      subjectType: "maintenance.work_order",
      subjectId: workOrderId,
      metadata: { materialId: inserted.rows[0].id },
    });
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function addMaintenanceWorkOrderLabor({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  workOrderId,
  ...input
}) {
  await assertCanAddEvidence(actorUserId, campgroundId);
  const labor = validateMaintenanceLaborInput(input);
  const workerUserId = labor.workerUserId ?? actorUserId;
  const client = await getPool().connect();
  try {
    await client.query("begin");
    await assertActiveStaff(client, campgroundId, workerUserId);
    await beginRls(client, actorUserId);
    const order = await loadWorkOrderScope(client, campgroundId, workOrderId);
    const inserted = await client.query(
      `insert into public.maintenance_work_order_labor (
         organization_id,campground_id,work_order_id,worker_user_id,minutes,
         note,recorded_by_user_id
       ) values ($1,$2,$3,$4,$5,$6,$7) returning id`,
      [
        order.organization_id,
        campgroundId,
        workOrderId,
        workerUserId,
        labor.minutes,
        labor.note,
        actorUserId,
      ],
    );
    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: order.organization_id,
      campgroundId,
      actionKey: "maintenance.work_order.labor.add",
      permissionKey: "maintenance.create",
      riskLevel: "standard",
      subjectType: "maintenance.work_order",
      subjectId: workOrderId,
      metadata: { laborId: inserted.rows[0].id, workerUserId, minutes: labor.minutes },
    });
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
