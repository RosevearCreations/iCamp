import pg from "pg";

import { appendAuditEvent } from "../audit/postgres.mjs";
import { hasCampgroundPermission } from "../authz/postgres.mjs";
import {
  assessShiftReadiness,
  normalizeShiftAvailability,
  normalizeShiftEvent,
  normalizeShiftHandoff,
  normalizeShiftPlan,
  normalizeShiftQualification,
  shiftUuid,
} from "./core.mjs";

const { Pool } = pg;
let pool;
function connection() {
  if (!pool) {
    if (!process.env.DATABASE_URL?.trim())
      throw new Error("DATABASE_URL required for staff shift readiness.");
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
    });
  }
  return pool;
}
export async function closeStaffShiftPoolForTests() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}
export async function getStaffShiftPermissions(userId, campgroundId) {
  const keys = ["staff.shift.self", "schedule.manage", "staff.manage"];
  const [self, manage, verify] = await Promise.all(
    keys.map((key) => hasCampgroundPermission(userId, campgroundId, key)),
  );
  return { self, manage, verify };
}
async function permission(actor, camp, key) {
  if (!(await hasCampgroundPermission(actor, camp, key)))
    throw new Error(
      "STAFF_SHIFT_FORBIDDEN: Insufficient campground staffing permission.",
    );
}
async function campgroundScope(client, campgroundId) {
  const result = await client.query(
    "select id,organization_id,name,timezone from public.campgrounds where id=$1 and lifecycle_state<>'archived'",
    [shiftUuid(campgroundId, "Campground ID")],
  );
  if (result.rowCount !== 1) throw new Error("Campground unavailable.");
  return result.rows[0];
}
async function asActor(client, actor) {
  await client.query("set local role icamp_app");
  await client.query("select set_config('icamp.user_id',$1,true)", [actor]);
}
async function read(actor, campgroundId, work) {
  const client = await connection().connect();
  try {
    await client.query("begin");
    const campground = await campgroundScope(client, campgroundId);
    await asActor(client, actor);
    const result = await work(client, campground);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
async function write(
  {
    actorUserId,
    actorSessionId = null,
    campgroundId,
    permissionKey,
    actionKey,
    subjectType,
  },
  work,
) {
  await permission(actorUserId, campgroundId, permissionKey);
  return read(actorUserId, campgroundId, async (client, campground) => {
    const outcome = await work(client, campground);
    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: campground.organization_id,
      campgroundId,
      actionKey,
      permissionKey,
      riskLevel: permissionKey === "staff.manage" ? "elevated" : "standard",
      subjectType,
      subjectId: outcome.id,
      metadata: outcome.auditMetadata,
    });
    return { id: outcome.id };
  });
}
function iso(value) {
  return value ? new Date(value).toISOString() : null;
}
function mapShift(row) {
  return {
    id: row.id,
    staffUserId: row.staff_user_id,
    department: row.department,
    roleLabel: row.role_label,
    startsAt: iso(row.starts_at),
    endsAt: iso(row.ends_at),
    assignmentNote: row.assignment_note,
    createdAt: iso(row.created_at),
    cancelled: row.cancelled === true,
  };
}
function mapAvailability(row) {
  return {
    id: row.id,
    staffUserId: row.staff_user_id,
    kind: row.kind,
    startsAt: iso(row.starts_at),
    endsAt: iso(row.ends_at),
    reason: row.reason,
    clearsEventId: row.clears_event_id ?? null,
    recordedAt: iso(row.recorded_at),
  };
}
function mapQualification(row) {
  return {
    id: row.id,
    staffUserId: row.staff_user_id,
    qualificationKey: row.qualification_key,
    decision: row.decision,
    sourceReference: row.source_reference,
    validUntil: iso(row.valid_until),
    reviewNote: row.review_note,
    reviewedAt: iso(row.reviewed_at),
  };
}
function mapHandoff(row) {
  return {
    id: row.id,
    fromShiftId: row.from_shift_id,
    toShiftId: row.to_shift_id ?? null,
    summary: row.summary,
    outstandingWork: row.outstanding_work,
    followUpRequired: row.follow_up_required,
    recordedAt: iso(row.recorded_at),
    recordedByUserId: row.recorded_by_user_id,
  };
}
function mapEvent(row) {
  return {
    id: row.id,
    shiftId: row.shift_id,
    handoffId: row.handoff_id ?? null,
    kind: row.kind,
    reason: row.reason,
    actorUserId: row.actor_user_id,
    recordedAt: iso(row.recorded_at),
  };
}

export async function getStaffShiftDashboard(actorUserId, campgroundId) {
  const permissions = await getStaffShiftPermissions(actorUserId, campgroundId);
  if (!permissions.self && !permissions.manage && !permissions.verify)
    throw new Error("STAFF_SHIFT_FORBIDDEN: No staffing access.");
  // Names/emails are available only to authorized schedule managers.
  const roster =
    permissions.manage || permissions.verify
      ? await connection().query(
          `select a.user_id,u.email_normalized as label from icamp_private.campground_assignments a
      join icamp_private.user_accounts u on u.id=a.user_id
      where a.campground_id=$1 and a.assignment_state='active' and a.starts_at<=statement_timestamp()
        and (a.ends_at is null or a.ends_at>statement_timestamp()) and u.account_state='active'
      order by u.email_normalized limit 250`,
          [campgroundId],
        )
      : { rows: [] };
  return read(actorUserId, campgroundId, async (client, campground) => {
    const [
      shiftsResult,
      availabilityResult,
      qualificationResult,
      handoffResult,
      eventResult,
    ] = await Promise.all([
      client.query(
        `select s.*,exists(select 1 from icamp_private.staff_shift_events e where e.shift_id=s.id and e.kind='cancel') as cancelled
        from icamp_private.staff_shift_assignments s where s.campground_id=$1 and s.ends_at>statement_timestamp()-interval '14 days'
        and s.starts_at<statement_timestamp()+interval '180 days' order by s.starts_at asc limit 250`,
        [campgroundId],
      ),
      client.query(
        `select a.* from icamp_private.staff_shift_availability a
        where a.campground_id=$1 and a.kind='unavailable' and a.ends_at>statement_timestamp()-interval '14 days'
          and not exists(select 1 from icamp_private.staff_shift_availability cleared where cleared.clears_event_id=a.id)
        order by a.starts_at limit 200`,
        [campgroundId],
      ),
      client.query(
        `select q.* from icamp_private.staff_shift_qualification_events q
        where q.campground_id=$1 order by q.reviewed_at desc,q.id desc limit 400`,
        [campgroundId],
      ),
      client.query(
        `select h.* from icamp_private.staff_shift_handoffs h where h.campground_id=$1
        and h.recorded_at>statement_timestamp()-interval '90 days' order by h.recorded_at desc limit 100`,
        [campgroundId],
      ),
      client.query(
        `select e.* from icamp_private.staff_shift_events e where e.campground_id=$1
        and e.recorded_at>statement_timestamp()-interval '90 days' order by e.recorded_at desc limit 200`,
        [campgroundId],
      ),
    ]);
    const shifts = shiftsResult.rows.map(mapShift);
    const availability = availabilityResult.rows.map(mapAvailability);
    const qualificationHistory = qualificationResult.rows.map(mapQualification);
    const latest = [];
    const seen = new Set();
    for (const q of qualificationHistory) {
      const key = q.staffUserId + ":" + q.qualificationKey;
      if (!seen.has(key)) {
        seen.add(key);
        latest.push(q);
      }
    }
    const handoffs = handoffResult.rows.map(mapHandoff);
    const events = eventResult.rows.map(mapEvent);
    return {
      asOf: new Date().toISOString(),
      campground: {
        id: campground.id,
        name: campground.name,
        timezone: campground.timezone,
      },
      permissions,
      roster: roster.rows.map((row) => ({ id: row.user_id, label: row.label })),
      shifts: shifts.map((shift) => ({
        ...shift,
        readiness: assessShiftReadiness(shift, shifts, latest, availability),
      })),
      availability,
      qualifications: latest,
      handoffs,
      events,
      handoffReadiness: handoffs.map((h) => ({
        handoffId: h.id,
        acknowledged: events.some(
          (e) => e.kind === "handoff_ack" && e.handoffId === h.id,
        ),
        requiresReview:
          !h.toShiftId ||
          !events.some((e) => e.kind === "handoff_ack" && e.handoffId === h.id),
      })),
    };
  });
}

export async function createStaffShift({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  input,
}) {
  const s = normalizeShiftPlan(input);
  return write(
    {
      actorUserId,
      actorSessionId,
      campgroundId,
      permissionKey: "schedule.manage",
      actionKey: "staff.shift.plan",
      subjectType: "staff.shift",
    },
    async (client, camp) => {
      await client.query(
        `insert into icamp_private.staff_shift_assignments
        (id,organization_id,campground_id,staff_user_id,department,role_label,starts_at,ends_at,assignment_note,created_by_user_id)
        values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          s.id,
          camp.organization_id,
          camp.id,
          s.staffUserId,
          s.department,
          s.roleLabel,
          s.startsAt,
          s.endsAt,
          s.assignmentNote,
          actorUserId,
        ],
      );
      return {
        id: s.id,
        auditMetadata: {
          department: s.department,
          staffUserId: s.staffUserId,
          startsAt: s.startsAt,
          endsAt: s.endsAt,
        },
      };
    },
  );
}
export async function recordStaffAvailability({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  input,
}) {
  const a = normalizeShiftAvailability(input);
  if (a.staffUserId !== actorUserId)
    throw new Error("Only your own availability may be recorded.");
  return write(
    {
      actorUserId,
      actorSessionId,
      campgroundId,
      permissionKey: "staff.shift.self",
      actionKey: "staff.shift.availability",
      subjectType: "staff.availability",
    },
    async (client, camp) => {
      await client.query(
        `insert into icamp_private.staff_shift_availability
        (id,organization_id,campground_id,staff_user_id,kind,starts_at,ends_at,clears_event_id,reason,recorded_by_user_id)
        values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          a.id,
          camp.organization_id,
          camp.id,
          a.staffUserId,
          a.kind,
          a.startsAt,
          a.endsAt,
          a.clearsEventId,
          a.reason,
          actorUserId,
        ],
      );
      return {
        id: a.id,
        auditMetadata: {
          kind: a.kind,
          staffUserId: a.staffUserId,
          clearsEventId: a.clearsEventId,
        },
      };
    },
  );
}
export async function recordStaffQualification({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  input,
}) {
  const q = normalizeShiftQualification(input);
  if (q.staffUserId === actorUserId)
    throw new Error("Qualifications require an independent manager.");
  return write(
    {
      actorUserId,
      actorSessionId,
      campgroundId,
      permissionKey: "staff.manage",
      actionKey: "staff.shift.qualification",
      subjectType: "staff.qualification",
    },
    async (client, camp) => {
      await client.query(
        `insert into icamp_private.staff_shift_qualification_events
        (id,organization_id,campground_id,staff_user_id,qualification_key,decision,source_reference,valid_until,review_note,reviewed_by_user_id)
        values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          q.id,
          camp.organization_id,
          camp.id,
          q.staffUserId,
          q.qualificationKey,
          q.decision,
          q.sourceReference,
          q.validUntil,
          q.reviewNote,
          actorUserId,
        ],
      );
      return {
        id: q.id,
        auditMetadata: {
          staffUserId: q.staffUserId,
          qualificationKey: q.qualificationKey,
          decision: q.decision,
          validUntil: q.validUntil,
        },
      };
    },
  );
}
export async function recordStaffHandoff({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  input,
}) {
  const h = normalizeShiftHandoff(input);
  const permissions = await getStaffShiftPermissions(actorUserId, campgroundId);
  if (!permissions.self && !permissions.manage)
    throw new Error("No handoff permission.");
  return write(
    {
      actorUserId,
      actorSessionId,
      campgroundId,
      permissionKey: permissions.self ? "staff.shift.self" : "schedule.manage",
      actionKey: "staff.shift.handoff",
      subjectType: "staff.handoff",
    },
    async (client, camp) => {
      await client.query(
        `insert into icamp_private.staff_shift_handoffs
        (id,organization_id,campground_id,from_shift_id,to_shift_id,summary,outstanding_work,follow_up_required,recorded_by_user_id)
        values($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          h.id,
          camp.organization_id,
          camp.id,
          h.fromShiftId,
          h.toShiftId,
          h.summary,
          h.outstandingWork,
          h.followUpRequired,
          actorUserId,
        ],
      );
      return {
        id: h.id,
        auditMetadata: {
          fromShiftId: h.fromShiftId,
          toShiftId: h.toShiftId,
          followUpRequired: h.followUpRequired,
        },
      };
    },
  );
}
export async function recordStaffShiftEvent({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  input,
}) {
  const event = normalizeShiftEvent(input);
  const permissionKey =
    event.kind === "cancel" ? "schedule.manage" : "staff.shift.self";
  return write(
    {
      actorUserId,
      actorSessionId,
      campgroundId,
      permissionKey,
      actionKey: "staff.shift." + event.kind,
      subjectType: "staff.shift.event",
    },
    async (client, camp) => {
      await client.query(
        `insert into icamp_private.staff_shift_events
        (id,organization_id,campground_id,shift_id,handoff_id,kind,reason,actor_user_id)
        values($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          event.id,
          camp.organization_id,
          camp.id,
          event.shiftId,
          event.handoffId,
          event.kind,
          event.reason,
          actorUserId,
        ],
      );
      return {
        id: event.id,
        auditMetadata: {
          shiftId: event.shiftId,
          handoffId: event.handoffId,
          kind: event.kind,
        },
      };
    },
  );
}
