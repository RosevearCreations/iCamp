import { createHash } from "node:crypto";

import pg from "pg";

import { appendAuditEvent } from "../audit/postgres.mjs";
import { getCampgroundAuthorization } from "../authz/postgres.mjs";
import { assertMessagingDispatchAllowed } from "../consent/postgres.mjs";
import {
  authorizeContactAction,
  contactEventDigest,
  evaluateFollowup,
  planMasterHandoff,
  validateContactIntake,
} from "./build257-contact-inbox-core.mjs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const SHA = /^[0-9a-f]{64}$/u;
const ASSIGNED_ROLES = [
  "front_desk",
  "communications_reviewer",
  "campground_owner",
];
let pool;
function database() {
  if (!process.env.DATABASE_URL)
    throw new Error("Private production database required.");
  if (!pool)
    pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      max: 3,
      connectionTimeoutMillis: 4000,
    });
  return pool;
}
const hash = (input) =>
  createHash("sha256").update(input, "utf8").digest("hex");
async function authorize(actorUserId, campgroundId, permission) {
  if (
    !UUID.test(String(actorUserId ?? "")) ||
    !UUID.test(String(campgroundId ?? ""))
  )
    throw new Error("Current campground and staff identity required.");
  const grant = await getCampgroundAuthorization(actorUserId, campgroundId);
  if (!grant?.permissions?.includes(permission))
    throw new Error("Current campground communications permission required.");
  return grant;
}
async function scoped(actorUserId, work) {
  const client = await database().connect();
  try {
    await client.query("begin");
    await client.query("set local role icamp_app");
    await client.query("select set_config('icamp.user_id',$1,true)", [
      actorUserId,
    ]);
    const result = await work(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/** Use only already-ingested original provider events scoped by the canonical
 * communication dispatch and endpoint. No raw SMS, IVR digit or phone payload. */
export async function listInboundContactOrigins({ actorUserId, campgroundId }) {
  const grant = await authorize(
    actorUserId,
    campgroundId,
    "communications.manage",
  );
  const client = await database().connect();
  try {
    const rows = await client.query(
      [
        "select p.id as provider_event_id,d.endpoint_id,d.channel,",
        "p.event_type,p.occurred_at",
        "from icamp_private.communication_provider_events p",
        "join icamp_private.communication_dispatches d on d.id=p.dispatch_id",
        "join icamp_private.communication_endpoints e",
        "on e.id=d.endpoint_id and e.campground_id=d.campground_id",
        "where d.organization_id=$1 and d.campground_id=$2",
        "and d.direction='inbound' and p.channel=d.channel",
        "and d.channel in ('sms','mms','voice','dtmf','speech')",
        "and e.endpoint_kind='phone' and e.lifecycle_state='active'",
        "order by p.occurred_at desc,p.id desc limit 100",
      ].join(" "),
      [grant.organizationId, campgroundId],
    );
    return rows.rows.map((row) => ({
      id: row.provider_event_id,
      channel: row.channel,
      eventType: row.event_type,
      at: row.occurred_at.toISOString(),
    }));
  } finally {
    client.release();
  }
}

export async function createContactFromOriginal({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  providerEventId,
  contactKind,
  assignedRole = "front_desk",
}) {
  const grant = await authorize(
    actorUserId,
    campgroundId,
    "communications.manage",
  );
  if (!UUID.test(String(providerEventId ?? "")))
    throw new Error("Original inbound provider event ID required.");
  if (!ASSIGNED_ROLES.includes(assignedRole))
    throw new Error("Known local staff role required.");
  if (
    assignedRole === "campground_owner" &&
    !grant.roleCodes.includes("owner_admin")
  )
    throw new Error("Only current owner may reserve owner-only contact tasks.");
  const poolClient = await database().connect();
  let source;
  try {
    const result = await poolClient.query(
      [
        "select p.id,p.provider_key,p.provider_event_id,d.endpoint_id,",
        "d.channel,d.purpose",
        "from icamp_private.communication_provider_events p",
        "join icamp_private.communication_dispatches d on d.id=p.dispatch_id",
        "join icamp_private.communication_endpoints e",
        "on e.id=d.endpoint_id and e.campground_id=d.campground_id",
        "where p.id=$1 and d.organization_id=$2 and d.campground_id=$3",
        "and d.direction='inbound' and p.channel=d.channel",
        "and e.endpoint_kind='phone' and e.lifecycle_state='active'",
        "limit 1",
      ].join(" "),
      [providerEventId, grant.organizationId, campgroundId],
    );
    source = result.rows[0];
  } finally {
    poolClient.release();
  }
  const checked = validateContactIntake({
    channel: source?.channel,
    contactKind,
    purpose: source?.purpose,
  });
  if (!checked.valid) throw new Error(checked.reason);
  const eventDigest = contactEventDigest({
    campgroundId,
    providerKey: source.provider_key,
    providerEventId: source.provider_event_id,
  });
  return scoped(actorUserId, async (client) => {
    const inserted = await client.query(
      [
        "insert into public.icamp_contact_inbox257",
        "(organization_id,campground_id,endpoint_id,provider_event_id,",
        "event_digest_sha256,channel,contact_kind,purpose,assigned_role,",
        "protocol_version,created_by_user_id)",
        "values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'1.1',$10)",
        "on conflict (campground_id,provider_event_id) do nothing",
        "returning id",
      ].join(" "),
      [
        grant.organizationId,
        campgroundId,
        source.endpoint_id,
        source.id,
        eventDigest,
        checked.channel,
        checked.contactKind,
        checked.purpose,
        assignedRole,
        actorUserId,
      ],
    );
    if (inserted.rowCount === 0) {
      return {
        status: "ALREADY_QUEUED_IDEMPOTENT",
        remoteDelivery: false,
      };
    }
    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: grant.organizationId,
      campgroundId,
      actionKey: "communications.contact_original_intake257",
      permissionKey: "communications.manage",
      riskLevel: "elevated",
      outcome: "succeeded",
      subjectType: "icamp_contact_inbox257",
      subjectId: inserted.rows[0].id,
      afterState: {
        sourceKind: checked.channel,
        assignedRole,
        sourceOnly: true,
      },
      metadata: {
        customerPiiExcluded: true,
        providerMessageExcluded: true,
      },
    });
    return {
      status: "LOCAL_CONTACT_TASK_CREATED",
      id: inserted.rows[0].id,
      remoteDelivery: false,
    };
  });
}

export async function listContactTasks({ actorUserId, campgroundId }) {
  await authorize(actorUserId, campgroundId, "communications.read");
  return scoped(actorUserId, async (client) => {
    const [tasks, holds] = await Promise.all([
      client.query(
        [
          "select i.id,i.channel,i.contact_kind,i.purpose,i.assigned_role,",
          "i.created_at,i.state,",
          "a.action as latest_action,a.acted_at as latest_action_at",
          "from public.icamp_contact_inbox257 i",
          "left join lateral (select action,acted_at",
          "from public.icamp_contact_task_actions257 t",
          "where t.inbox_id=i.id order by acted_at desc,id desc limit 1) a on true",
          "where i.campground_id=$1 order by i.created_at desc,i.id desc limit 100",
        ].join(" "),
        [campgroundId],
      ),
      client.query(
        [
          "select h.id,h.target_app,h.state,h.protocol_version,h.created_at",
          "from public.icamp_contact_master_handoff257 h",
          "where h.campground_id=$1 order by h.created_at desc,h.id desc limit 50",
        ].join(" "),
        [campgroundId],
      ),
    ]);
    return {
      status: "TENANT_SCOPED_CONTACT_QUEUE",
      tasks: tasks.rows.map((row) => ({
        id: row.id,
        channel: row.channel,
        kind: row.contact_kind,
        purpose: row.purpose,
        assignedRole: row.assigned_role,
        at: row.created_at.toISOString(),
        state: row.latest_action ?? row.state,
        lastActionAt: row.latest_action_at?.toISOString() ?? null,
      })),
      holds: holds.rows.map((row) => ({
        id: row.id,
        target: row.target_app,
        state: row.state,
        protocol: row.protocol_version,
        at: row.created_at.toISOString(),
      })),
      personalDataShared: false,
      outboundSent: false,
    };
  });
}

export async function recordContactAction({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  inboxId,
  action,
}) {
  const grant = await authorize(
    actorUserId,
    campgroundId,
    "communications.read",
  );
  const permission = authorizeContactAction({
    action,
    permissions: grant.permissions,
    roleCodes: grant.roleCodes,
  });
  if (!permission.allowed) throw new Error(permission.reason);
  if (!UUID.test(String(inboxId ?? "")))
    throw new Error("Original tenant-scoped contact task required.");
  return scoped(actorUserId, async (client) => {
    const result = await client.query(
      [
        "select id,organization_id,campground_id,assigned_role",
        "from public.icamp_contact_inbox257",
        "where id=$1 and campground_id=$2",
      ].join(" "),
      [inboxId, campgroundId],
    );
    const task = result.rows[0];
    if (!task || task.organization_id !== grant.organizationId)
      throw new Error("Current tenant task unavailable.");
    if (
      task.assigned_role === "communications_reviewer" &&
      !grant.permissions.includes("communications.manage")
    )
      throw new Error("Current communications reviewer required.");
    if (
      task.assigned_role === "campground_owner" &&
      !grant.roleCodes.includes("owner_admin")
    )
      throw new Error("Current campground owner required.");
    const actionDigest = hash(
      JSON.stringify([
        "icamp.contact-action.v1",
        campgroundId,
        inboxId,
        action,
        actorUserId,
      ]),
    );
    if (!SHA.test(actionDigest)) throw new Error("Action digest unavailable.");
    const inserted = await client.query(
      [
        "insert into public.icamp_contact_task_actions257",
        "(organization_id,campground_id,inbox_id,action,",
        "action_digest_sha256,acted_by_user_id)",
        "values ($1,$2,$3,$4,$5,$6)",
        "on conflict (campground_id,action_digest_sha256) do nothing",
        "returning id",
      ].join(" "),
      [
        grant.organizationId,
        campgroundId,
        inboxId,
        action,
        actionDigest,
        actorUserId,
      ],
    );
    if (inserted.rowCount === 0)
      return { status: "ACTION_ALREADY_RECORDED", remoteDelivery: false };
    if (action === "escalate") {
      // Metadata-only HOLD. No provider dispatch, credentials, PII or ACK.
      const plan = planMasterHandoff({
        peerProtocol: "1.1",
        peerAvailable: false,
      });
      if (plan.remoteExecutionAuthorized)
        throw new Error("External delivery must remain disabled.");
      await client.query(
        [
          "insert into public.icamp_contact_master_handoff257",
          "(organization_id,campground_id,task_action_id,",
          "target_app,protocol_version,created_by_user_id)",
          "values ($1,$2,$3,'rosevear-comms-hub','1.1',$4)",
        ].join(" "),
        [grant.organizationId, campgroundId, inserted.rows[0].id, actorUserId],
      );
    }
    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: grant.organizationId,
      campgroundId,
      actionKey: "communications.contact_local_task_action257",
      permissionKey: "communications.read",
      riskLevel: "elevated",
      outcome: "succeeded",
      subjectType: "icamp_contact_task_actions257",
      subjectId: inserted.rows[0].id,
      afterState: {
        action,
        remoteDelivery: false,
        sourceOnly: true,
      },
      metadata: {
        phoneNumberExcluded: true,
        guestRecordExcluded: true,
        rawMessageExcluded: true,
      },
    });
    return {
      status:
        action === "escalate"
          ? "MASTER_HANDOFF_QUEUED_UNDELIVERED"
          : "LOCAL_CONTACT_ACTION_RECORDED",
      remoteDelivery: false,
    };
  });
}

export async function checkContactFollowup({
  actorUserId,
  campgroundId,
  inboxId,
}) {
  await authorize(actorUserId, campgroundId, "communications.read");
  if (!UUID.test(String(inboxId ?? "")))
    throw new Error("Current contact task required.");
  const rows = await scoped(actorUserId, (client) =>
    client.query(
      [
        "select endpoint_id,channel,purpose",
        "from public.icamp_contact_inbox257",
        "where id=$1 and campground_id=$2 limit 1",
      ].join(" "),
      [inboxId, campgroundId],
    ),
  );
  const task = rows.rows[0];
  if (!task) throw new Error("Current tenant contact task unavailable.");
  if (!["sms", "mms"].includes(task.channel))
    return evaluateFollowup({
      channel: task.channel,
      purpose: task.purpose,
    });
  try {
    const consent = await assertMessagingDispatchAllowed({
      campgroundId,
      endpointId: task.endpoint_id,
      purpose: task.purpose,
      channel: task.channel,
    });
    return {
      status: consent.allowed
        ? "CONSENT_GATE_CURRENT_NOT_SENT"
        : "HOLD_CONTACT_CONSENT_NOT_CURRENT",
      externalMessageSent: false,
      receiverConnected: false,
    };
  } catch {
    return {
      status: "HOLD_CONTACT_CONSENT_OR_SUPPRESSION",
      externalMessageSent: false,
      receiverConnected: false,
    };
  }
}
