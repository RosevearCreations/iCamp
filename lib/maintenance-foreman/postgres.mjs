import pg from "pg";

import { appendAuditEvent } from "../audit/postgres.mjs";
import { hasCampgroundPermission } from "../authz/postgres.mjs";
import {
  deriveEscalationSignals,
  mayAssignResponsibility,
  validateEscalationNote,
  validateEscalationThresholdMinutes,
  validateMaintenanceEscalationTrigger,
  validateMaintenanceResponsibilityLevel,
} from "./core.mjs";

const { Pool } = pg;
let pool;

function databaseUrl() {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) {
    throw new Error(
      "DATABASE_URL is required for maintenance foreman operations.",
    );
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

export async function closeMaintenanceForemanPoolForTests() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

async function hasAnyQueuePermission(userId, campgroundId) {
  const allowed = await Promise.all(
    ["maintenance.triage", "maintenance.escalate"].map((permission) =>
      hasCampgroundPermission(userId, campgroundId, permission),
    ),
  );
  return allowed.some(Boolean);
}

async function assertQueuePermission(userId, campgroundId) {
  if (!(await hasAnyQueuePermission(userId, campgroundId))) {
    throw new Error("Not authorized to use the maintenance foreman queue.");
  }
}

async function assertPermission(userId, campgroundId, permission) {
  if (!(await hasCampgroundPermission(userId, campgroundId, permission))) {
    throw new Error(`Not authorized for ${permission}.`);
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

function mapPolicy(row) {
  return {
    id: row.id,
    triggerKey: row.trigger_key,
    targetLevel: row.target_level,
    thresholdMinutes: Number(row.threshold_minutes),
    isActive: row.is_active === true,
    instructions: row.instructions ?? null,
    rowVersion: Number(row.row_version),
  };
}

function mapEscalation(row) {
  return {
    id: row.id,
    workOrderId: row.work_order_id,
    triggerKey: row.trigger_key,
    targetLevel: row.target_level,
    state: row.state,
    raisedByUserId: row.raised_by_user_id,
    raisedAt: row.raised_at,
    acknowledgementNote: row.acknowledgement_note ?? null,
    acknowledgedByUserId: row.acknowledged_by_user_id ?? null,
    acknowledgedAt: row.acknowledged_at ?? null,
    resolutionNote: row.resolution_note ?? null,
    resolvedByUserId: row.resolved_by_user_id ?? null,
    resolvedAt: row.resolved_at ?? null,
    rowVersion: Number(row.row_version),
  };
}

export async function getMaintenanceForemanQueue(userId, campgroundId) {
  await assertQueuePermission(userId, campgroundId);
  const client = await getPool().connect();

  try {
    await client.query("begin");
    const campground = await campgroundScope(client, campgroundId);
    const responsibilityResult = await client.query(
      `select
         icamp_private.maintenance_responsibility_rank($1,$2) as rank,
         icamp_private.maintenance_responsibility_level($1,$2) as level,
         statement_timestamp() as generated_at`,
      [userId, campgroundId],
    );
    const responsibility = responsibilityResult.rows[0];
    if (!responsibility?.level) {
      throw new Error("Maintenance responsibility level is unavailable.");
    }

    const staffResult = await client.query(
      `select
         u.id,
         u.email_normalized,
         icamp_private.maintenance_responsibility_rank(u.id,$1) as rank,
         icamp_private.maintenance_responsibility_level(u.id,$1) as level
       from icamp_private.campground_assignments a
       join icamp_private.user_accounts u on u.id=a.user_id
       where a.campground_id=$1
         and a.assignment_state='active'
         and a.starts_at <= statement_timestamp()
         and (a.ends_at is null or a.ends_at > statement_timestamp())
         and u.account_type='staff'
         and u.account_state='active'
         and icamp_private.maintenance_responsibility_rank(u.id,$1) > 0
       order by
         icamp_private.maintenance_responsibility_rank(u.id,$1) desc,
         u.email_normalized`,
      [campgroundId],
    );

    await beginRls(client, userId);
    const [policyResult, workOrderResult, escalationResult] = await Promise.all(
      [
        client.query(
          `select *
         from public.maintenance_escalation_policies
         where campground_id=$1
         order by trigger_key`,
          [campgroundId],
        ),
        client.query(
          `select
           w.*,
           c.display_name as category_name,
           p.priority_key
         from public.maintenance_work_orders w
         join public.maintenance_categories c on c.id=w.category_id
         join public.maintenance_priority_policies p on p.id=w.priority_policy_id
         where w.campground_id=$1
           and w.status not in ('completed','cancelled')
         order by w.completion_due_at,w.created_at`,
          [campgroundId],
        ),
        client.query(
          `select *
         from public.maintenance_work_order_escalations
         where campground_id=$1
           and state in ('open','acknowledged')
         order by raised_at desc`,
          [campgroundId],
        ),
      ],
    );
    await client.query("commit");

    const generatedAt = new Date(responsibility.generated_at).toISOString();
    const policies = policyResult.rows.map(mapPolicy);
    const escalations = escalationResult.rows.map(mapEscalation);
    const escalationByWorkOrder = new Map();
    for (const escalation of escalations) {
      const current = escalationByWorkOrder.get(escalation.workOrderId) ?? [];
      current.push(escalation);
      escalationByWorkOrder.set(escalation.workOrderId, current);
    }

    const workOrders = workOrderResult.rows.map((row) => {
      const base = {
        id: row.id,
        title: row.title,
        categoryName: row.category_name,
        priorityKey: row.priority_key,
        status: row.status,
        assignedToUserId: row.assigned_to_user_id ?? null,
        responseDueAt: row.response_due_at,
        completionDueAt: row.completion_due_at,
        respondedAt: row.responded_at ?? null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        rowVersion: Number(row.row_version),
      };
      const signals = deriveEscalationSignals(base, policies, generatedAt);
      const activeEscalations = escalationByWorkOrder.get(base.id) ?? [];
      return {
        ...base,
        signals,
        activeEscalations,
        hasResponseOverdue: signals.some(
          (signal) => signal.triggerKey === "response_overdue",
        ),
        hasCompletionOverdue: signals.some(
          (signal) => signal.triggerKey === "completion_overdue",
        ),
      };
    });

    const staff = staffResult.rows.map((row) => ({
      id: row.id,
      label: row.email_normalized,
      responsibilityLevel: row.level,
      responsibilityRank: Number(row.rank),
      assignable:
        row.id === userId ||
        mayAssignResponsibility(responsibility.level, row.level),
    }));

    workOrders.sort((a, b) => {
      const rank = (workOrder) => {
        if (workOrder.priorityKey === "emergency") return 0;
        if (workOrder.hasCompletionOverdue) return 1;
        if (workOrder.status === "blocked") return 2;
        if (workOrder.priorityKey === "urgent") return 3;
        if (workOrder.hasResponseOverdue) return 4;
        return 5;
      };
      const rankDifference = rank(a) - rank(b);
      if (rankDifference !== 0) {
        return rankDifference;
      }
      return (
        new Date(a.completionDueAt).getTime() -
        new Date(b.completionDueAt).getTime()
      );
    });

    return {
      campground: {
        id: campground.id,
        organizationId: campground.organization_id,
        name: campground.name,
        timezone: campground.timezone,
      },
      generatedAt,
      actorResponsibilityLevel: responsibility.level,
      actorResponsibilityRank: Number(responsibility.rank),
      staff,
      policies,
      workOrders,
      activeEscalations: escalations,
    };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function escalationContext(
  client,
  campgroundId,
  workOrderId,
  triggerKey,
) {
  const result = await client.query(
    `select
       w.organization_id,
       w.id,
       w.status,
       w.created_at,
       w.updated_at,
       w.response_due_at,
       w.completion_due_at,
       w.responded_at,
       p.priority_key,
       ep.target_level,
       ep.threshold_minutes,
       ep.is_active,
       statement_timestamp() as db_now
     from public.maintenance_work_orders w
     join public.maintenance_priority_policies p on p.id=w.priority_policy_id
     join public.maintenance_escalation_policies ep
       on ep.organization_id=w.organization_id
      and ep.campground_id=w.campground_id
      and ep.trigger_key=$3
     where w.id=$1
       and w.campground_id=$2
     limit 1`,
    [workOrderId, campgroundId, triggerKey],
  );
  if (result.rowCount !== 1) {
    throw new Error(
      "Maintenance work order or escalation policy is unavailable.",
    );
  }
  return result.rows[0];
}

export async function raiseMaintenanceEscalation({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  workOrderId,
  triggerKey,
}) {
  await assertQueuePermission(actorUserId, campgroundId);
  const trigger = validateMaintenanceEscalationTrigger(triggerKey);
  const client = await getPool().connect();

  try {
    await client.query("begin");
    await beginRls(client, actorUserId);
    const context = await escalationContext(
      client,
      campgroundId,
      workOrderId,
      trigger,
    );
    const signals = deriveEscalationSignals(
      {
        priorityKey: context.priority_key,
        status: context.status,
        createdAt: context.created_at,
        updatedAt: context.updated_at,
        respondedAt: context.responded_at,
        responseDueAt: context.response_due_at,
        completionDueAt: context.completion_due_at,
      },
      [
        {
          triggerKey: trigger,
          targetLevel: context.target_level,
          thresholdMinutes: Number(context.threshold_minutes),
          isActive: context.is_active === true,
        },
      ],
      context.db_now,
    );
    if (signals.length !== 1) {
      throw new Error("That escalation trigger is not currently eligible.");
    }

    const inserted = await client.query(
      `insert into public.maintenance_work_order_escalations (
         organization_id,campground_id,work_order_id,trigger_key,target_level,
         raised_by_user_id
       ) values ($1,$2,$3,$4,$5,$6)
       returning id`,
      [
        context.organization_id,
        campgroundId,
        workOrderId,
        trigger,
        context.target_level,
        actorUserId,
      ],
    );
    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: context.organization_id,
      campgroundId,
      actionKey: "maintenance.escalation.raise",
      permissionKey: "maintenance.triage",
      riskLevel: "elevated",
      subjectType: "maintenance.work_order",
      subjectId: workOrderId,
      metadata: {
        escalationId: inserted.rows[0].id,
        triggerKey: trigger,
        targetLevel: context.target_level,
      },
    });
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    if (
      String(error?.message ?? "").includes(
        "maintenance_work_order_escalations_active_trigger_idx",
      )
    ) {
      throw new Error("That work-order escalation is already active.");
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function acknowledgeMaintenanceEscalation({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  escalationId,
  expectedRowVersion,
  note = null,
}) {
  await assertPermission(actorUserId, campgroundId, "maintenance.triage");
  const acknowledgementNote = validateEscalationNote(note);
  const expected = Number(expectedRowVersion);
  if (!Number.isInteger(expected) || expected < 1) {
    throw new Error("Escalation row version is invalid.");
  }

  const client = await getPool().connect();
  try {
    await client.query("begin");
    await beginRls(client, actorUserId);
    const updated = await client.query(
      `update public.maintenance_work_order_escalations
       set
         state='acknowledged',
         acknowledgement_note=$4,
         acknowledged_by_user_id=$5,
         acknowledged_at=statement_timestamp()
       where id=$1
         and campground_id=$2
         and row_version=$3
         and state='open'
       returning organization_id,work_order_id,row_version`,
      [escalationId, campgroundId, expected, acknowledgementNote, actorUserId],
    );
    if (updated.rowCount !== 1) {
      throw new Error(
        "Maintenance escalation changed while you were editing it. Refresh and try again.",
      );
    }
    const row = updated.rows[0];
    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: row.organization_id,
      campgroundId,
      actionKey: "maintenance.escalation.acknowledge",
      permissionKey: "maintenance.triage",
      riskLevel: "elevated",
      subjectType: "maintenance.work_order",
      subjectId: row.work_order_id,
      metadata: {
        escalationId,
        rowVersion: Number(row.row_version),
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

export async function resolveMaintenanceEscalation({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  escalationId,
  expectedRowVersion,
  note,
}) {
  await assertPermission(actorUserId, campgroundId, "maintenance.escalate");
  const resolutionNote = validateEscalationNote(note, { required: true });
  const expected = Number(expectedRowVersion);
  if (!Number.isInteger(expected) || expected < 1) {
    throw new Error("Escalation row version is invalid.");
  }

  const client = await getPool().connect();
  try {
    await client.query("begin");
    await beginRls(client, actorUserId);
    const updated = await client.query(
      `update public.maintenance_work_order_escalations
       set
         state='resolved',
         resolution_note=$4,
         resolved_by_user_id=$5,
         resolved_at=statement_timestamp()
       where id=$1
         and campground_id=$2
         and row_version=$3
         and state in ('open','acknowledged')
       returning organization_id,work_order_id,row_version`,
      [escalationId, campgroundId, expected, resolutionNote, actorUserId],
    );
    if (updated.rowCount !== 1) {
      throw new Error(
        "Maintenance escalation changed while you were editing it. Refresh and try again.",
      );
    }
    const row = updated.rows[0];
    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: row.organization_id,
      campgroundId,
      actionKey: "maintenance.escalation.resolve",
      permissionKey: "maintenance.escalate",
      riskLevel: "elevated",
      subjectType: "maintenance.work_order",
      subjectId: row.work_order_id,
      metadata: {
        escalationId,
        rowVersion: Number(row.row_version),
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

export async function updateMaintenanceEscalationPolicy({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  policyId,
  targetLevel,
  thresholdMinutes,
  isActive,
  instructions = null,
  expectedRowVersion,
}) {
  await assertPermission(actorUserId, campgroundId, "maintenance.escalate");
  const level = validateMaintenanceResponsibilityLevel(targetLevel);
  if (level === "crew") {
    throw new Error(
      "Escalation targets must be foreman responsibility or higher.",
    );
  }
  const threshold = validateEscalationThresholdMinutes(thresholdMinutes);
  const cleanInstructions = String(instructions ?? "").trim() || null;
  if (cleanInstructions && cleanInstructions.length > 1000) {
    throw new Error(
      "Escalation instructions must be 1,000 characters or fewer.",
    );
  }
  const expected = Number(expectedRowVersion);
  if (!Number.isInteger(expected) || expected < 1) {
    throw new Error("Escalation policy row version is invalid.");
  }

  const client = await getPool().connect();
  try {
    await client.query("begin");
    await beginRls(client, actorUserId);
    const beforeResult = await client.query(
      `select *
       from public.maintenance_escalation_policies
       where id=$1 and campground_id=$2
       limit 1
       for update`,
      [policyId, campgroundId],
    );
    if (beforeResult.rowCount !== 1) {
      throw new Error("Maintenance escalation policy is unavailable.");
    }
    const before = beforeResult.rows[0];
    const updated = await client.query(
      `update public.maintenance_escalation_policies
       set
         target_level=$4,
         threshold_minutes=$5,
         is_active=$6,
         instructions=$7,
         updated_by_user_id=$8
       where id=$1
         and campground_id=$2
         and row_version=$3
       returning *`,
      [
        policyId,
        campgroundId,
        expected,
        level,
        threshold,
        isActive === true,
        cleanInstructions,
        actorUserId,
      ],
    );
    if (updated.rowCount !== 1) {
      throw new Error(
        "Maintenance escalation policy changed while you were editing it. Refresh and try again.",
      );
    }
    const saved = updated.rows[0];
    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: saved.organization_id,
      campgroundId,
      actionKey: "maintenance.escalation_policy.update",
      permissionKey: "maintenance.escalate",
      riskLevel: "elevated",
      subjectType: "maintenance.escalation_policy",
      subjectId: policyId,
      beforeState: {
        targetLevel: before.target_level,
        thresholdMinutes: Number(before.threshold_minutes),
        isActive: before.is_active,
        rowVersion: Number(before.row_version),
      },
      afterState: {
        targetLevel: saved.target_level,
        thresholdMinutes: Number(saved.threshold_minutes),
        isActive: saved.is_active,
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
