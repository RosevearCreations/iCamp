import pg from "pg";
import {
  hasCampgroundPermission,
  getCampgroundAuthorization,
} from "../authz/postgres.mjs";
import { unitId } from "../permanent-unit-market/core.mjs";
import {
  normalizeFollowupTask,
  normalizeFollowupEvidence,
  normalizeFollowupReassessment,
  normalizeEscalationClosure,
} from "./core.mjs";
let pool;
const database = () => {
  if (!pool) {
    if (!process.env.DATABASE_URL?.trim())
      throw new Error("DATABASE_URL required for restricted follow-up.");
    pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      connectionTimeoutMillis: 5000,
    });
  }
  return pool;
};
async function scoped(actor, campground, operation) {
  const camp = unitId(campground, "Campground");
  if (!(await hasCampgroundPermission(actor, camp, "permanent_unit.transfer")))
    throw new Error("Not authorized for finance follow-up.");
  const connection = await database().connect();
  try {
    await connection.query("begin");
    await connection.query("set local role icamp_app");
    await connection.query("select set_config('icamp.user_id',$1,true)", [
      actor,
    ]);
    const found = await connection.query(
      "select id,organization_id,name from public.campgrounds where id=$1",
      [camp],
    );
    if (!found.rows[0]) throw new Error("Campground unavailable.");
    const result = await operation(connection, found.rows[0]);
    await connection.query("commit");
    return result;
  } catch (error) {
    await connection.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    connection.release();
  }
}
async function requireOwner(actor, campground) {
  const auth = await getCampgroundAuthorization(
    unitId(actor),
    unitId(campground),
  );
  if (!auth?.roleCodes?.includes("owner_admin"))
    throw new Error("Active campground owner authorization required.");
}
export async function getFollowupDashboard(actorUserId, campgroundId) {
  return scoped(actorUserId, campgroundId, async (client, camp) => {
    const tables = [
      "permanent_unit_finance_owner_escalations",
      "permanent_unit_finance_owner_responses",
      "permanent_unit_finance_followup_tasks",
      "permanent_unit_finance_followup_evidence",
      "permanent_unit_finance_followup_reassessments",
      "permanent_unit_finance_escalation_closures",
    ];
    const data = await Promise.all(
      tables.map((table) =>
        client.query(
          `select * from public.${table} where campground_id=$1 limit 300`,
          [camp.id],
        ),
      ),
    );
    return {
      campground: camp,
      escalations: data[0].rows,
      responses: data[1].rows,
      tasks: data[2].rows,
      evidence: data[3].rows,
      reassessments: data[4].rows,
      closures: data[5].rows,
    };
  });
}
export async function createFollowupTask({
  actorUserId,
  campgroundId,
  ...input
}) {
  const v = normalizeFollowupTask(input);
  await requireOwner(v.assignedOwnerUserId, campgroundId);
  return scoped(actorUserId, campgroundId, async (client, camp) => {
    const r = await client.query(
      `insert into public.permanent_unit_finance_followup_tasks
    (id,organization_id,campground_id,escalation_id,owner_response_id,assigned_owner_user_id,task_reference,action_plan,due_at,recorded_by_user_id)
    values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning id`,
      [
        v.id,
        camp.organization_id,
        camp.id,
        v.escalationId,
        v.ownerResponseId,
        v.assignedOwnerUserId,
        v.taskReference,
        v.actionPlan,
        v.dueAt,
        actorUserId,
      ],
    );
    return r.rows[0].id;
  });
}
export async function recordFollowupEvidence({
  actorUserId,
  campgroundId,
  ...input
}) {
  const v = normalizeFollowupEvidence(input);
  await requireOwner(actorUserId, campgroundId);
  return scoped(actorUserId, campgroundId, async (client, camp) => {
    const r = await client.query(
      `insert into public.permanent_unit_finance_followup_evidence
    (id,organization_id,campground_id,task_id,evidence_kind,evidence_reference,note,recorded_by_user_id)
    values($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
      [
        v.id,
        camp.organization_id,
        camp.id,
        v.taskId,
        v.evidenceKind,
        v.evidenceReference,
        v.note,
        actorUserId,
      ],
    );
    return r.rows[0].id;
  });
}
export async function recordFollowupReassessment({
  actorUserId,
  campgroundId,
  ...input
}) {
  const v = normalizeFollowupReassessment(input);
  return scoped(actorUserId, campgroundId, async (client, camp) => {
    const r = await client.query(
      `insert into public.permanent_unit_finance_followup_reassessments
    (id,organization_id,campground_id,task_id,evidence_id,reassessment,evidence_reference,note,reassessed_by_user_id)
    values($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id`,
      [
        v.id,
        camp.organization_id,
        camp.id,
        v.taskId,
        v.evidenceId,
        v.reassessment,
        v.evidenceReference,
        v.note,
        actorUserId,
      ],
    );
    return r.rows[0].id;
  });
}
export async function recordEscalationClosure({
  actorUserId,
  campgroundId,
  ...input
}) {
  const v = normalizeEscalationClosure(input);
  await requireOwner(actorUserId, campgroundId);
  return scoped(actorUserId, campgroundId, async (client, camp) => {
    const r = await client.query(
      `insert into public.permanent_unit_finance_escalation_closures
    (id,organization_id,campground_id,task_id,reassessment_id,outcome,evidence_reference,note,closed_by_user_id)
    values($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id`,
      [
        v.id,
        camp.organization_id,
        camp.id,
        v.taskId,
        v.reassessmentId,
        v.outcome,
        v.evidenceReference,
        v.note,
        actorUserId,
      ],
    );
    return r.rows[0].id;
  });
}
