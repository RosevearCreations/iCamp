import pg from "pg";

import { appendAuditEvent } from "../audit/postgres.mjs";
import { hasCampgroundPermission } from "../authz/postgres.mjs";
import {
  normalizeAssistanceClosure,
  normalizeAssistanceEscalation,
  normalizeAssistanceGuestMessage,
  normalizeAssistanceTriage,
} from "./core.mjs";

const { Pool } = pg;
let pool;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

const ASSISTANCE_PERMISSIONS = [
  "assistance.triage",
  "assistance.escalate",
  "assistance.communicate",
  "assistance.close",
  "campground.operations.manage",
];

function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL?.trim();
    if (!connectionString) {
      throw new Error("DATABASE_URL is required for assistance triage.");
    }
    pool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
  }
  return pool;
}

export async function closeAssistanceTriagePoolForTests() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

function uuid(value, label) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  if (!UUID_PATTERN.test(normalized)) {
    throw new Error(label + " must be a UUID.");
  }
  return normalized;
}

function iso(value) {
  return value == null ? null : new Date(value).toISOString();
}

function integer(value, label) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) {
    throw new Error(label + " must be a positive integer.");
  }
  return number;
}

async function assertPermission(userId, campgroundId, permission) {
  const allowed =
    (await hasCampgroundPermission(userId, campgroundId, permission)) ||
    (permission !== "campground.operations.manage" &&
      (await hasCampgroundPermission(
        userId,
        campgroundId,
        "campground.operations.manage",
      )));
  if (!allowed) throw new Error("Not authorized for " + permission + ".");
}

async function assertQueueAccess(userId, campgroundId) {
  const results = await Promise.all(
    ASSISTANCE_PERMISSIONS.map((permission) =>
      hasCampgroundPermission(userId, campgroundId, permission),
    ),
  );
  if (!results.some(Boolean)) {
    throw new Error("Not authorized to view camper assistance.");
  }
}

async function beginRls(client, userId) {
  await client.query("set local role icamp_app");
  await client.query("select set_config('icamp.user_id',$1,true)", [userId]);
}

function mapCase(row) {
  return {
    id: row.id,
    organizationId: row.organization_id,
    campgroundId: row.campground_id,
    requestId: row.request_id,
    reservationId: row.reservation_id,
    accommodationId: row.accommodation_id,
    accommodationCode: row.accommodation_code,
    accommodationName: row.accommodation_name,
    guestUserId: row.guest_user_id,
    guestEmail: row.guest_email,
    submittedCategory: row.submitted_category,
    submittedSeverity: row.submitted_severity,
    category: row.operational_category,
    severity: row.operational_severity,
    summary: row.summary,
    details: row.details ?? null,
    contactPreference: row.contact_preference,
    submittedAt: iso(row.submitted_at),
    caseState: row.case_state,
    assignedToUserId: row.assigned_to_user_id ?? null,
    assignedToLabel: row.assigned_to_label ?? null,
    escalationLevel: row.escalation_level,
    outcomeCode: row.outcome_code ?? null,
    outcomeSummary: row.outcome_summary ?? null,
    closedAt: iso(row.closed_at),
    updatedAt: iso(row.updated_at),
    rowVersion: Number(row.row_version),
    mediaCount: Number(row.media_count ?? 0),
    activeEscalationId: row.active_escalation_id ?? null,
    activeEscalationState: row.active_escalation_state ?? null,
    activeEscalationLevel: row.active_escalation_level ?? null,
    activeEscalationRowVersion:
      row.active_escalation_row_version == null
        ? null
        : Number(row.active_escalation_row_version),
  };
}

function mapEvent(row) {
  return {
    id: row.id,
    caseId: row.case_id,
    eventKind: row.event_kind,
    actorUserId: row.actor_user_id,
    actorLabel: row.actor_label,
    sourceChannel: row.source_channel,
    contactChannel: row.contact_channel ?? null,
    guestVisible: row.guest_visible === true,
    summary: row.summary,
    metadata: row.metadata ?? {},
    occurredAt: iso(row.occurred_at),
  };
}

function mapEscalation(row) {
  return {
    id: row.id,
    caseId: row.case_id,
    escalationLevel: row.escalation_level,
    state: row.state,
    reason: row.reason,
    raisedByUserId: row.raised_by_user_id,
    raisedByLabel: row.raised_by_label,
    raisedAt: iso(row.raised_at),
    acknowledgedByUserId: row.acknowledged_by_user_id ?? null,
    acknowledgedAt: iso(row.acknowledged_at),
    resolutionNote: row.resolution_note ?? null,
    resolvedByUserId: row.resolved_by_user_id ?? null,
    resolvedAt: iso(row.resolved_at),
    rowVersion: Number(row.row_version),
  };
}

async function lockedCase(client, campgroundId, caseId) {
  const result = await client.query(
    `select *
     from public.camper_assistance_cases
     where id=$1 and campground_id=$2
     limit 1
     for update`,
    [caseId, campgroundId],
  );
  const row = result.rows[0];
  if (!row) throw new Error("Assistance case was not found.");
  if (row.case_state === "closed") {
    throw new Error("Closed assistance cases are terminal.");
  }
  return row;
}

async function validateAssignedStaff(client, campgroundId, userId) {
  if (!userId) return;
  const result = await client.query(
    `select 1
     from icamp_private.campground_assignments a
     join icamp_private.user_accounts u on u.id=a.user_id
     where a.user_id=$1
       and a.campground_id=$2
       and a.assignment_state='active'
       and a.starts_at <= statement_timestamp()
       and (a.ends_at is null or a.ends_at > statement_timestamp())
       and u.account_type='staff'
       and u.account_state='active'
     limit 1`,
    [userId, campgroundId],
  );
  if (result.rowCount !== 1) {
    throw new Error("Assigned staff member is not active at this campground.");
  }
}

export async function listAssistanceQueue(userId, campgroundId) {
  await assertQueueAccess(userId, campgroundId);
  const cases = await getPool().query(
    `select
       c.*,
       r.reservation_id,
       r.accommodation_id,
       r.guest_user_id,
       r.category submitted_category,
       r.severity submitted_severity,
       r.summary,
       r.details,
       r.contact_preference,
       r.submitted_at,
       a.code accommodation_code,
       a.display_name accommodation_name,
       guest.email_normalized guest_email,
       assigned.email_normalized assigned_to_label,
       (
         select count(*)::integer
         from public.camper_assistance_request_media m
         where m.request_id=r.id
       ) media_count,
       active.id active_escalation_id,
       active.state active_escalation_state,
       active.escalation_level active_escalation_level,
       active.row_version active_escalation_row_version
     from public.camper_assistance_cases c
     join public.camper_assistance_requests r
       on r.id=c.request_id
      and r.organization_id=c.organization_id
      and r.campground_id=c.campground_id
     join public.accommodations a
       on a.id=r.accommodation_id
      and a.organization_id=r.organization_id
      and a.campground_id=r.campground_id
     join icamp_private.user_accounts guest on guest.id=r.guest_user_id
     left join icamp_private.user_accounts assigned
       on assigned.id=c.assigned_to_user_id
     left join lateral (
       select e.id,e.state,e.escalation_level,e.row_version
       from public.camper_assistance_escalations e
       where e.case_id=c.id
         and e.state in ('open','acknowledged')
       order by e.raised_at desc
       limit 1
     ) active on true
     where c.campground_id=$1
     order by
       case when c.case_state='closed' then 1 else 0 end,
       case c.operational_severity
         when 'urgent' then 0
         when 'soon' then 1
         else 2
       end,
       r.submitted_at asc`,
    [campgroundId],
  );

  const caseIds = cases.rows.map((row) => row.id);
  const events =
    caseIds.length === 0
      ? { rows: [] }
      : await getPool().query(
          `select e.*,u.email_normalized actor_label
           from public.camper_assistance_case_events e
           join icamp_private.user_accounts u on u.id=e.actor_user_id
           where e.case_id = any($1::uuid[])
           order by e.occurred_at desc`,
          [caseIds],
        );
  const escalations =
    caseIds.length === 0
      ? { rows: [] }
      : await getPool().query(
          `select e.*,u.email_normalized raised_by_label
           from public.camper_assistance_escalations e
           join icamp_private.user_accounts u on u.id=e.raised_by_user_id
           where e.case_id = any($1::uuid[])
           order by e.raised_at desc`,
          [caseIds],
        );

  const staff = await getPool().query(
    `select
       a.user_id,
       u.email_normalized,
       coalesce(
         array_agg(distinct r.role_code order by r.role_code)
           filter (where r.role_code is not null),
         '{}'::text[]
       ) role_codes
     from icamp_private.campground_assignments a
     join icamp_private.user_accounts u
       on u.id=a.user_id
      and u.account_type='staff'
      and u.account_state='active'
     left join icamp_private.campground_assignment_roles ar
       on ar.assignment_id=a.id
     left join icamp_private.roles r
       on r.id=ar.role_id
      and r.lifecycle_state='active'
     where a.campground_id=$1
       and a.assignment_state='active'
       and a.starts_at <= statement_timestamp()
       and (a.ends_at is null or a.ends_at > statement_timestamp())
     group by a.user_id,u.email_normalized
     order by u.email_normalized`,
    [campgroundId],
  );

  const eventMap = new Map();
  for (const row of events.rows) {
    if (!eventMap.has(row.case_id)) eventMap.set(row.case_id, []);
    eventMap.get(row.case_id).push(mapEvent(row));
  }
  const escalationMap = new Map();
  for (const row of escalations.rows) {
    if (!escalationMap.has(row.case_id)) escalationMap.set(row.case_id, []);
    escalationMap.get(row.case_id).push(mapEscalation(row));
  }

  return {
    cases: cases.rows.map((row) => ({
      ...mapCase(row),
      events: eventMap.get(row.id) ?? [],
      escalations: escalationMap.get(row.id) ?? [],
    })),
    staff: staff.rows.map((row) => ({
      userId: row.user_id,
      label: row.email_normalized,
      roleCodes: row.role_codes ?? [],
    })),
  };
}

export async function triageAssistanceCase({
  actorUserId,
  actorSessionId = null,
  campgroundId: rawCampgroundId,
  caseId: rawCaseId,
  expectedRowVersion,
  category,
  severity,
  assignedToUserId,
  note,
}) {
  const campgroundId = uuid(rawCampgroundId, "Campground id");
  const caseId = uuid(rawCaseId, "Assistance case id");
  const expected = integer(expectedRowVersion, "Expected case row version");
  const input = normalizeAssistanceTriage({
    category,
    severity,
    assignedToUserId,
    note,
  });
  await assertPermission(actorUserId, campgroundId, "assistance.triage");
  const client = await getPool().connect();

  try {
    await client.query("begin");
    const before = await lockedCase(client, campgroundId, caseId);
    if (Number(before.row_version) !== expected) {
      throw new Error("Assistance case changed; refresh before triaging.");
    }
    await validateAssignedStaff(client, campgroundId, input.assignedToUserId);

    const nextState =
      before.case_state === "escalated"
        ? "escalated"
        : input.assignedToUserId
          ? "assigned"
          : "triaged";

    await beginRls(client, actorUserId);
    const updated = await client.query(
      `update public.camper_assistance_cases
       set operational_category=$1,
           operational_severity=$2,
           assigned_to_user_id=$3,
           case_state=$4,
           updated_by_user_id=$5
       where id=$6 and campground_id=$7 and row_version=$8
       returning *`,
      [
        input.category,
        input.severity,
        input.assignedToUserId,
        nextState,
        actorUserId,
        caseId,
        campgroundId,
        expected,
      ],
    );
    if (updated.rowCount !== 1) {
      throw new Error("Assistance case changed; refresh before triaging.");
    }

    await client.query(
      `insert into public.camper_assistance_case_events (
         organization_id,campground_id,case_id,event_kind,actor_user_id,
         source_channel,guest_visible,summary,metadata
       ) values ($1,$2,$3,'triaged',$4,'web',false,$5,$6::jsonb)`,
      [
        before.organization_id,
        campgroundId,
        caseId,
        actorUserId,
        input.note,
        JSON.stringify({
          fromCategory: before.operational_category,
          toCategory: input.category,
          fromSeverity: before.operational_severity,
          toSeverity: input.severity,
        }),
      ],
    );

    if ((before.assigned_to_user_id ?? null) !== input.assignedToUserId) {
      await client.query(
        `insert into public.camper_assistance_case_events (
           organization_id,campground_id,case_id,event_kind,actor_user_id,
           source_channel,guest_visible,summary,metadata
         ) values ($1,$2,$3,'assigned',$4,'web',false,$5,$6::jsonb)`,
        [
          before.organization_id,
          campgroundId,
          caseId,
          actorUserId,
          input.assignedToUserId
            ? "Assistance case assignment updated."
            : "Assistance case assignment cleared.",
          JSON.stringify({
            fromAssignedToUserId: before.assigned_to_user_id ?? null,
            toAssignedToUserId: input.assignedToUserId,
          }),
        ],
      );
    }

    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: before.organization_id,
      campgroundId,
      actionKey: "camper_assistance.case.triage",
      permissionKey: "assistance.triage",
      riskLevel: "elevated",
      outcome: "succeeded",
      reason: input.note,
      subjectType: "camper_assistance.case",
      subjectId: caseId,
      beforeState: {
        category: before.operational_category,
        severity: before.operational_severity,
        assignedToUserId: before.assigned_to_user_id ?? null,
        caseState: before.case_state,
        rowVersion: Number(before.row_version),
      },
      afterState: {
        category: input.category,
        severity: input.severity,
        assignedToUserId: input.assignedToUserId,
        caseState: nextState,
        rowVersion: Number(updated.rows[0].row_version),
      },
    });

    await client.query("commit");
    return mapCase(updated.rows[0]);
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function addAssistanceStaffNote({
  actorUserId,
  actorSessionId = null,
  campgroundId: rawCampgroundId,
  caseId: rawCaseId,
  note,
}) {
  const campgroundId = uuid(rawCampgroundId, "Campground id");
  const caseId = uuid(rawCaseId, "Assistance case id");
  const summary = String(note ?? "").trim();
  if (summary.length < 3 || summary.length > 2000) {
    throw new Error("Staff note must be between 3 and 2000 characters.");
  }
  await assertPermission(actorUserId, campgroundId, "assistance.triage");
  const client = await getPool().connect();

  try {
    await client.query("begin");
    const current = await lockedCase(client, campgroundId, caseId);
    await beginRls(client, actorUserId);
    const event = await client.query(
      `insert into public.camper_assistance_case_events (
         organization_id,campground_id,case_id,event_kind,actor_user_id,
         source_channel,guest_visible,summary
       ) values ($1,$2,$3,'staff_note',$4,'web',false,$5)
       returning id,occurred_at`,
      [current.organization_id, campgroundId, caseId, actorUserId, summary],
    );
    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: current.organization_id,
      campgroundId,
      actionKey: "camper_assistance.case.note",
      permissionKey: "assistance.triage",
      riskLevel: "standard",
      outcome: "succeeded",
      reason: "Internal assistance case note.",
      subjectType: "camper_assistance.case",
      subjectId: caseId,
      metadata: { eventId: event.rows[0].id, noteBodyExcluded: true },
    });
    await client.query("commit");
    return { id: event.rows[0].id, occurredAt: iso(event.rows[0].occurred_at) };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function recordAssistanceGuestMessage({
  actorUserId,
  actorSessionId = null,
  campgroundId: rawCampgroundId,
  caseId: rawCaseId,
  channel,
  message,
}) {
  const campgroundId = uuid(rawCampgroundId, "Campground id");
  const caseId = uuid(rawCaseId, "Assistance case id");
  const input = normalizeAssistanceGuestMessage({ channel, message });
  await assertPermission(actorUserId, campgroundId, "assistance.communicate");
  const client = await getPool().connect();

  try {
    await client.query("begin");
    const current = await lockedCase(client, campgroundId, caseId);
    await beginRls(client, actorUserId);
    const event = await client.query(
      `insert into public.camper_assistance_case_events (
         organization_id,campground_id,case_id,event_kind,actor_user_id,
         source_channel,contact_channel,guest_visible,summary,metadata
       ) values ($1,$2,$3,'guest_message',$4,'web',$5,true,$6,$7::jsonb)
       returning id,occurred_at`,
      [
        current.organization_id,
        campgroundId,
        caseId,
        actorUserId,
        input.channel,
        input.message,
        JSON.stringify({
          deliveryMode:
            input.channel === "in_app"
              ? "in_app_record"
              : "staff_contact_record",
          externalDispatchClaimed: false,
        }),
      ],
    );
    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: current.organization_id,
      campgroundId,
      actionKey: "camper_assistance.case.guest_message",
      permissionKey: "assistance.communicate",
      riskLevel: "standard",
      outcome: "succeeded",
      reason: "Guest assistance communication recorded.",
      subjectType: "camper_assistance.case",
      subjectId: caseId,
      metadata: {
        eventId: event.rows[0].id,
        channel: input.channel,
        messageBodyExcluded: true,
        externalDispatchClaimed: false,
      },
    });
    await client.query("commit");
    return { id: event.rows[0].id, occurredAt: iso(event.rows[0].occurred_at) };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function escalateAssistanceCase({
  actorUserId,
  actorSessionId = null,
  campgroundId: rawCampgroundId,
  caseId: rawCaseId,
  expectedRowVersion,
  level,
  reason,
}) {
  const campgroundId = uuid(rawCampgroundId, "Campground id");
  const caseId = uuid(rawCaseId, "Assistance case id");
  const expected = integer(expectedRowVersion, "Expected case row version");
  const input = normalizeAssistanceEscalation({ level, reason });
  await assertPermission(actorUserId, campgroundId, "assistance.escalate");
  const client = await getPool().connect();

  try {
    await client.query("begin");
    const before = await lockedCase(client, campgroundId, caseId);
    if (Number(before.row_version) !== expected) {
      throw new Error("Assistance case changed; refresh before escalating.");
    }
    const active = await client.query(
      `select 1
       from public.camper_assistance_escalations
       where case_id=$1 and state in ('open','acknowledged')
       limit 1`,
      [caseId],
    );
    if (active.rowCount > 0) {
      throw new Error("This assistance case already has an active escalation.");
    }

    await beginRls(client, actorUserId);
    const escalation = await client.query(
      `insert into public.camper_assistance_escalations (
         organization_id,campground_id,case_id,escalation_level,reason,
         raised_by_user_id
       ) values ($1,$2,$3,$4,$5,$6)
       returning *`,
      [
        before.organization_id,
        campgroundId,
        caseId,
        input.level,
        input.reason,
        actorUserId,
      ],
    );
    const updated = await client.query(
      `update public.camper_assistance_cases
       set case_state='escalated',
           escalation_level=$1,
           updated_by_user_id=$2
       where id=$3 and campground_id=$4 and row_version=$5
       returning *`,
      [input.level, actorUserId, caseId, campgroundId, expected],
    );
    if (updated.rowCount !== 1) {
      throw new Error("Assistance case changed; refresh before escalating.");
    }
    await client.query(
      `insert into public.camper_assistance_case_events (
         organization_id,campground_id,case_id,event_kind,actor_user_id,
         source_channel,guest_visible,summary,metadata
       ) values ($1,$2,$3,'escalated',$4,'web',false,$5,$6::jsonb)`,
      [
        before.organization_id,
        campgroundId,
        caseId,
        actorUserId,
        input.reason,
        JSON.stringify({
          escalationId: escalation.rows[0].id,
          escalationLevel: input.level,
        }),
      ],
    );
    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: before.organization_id,
      campgroundId,
      actionKey: "camper_assistance.case.escalate",
      permissionKey: "assistance.escalate",
      riskLevel: "elevated",
      outcome: "succeeded",
      reason: input.reason,
      subjectType: "camper_assistance.case",
      subjectId: caseId,
      beforeState: {
        caseState: before.case_state,
        escalationLevel: before.escalation_level,
      },
      afterState: {
        caseState: "escalated",
        escalationLevel: input.level,
        escalationId: escalation.rows[0].id,
      },
    });
    await client.query("commit");
    return {
      case: mapCase(updated.rows[0]),
      escalation: mapEscalation({
        ...escalation.rows[0],
        raised_by_label: null,
      }),
    };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function acknowledgeAssistanceEscalation({
  actorUserId,
  actorSessionId = null,
  campgroundId: rawCampgroundId,
  caseId: rawCaseId,
  escalationId: rawEscalationId,
  expectedEscalationRowVersion,
}) {
  const campgroundId = uuid(rawCampgroundId, "Campground id");
  const caseId = uuid(rawCaseId, "Assistance case id");
  const escalationId = uuid(rawEscalationId, "Escalation id");
  const expected = integer(
    expectedEscalationRowVersion,
    "Expected escalation row version",
  );
  await assertPermission(actorUserId, campgroundId, "assistance.escalate");
  const client = await getPool().connect();

  try {
    await client.query("begin");
    const current = await lockedCase(client, campgroundId, caseId);
    await beginRls(client, actorUserId);
    const updated = await client.query(
      `update public.camper_assistance_escalations
       set state='acknowledged',
           acknowledged_by_user_id=$1,
           acknowledged_at=statement_timestamp()
       where id=$2 and case_id=$3 and campground_id=$4
         and state='open' and row_version=$5
       returning *`,
      [actorUserId, escalationId, caseId, campgroundId, expected],
    );
    if (updated.rowCount !== 1) {
      throw new Error("Escalation changed; refresh before acknowledging.");
    }
    await client.query(
      `insert into public.camper_assistance_case_events (
         organization_id,campground_id,case_id,event_kind,actor_user_id,
         source_channel,guest_visible,summary,metadata
       ) values ($1,$2,$3,'escalation_acknowledged',$4,'web',false,$5,$6::jsonb)`,
      [
        current.organization_id,
        campgroundId,
        caseId,
        actorUserId,
        "Assistance escalation acknowledged.",
        JSON.stringify({ escalationId }),
      ],
    );
    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: current.organization_id,
      campgroundId,
      actionKey: "camper_assistance.escalation.acknowledge",
      permissionKey: "assistance.escalate",
      riskLevel: "elevated",
      outcome: "succeeded",
      reason: "Assistance escalation acknowledged.",
      subjectType: "camper_assistance.escalation",
      subjectId: escalationId,
    });
    await client.query("commit");
    return mapEscalation({ ...updated.rows[0], raised_by_label: null });
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function resolveAssistanceEscalation({
  actorUserId,
  actorSessionId = null,
  campgroundId: rawCampgroundId,
  caseId: rawCaseId,
  escalationId: rawEscalationId,
  expectedCaseRowVersion,
  expectedEscalationRowVersion,
  resolutionNote,
}) {
  const campgroundId = uuid(rawCampgroundId, "Campground id");
  const caseId = uuid(rawCaseId, "Assistance case id");
  const escalationId = uuid(rawEscalationId, "Escalation id");
  const caseExpected = integer(
    expectedCaseRowVersion,
    "Expected case row version",
  );
  const escalationExpected = integer(
    expectedEscalationRowVersion,
    "Expected escalation row version",
  );
  const note = String(resolutionNote ?? "").trim();
  if (note.length < 3 || note.length > 2000) {
    throw new Error(
      "Escalation resolution must be between 3 and 2000 characters.",
    );
  }
  await assertPermission(actorUserId, campgroundId, "assistance.escalate");
  const client = await getPool().connect();

  try {
    await client.query("begin");
    const current = await lockedCase(client, campgroundId, caseId);
    if (Number(current.row_version) !== caseExpected) {
        throw new Error(
        "Assistance case changed; refresh before resolving escalation.",
      );
    }
    const nextState = current.assigned_to_user_id ? "assigned" : "triaged";

    await beginRls(client, actorUserId);
    const escalation = await client.query(
      `update public.camper_assistance_escalations
       set state='resolved',
           resolution_note=$1,
           resolved_by_user_id=$2,
           resolved_at=statement_timestamp()
       where id=$3 and case_id=$4 and campground_id=$5
         and state in ('open','acknowledged')
         and row_version=$6
       returning *`,
      [
        note,
        actorUserId,
        escalationId,
        caseId,
        campgroundId,
        escalationExpected,
      ],
    );
    if (escalation.rowCount !== 1) {
      throw new Error("Escalation changed; refresh before resolving.");
    }
    const updated = await client.query(
      `update public.camper_assistance_cases
       set case_state=$1,
           escalation_level='none',
           updated_by_user_id=$2
       where id=$3 and campground_id=$4 and row_version=$5
       returning *`,
      [nextState, actorUserId, caseId, campgroundId, caseExpected],
    );
    if (updated.rowCount !== 1) {
        throw new Error(
        "Assistance case changed; refresh before resolving escalation.",
      );
    }
    await client.query(
      `insert into public.camper_assistance_case_events (
         organization_id,campground_id,case_id,event_kind,actor_user_id,
         source_channel,guest_visible,summary,metadata
       ) values ($1,$2,$3,'escalation_resolved',$4,'web',false,$5,$6::jsonb)`,
      [
        current.organization_id,
        campgroundId,
        caseId,
        actorUserId,
        note,
        JSON.stringify({ escalationId, nextState }),
      ],
    );
    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: current.organization_id,
      campgroundId,
      actionKey: "camper_assistance.escalation.resolve",
      permissionKey: "assistance.escalate",
      riskLevel: "elevated",
      outcome: "succeeded",
      reason: note,
      subjectType: "camper_assistance.escalation",
      subjectId: escalationId,
      afterState: { caseState: nextState, escalationState: "resolved" },
    });
    await client.query("commit");
    return mapCase(updated.rows[0]);
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function closeAssistanceCase({
  actorUserId,
  actorSessionId = null,
  campgroundId: rawCampgroundId,
  caseId: rawCaseId,
  expectedRowVersion,
  outcomeCode,
  outcomeSummary,
}) {
  const campgroundId = uuid(rawCampgroundId, "Campground id");
  const caseId = uuid(rawCaseId, "Assistance case id");
  const expected = integer(expectedRowVersion, "Expected case row version");
  const input = normalizeAssistanceClosure({ outcomeCode, outcomeSummary });
  await assertPermission(actorUserId, campgroundId, "assistance.close");
  const client = await getPool().connect();

  try {
    await client.query("begin");
    const before = await lockedCase(client, campgroundId, caseId);
    if (Number(before.row_version) !== expected) {
      throw new Error("Assistance case changed; refresh before closing.");
    }
    const active = await client.query(
      `select 1
       from public.camper_assistance_escalations
       where case_id=$1 and state in ('open','acknowledged')
       limit 1`,
      [caseId],
    );
    if (active.rowCount > 0) {
      throw new Error(
        "Resolve the active management escalation before closing.",
      );
    }

    await beginRls(client, actorUserId);
    const updated = await client.query(
      `update public.camper_assistance_cases
       set case_state='closed',
           escalation_level='none',
           outcome_code=$1,
           outcome_summary=$2,
           updated_by_user_id=$3,
           closed_by_user_id=$3,
           closed_at=statement_timestamp()
       where id=$4 and campground_id=$5 and row_version=$6
       returning *`,
      [
        input.outcomeCode,
        input.outcomeSummary,
        actorUserId,
        caseId,
        campgroundId,
        expected,
      ],
    );
    if (updated.rowCount !== 1) {
      throw new Error("Assistance case changed; refresh before closing.");
    }
    await client.query(
      `insert into public.camper_assistance_case_events (
         organization_id,campground_id,case_id,event_kind,actor_user_id,
         source_channel,guest_visible,summary,metadata
       ) values ($1,$2,$3,'closed',$4,'web',true,$5,$6::jsonb)`,
      [
        before.organization_id,
        campgroundId,
        caseId,
        actorUserId,
        input.outcomeSummary,
        JSON.stringify({ outcomeCode: input.outcomeCode }),
      ],
    );
    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: before.organization_id,
      campgroundId,
      actionKey: "camper_assistance.case.close",
      permissionKey: "assistance.close",
      riskLevel: "elevated",
      outcome: "succeeded",
      reason: input.outcomeSummary,
      subjectType: "camper_assistance.case",
      subjectId: caseId,
      beforeState: {
        caseState: before.case_state,
        rowVersion: Number(before.row_version),
      },
      afterState: {
        caseState: "closed",
        outcomeCode: input.outcomeCode,
        outcomeSummary: input.outcomeSummary,
        rowVersion: Number(updated.rows[0].row_version),
      },
    });
    await client.query("commit");
    return mapCase(updated.rows[0]);
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function listGuestAssistanceUpdates({
  userId,
  reservationId: rawReservationId,
}) {
  const reservationId = uuid(rawReservationId, "Reservation id");
  const account = await getPool().query(
    `select 1
     from icamp_private.user_accounts
     where id=$1 and account_type='guest' and account_state='active'
     limit 1`,
    [userId],
  );
  if (account.rowCount !== 1) {
    throw new Error("An active guest account is required.");
  }

  const result = await getPool().query(
    `select
       r.id request_id,
       c.case_state,
       c.operational_category,
       c.operational_severity,
       c.outcome_code,
       c.outcome_summary,
       c.closed_at,
       e.id event_id,
       e.event_kind,
       e.contact_channel,
       e.summary event_summary,
       e.occurred_at
     from public.camper_assistance_requests r
     join public.camper_assistance_cases c on c.request_id=r.id
     left join public.camper_assistance_case_events e
       on e.case_id=c.id
      and e.guest_visible=true
     where r.guest_user_id=$1
       and r.reservation_id=$2
     order by r.submitted_at desc,e.occurred_at asc`,
    [userId, reservationId],
  );

  const requests = new Map();
  for (const row of result.rows) {
    if (!requests.has(row.request_id)) {
      requests.set(row.request_id, {
        requestId: row.request_id,
        caseState: row.case_state,
        category: row.operational_category,
        severity: row.operational_severity,
        outcomeCode: row.outcome_code ?? null,
        outcomeSummary: row.outcome_summary ?? null,
        closedAt: iso(row.closed_at),
        updates: [],
      });
    }
    if (row.event_id) {
      requests.get(row.request_id).updates.push({
        id: row.event_id,
        eventKind: row.event_kind,
        channel: row.contact_channel ?? null,
        summary: row.event_summary,
        occurredAt: iso(row.occurred_at),
      });
    }
  }
  return [...requests.values()];
}
