import pg from "pg";

import { appendAuditEvent } from "../audit/postgres.mjs";
import { getCampgroundAuthorization } from "../authz/postgres.mjs";
import {
  independentReviewEligibility,
  incidentText,
  incidentUuid,
  normalizeIncidentIntake,
} from "./core.mjs";

const { Pool } = pg;
let pool;

function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL?.trim();
    if (!connectionString)
      throw new Error("DATABASE_URL is required for security incidents.");
    pool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
  }
  return pool;
}

export async function closeSecurityIncidentPoolForTests() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

async function assertPermission(actorUserId, campgroundId, permission) {
  const authorization = await getCampgroundAuthorization(
    actorUserId,
    campgroundId,
  );
  if (!authorization?.permissions.includes(permission)) {
    throw new Error("Not authorized for this security incident action.");
  }
  return authorization;
}

async function assertTransactionPermission(
  client,
  actorUserId,
  campgroundId,
  permission,
) {
  // Retain shared locks through commit so revocation cannot race a case write.
  const result = await client.query(
    `select 1 from icamp_private.campground_assignments a
     join icamp_private.user_accounts u on u.id=a.user_id
     join icamp_private.campground_assignment_roles ar on ar.assignment_id=a.id
     join icamp_private.roles r on r.id=ar.role_id
     join icamp_private.role_permissions rp on rp.role_id=r.id
     where a.user_id=$1 and a.campground_id=$2 and rp.permission_key=$3
       and u.account_type='staff' and u.account_state='active'
       and a.assignment_state='active' and a.starts_at<=statement_timestamp()
       and (a.ends_at is null or a.ends_at>statement_timestamp())
       and r.lifecycle_state='active'
     limit 1 for share of a,ar,r,rp`,
    [actorUserId, campgroundId, permission],
  );
  if (!result.rowCount)
    throw new Error("Security incident permission is no longer active.");
}

function mapCase(row) {
  return {
    id: row.id,
    campgroundId: row.campground_id,
    title: row.title,
    category: row.category,
    severity: row.severity,
    operationalSummary: row.operational_summary,
    status: row.status,
    linkedSignalKind: row.linked_signal_kind,
    linkedSignalId: row.linked_signal_id,
    openedByUserId: row.opened_by_user_id,
    assigneeUserId: row.assignee_user_id,
    closureRequestedByUserId: row.closure_requested_by_user_id,
    closureRound: row.closure_round,
    closedByUserId: row.closed_by_user_id,
    openedAt: new Date(row.opened_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    closedAt: row.closed_at ? new Date(row.closed_at).toISOString() : null,
    rowVersion: Number(row.row_version),
  };
}

function mapEvent(row) {
  return {
    id: row.id,
    eventKind: row.event_kind,
    actorUserId: row.actor_user_id,
    summary: row.summary,
    occurredAt: new Date(row.occurred_at).toISOString(),
  };
}

async function withTransaction(operation) {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const result = await operation(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function addEvent(client, row, actorUserId, eventKind, summary) {
  await client.query(
    `insert into icamp_private.security_incident_events
       (organization_id,campground_id,case_id,actor_user_id,event_kind,summary)
     values($1,$2,$3,$4,$5,$6)`,
    [
      row.organization_id,
      row.campground_id,
      row.id,
      actorUserId,
      eventKind,
      summary,
    ],
  );
}

async function audit(
  client,
  row,
  actorUserId,
  actorSessionId,
  actionKey,
  reason,
  metadata = {},
) {
  await appendAuditEvent(client, {
    actorUserId,
    actorSessionId,
    organizationId: row.organization_id,
    campgroundId: row.campground_id,
    actionKey,
    permissionKey: actionKey.endsWith("review")
      ? "security.incident.review"
      : "security.incident.manage",
    riskLevel: actionKey.endsWith("review") ? "elevated" : "standard",
    // Generic audit readers get the action/subject only; sensitive rationale
    // remains in the permission-restricted incident chronology and reviews.
    reason: actionKey.endsWith("review")
      ? "Independent security incident review recorded in restricted case evidence."
      : null,
    subjectType: "security.incident",
    subjectId: row.id,
    // Deliberately no witness, guest, investigation or attachment narrative in general audit.
    metadata: { ...metadata, narrativeRetainedInCase: Boolean(reason) },
  });
}

async function lockedCase(client, campgroundId, caseId, rowVersion) {
  const result = await client.query(
    `select * from icamp_private.security_incident_cases
     where campground_id=$1 and id=$2 for update`,
    [campgroundId, incidentUuid(caseId, "Case")],
  );
  const row = result.rows[0];
  if (!row)
    throw new Error("Security incident case not found in this campground.");
  if (
    rowVersion !== undefined &&
    Number(row.row_version) !== Number(rowVersion)
  ) {
    throw new Error("The case changed. Refresh before taking further action.");
  }
  return row;
}

export async function listSecurityIncidentCases({
  actorUserId,
  campgroundId,
  selectedCaseId = null,
}) {
  const auth = await getCampgroundAuthorization(actorUserId, campgroundId);
  if (
    !auth?.permissions.some((p) =>
      ["security.incident.manage", "security.incident.review"].includes(p),
    )
  ) {
    throw new Error("Not authorized to read security incident cases.");
  }
  return withTransaction(async (client) => {
    await client.query("set local role icamp_app");
    await client.query("select set_config('icamp.user_id',$1,true)", [
      actorUserId,
    ]);
    const list = await client.query(
      `select * from icamp_private.security_incident_cases
       where campground_id=$1 order by
         case status when 'escalated' then 0 when 'closure_pending' then 1 when 'investigating' then 2 when 'open' then 3 else 4 end,
         updated_at desc limit 100`,
      [campgroundId],
    );
    const cases = list.rows.map(mapCase);
    const selected =
      cases.find((item) => item.id === selectedCaseId) ?? cases[0] ?? null;
    if (!selected)
      return {
        cases,
        selected: null,
        events: [],
        reviews: [],
        attachments: [],
        sensitive: null,
        canSeeSensitive: false,
      };
    const [events, reviews] = await Promise.all([
      client.query(
        `select * from icamp_private.security_incident_events
        where campground_id=$1 and case_id=$2 order by occurred_at,id limit 200`,
        [campgroundId, selected.id],
      ),
      client.query(
        `select * from icamp_private.security_incident_closure_reviews
        where campground_id=$1 and case_id=$2 order by reviewed_at,id`,
        [campgroundId, selected.id],
      ),
    ]);
    const canSeeSensitive = auth.permissions.includes(
      "security.incident.sensitive.read",
    );
    // Media metadata is owned by the existing private media service and has no
    // icamp_app grants. Only privileged server code may join it, after the
    // staff permission and campground-scoped RLS reads have succeeded.
    await client.query("reset role");
    const [attachments, privateDetails] = canSeeSensitive
      ? await Promise.all([
          client.query(
            `select a.id,a.caption,a.attached_at,a.actor_user_id,m.original_filename,m.byte_size,m.validation_state,m.lifecycle_state
        from icamp_private.security_incident_attachments a
        join icamp_private.media_assets m on m.id=a.media_asset_id
        where a.campground_id=$1 and a.case_id=$2 order by a.attached_at`,
            [campgroundId, selected.id],
          ),
          client.query(
            `select witness_context,guest_context,updated_at
        from icamp_private.security_incident_sensitive where campground_id=$1 and case_id=$2`,
            [campgroundId, selected.id],
          ),
        ])
      : [{ rows: [] }, { rows: [] }];
    return {
      cases,
      selected,
      events: events.rows.map(mapEvent),
      reviews: reviews.rows.map((row) => ({
        id: row.id,
        closureRound: row.closure_round,
        reviewerUserId: row.reviewer_user_id,
        decision: row.decision,
        rationale: row.rationale,
        reviewedAt: new Date(row.reviewed_at).toISOString(),
      })),
      attachments: attachments.rows.map((row) => ({
        id: row.id,
        caption: row.caption,
        filename: row.original_filename,
        byteSize: Number(row.byte_size),
        lifecycleState: row.lifecycle_state,
        validationState: row.validation_state,
        actorUserId: row.actor_user_id,
        attachedAt: new Date(row.attached_at).toISOString(),
      })),
      sensitive: privateDetails.rows[0]
        ? {
            witnessContext: privateDetails.rows[0].witness_context,
            guestContext: privateDetails.rows[0].guest_context,
          }
        : null,
      canSeeSensitive,
    };
  });
}

export async function createSecurityIncidentCase({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  input,
}) {
  const auth = await assertPermission(
    actorUserId,
    campgroundId,
    "security.incident.manage",
  );
  const normalized = normalizeIncidentIntake(input);
  return withTransaction(async (client) => {
    await assertTransactionPermission(
      client,
      actorUserId,
      campgroundId,
      "security.incident.manage",
    );
    const result = await client.query(
      `insert into icamp_private.security_incident_cases
       (organization_id,campground_id,title,category,severity,operational_summary,
        linked_signal_kind,linked_signal_id,opened_by_user_id)
       values($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *`,
      [
        auth.organizationId,
        campgroundId,
        normalized.title,
        normalized.category,
        normalized.severity,
        normalized.operationalSummary,
        normalized.linkedSignalKind,
        normalized.linkedSignalId,
        actorUserId,
      ],
    );
    const row = result.rows[0];
    await addEvent(
      client,
      row,
      actorUserId,
      "intake",
      "Canonical security incident intake recorded; linked signals remain independent observations.",
    );
    await audit(
      client,
      row,
      actorUserId,
      actorSessionId,
      "security.incident.intake",
      null,
      {
        category: normalized.category,
        severity: normalized.severity,
        hasSignalLink: Boolean(normalized.linkedSignalId),
      },
    );
    return mapCase(row);
  });
}

export async function updateSecurityIncidentCase({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  caseId,
  rowVersion,
  action,
  details = "",
  assigneeUserId = null,
}) {
  await assertPermission(actorUserId, campgroundId, "security.incident.manage");
  if (
    ![
      "assign",
      "investigate",
      "escalate",
      "request_closure",
      "reopen",
    ].includes(action)
  ) {
    throw new Error("Unsupported security incident action.");
  }
  const summary = incidentText(
    details,
    "Decision / investigation chronology",
    10,
    1500,
  );
  return withTransaction(async (client) => {
    await assertTransactionPermission(
      client,
      actorUserId,
      campgroundId,
      "security.incident.manage",
    );
    const current = await lockedCase(client, campgroundId, caseId, rowVersion);
    let status = current.status;
    let eventKind = "investigated";
    let nextAssignee = current.assignee_user_id;
    let closureRound = current.closure_round;
    let requestedBy = current.closure_requested_by_user_id;
    if (action === "assign") {
      if (status === "closed" || status === "closure_pending")
        throw new Error("Reopen or return the case before assignment.");
      if (assigneeUserId) {
        const userId = incidentUuid(assigneeUserId, "Assignee");
        await assertPermission(
          userId,
          campgroundId,
          "security.incident.manage",
        );
        nextAssignee = userId;
      } else nextAssignee = null;
      eventKind = "assigned";
    } else if (action === "investigate") {
      if (!["open", "investigating", "escalated"].includes(status))
        throw new Error("The case is not open for investigation.");
      if (status === "open") status = "investigating";
    } else if (action === "escalate") {
      if (!["open", "investigating", "escalated"].includes(status))
        throw new Error("Only active cases may be escalated.");
      status = "escalated";
      eventKind = "escalated";
    } else if (action === "request_closure") {
      if (!["investigating", "escalated"].includes(status))
        throw new Error("Record investigation before requesting closure.");
      const evidence = await client.query(
        `select 1 from icamp_private.security_incident_attachments a
        join icamp_private.media_assets m on m.id=a.media_asset_id
        where a.case_id=$1 and m.lifecycle_state='active' and m.validation_state='validated' limit 1`,
        [current.id],
      );
      if (!evidence.rowCount)
        throw new Error(
          "A validated confidential attachment is required for independent closure.",
        );
      status = "closure_pending";
      closureRound += 1;
      requestedBy = actorUserId;
      eventKind = "closure_requested";
    } else if (action === "reopen") {
      if (status !== "closed")
        throw new Error("Only closed cases can be reopened.");
      status = "investigating";
      eventKind = "reopened";
      requestedBy = null;
    }
    const result = await client.query(
      `update icamp_private.security_incident_cases set
       status=$3,assignee_user_id=$4,closure_round=$5,closure_requested_by_user_id=$6,
       closed_by_user_id=null,closed_at=null
       where campground_id=$1 and id=$2 returning *`,
      [
        campgroundId,
        current.id,
        status,
        nextAssignee,
        closureRound,
        requestedBy,
      ],
    );
    const row = result.rows[0];
    await addEvent(client, row, actorUserId, eventKind, summary);
    await audit(
      client,
      row,
      actorUserId,
      actorSessionId,
      "security.incident." + action,
      summary,
      {
        fromStatus: current.status,
        toStatus: row.status,
        closureRound,
      },
    );
    return mapCase(row);
  });
}

export async function reviewSecurityIncidentClosure({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  caseId,
  rowVersion,
  decision,
  rationale,
}) {
  await assertPermission(actorUserId, campgroundId, "security.incident.review");
  if (!["approved", "returned"].includes(decision))
    throw new Error("Unknown independent review decision.");
  const summary = incidentText(
    rationale,
    "Independent review rationale",
    20,
    1500,
  );
  return withTransaction(async (client) => {
    await assertTransactionPermission(
      client,
      actorUserId,
      campgroundId,
      "security.incident.review",
    );
    const current = await lockedCase(client, campgroundId, caseId, rowVersion);
    const history = await client.query(
      `select actor_user_id,event_kind from icamp_private.security_incident_events
      where case_id=$1`,
      [current.id],
    );
    const eligibility = independentReviewEligibility(
      mapCase(current),
      actorUserId,
      history.rows.map((r) => ({
        actorUserId: r.actor_user_id,
        eventKind: r.event_kind,
      })),
    );
    if (!eligibility.eligible) throw new Error(eligibility.reason);
    await client.query(
      `insert into icamp_private.security_incident_closure_reviews
      (organization_id,campground_id,case_id,closure_round,reviewer_user_id,decision,rationale)
      values($1,$2,$3,$4,$5,$6,$7)`,
      [
        current.organization_id,
        campgroundId,
        current.id,
        current.closure_round,
        actorUserId,
        decision,
        summary,
      ],
    );
    const approved = decision === "approved";
    const result = await client.query(
      `update icamp_private.security_incident_cases
      set status=$3,closed_by_user_id=$4,closed_at=$5,closure_requested_by_user_id=$6
      where campground_id=$1 and id=$2 returning *`,
      [
        campgroundId,
        current.id,
        approved ? "closed" : "investigating",
        approved ? actorUserId : null,
        approved ? new Date() : null,
        approved ? current.closure_requested_by_user_id : null,
      ],
    );
    const row = result.rows[0];
    await addEvent(
      client,
      row,
      actorUserId,
      approved ? "closure_approved" : "closure_returned",
      summary,
    );
    await audit(
      client,
      row,
      actorUserId,
      actorSessionId,
      "security.incident.review",
      summary,
      {
        decision,
        closureRound: current.closure_round,
      },
    );
    return mapCase(row);
  });
}

export async function updateSecurityIncidentSensitive({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  caseId,
  rowVersion,
  witnessContext,
  guestContext,
}) {
  await assertPermission(
    actorUserId,
    campgroundId,
    "security.incident.sensitive.read",
  );
  await assertPermission(actorUserId, campgroundId, "security.incident.manage");
  const witness = incidentText(witnessContext, "Witness context", 0, 3000);
  const guest = incidentText(guestContext, "Guest context", 0, 3000);
  return withTransaction(async (client) => {
    await assertTransactionPermission(
      client,
      actorUserId,
      campgroundId,
      "security.incident.sensitive.read",
    );
    await assertTransactionPermission(
      client,
      actorUserId,
      campgroundId,
      "security.incident.manage",
    );
    const row = await lockedCase(client, campgroundId, caseId, rowVersion);
    if (row.status === "closed")
      throw new Error("Reopen the case before changing protected context.");
    await client.query(
      `insert into icamp_private.security_incident_sensitive
      (organization_id,campground_id,case_id,witness_context,guest_context,updated_by_user_id)
      values($1,$2,$3,$4,$5,$6)
      on conflict(case_id) do update set witness_context=excluded.witness_context,
       guest_context=excluded.guest_context,updated_by_user_id=excluded.updated_by_user_id,
       updated_at=statement_timestamp()`,
      [row.organization_id, campgroundId, row.id, witness, guest, actorUserId],
    );
    // Changed protected context invalidates pending closure and requires a fresh review request.
    if (row.status === "closure_pending") {
      await client.query(
        `update icamp_private.security_incident_cases set status='investigating',
        closure_requested_by_user_id=null where id=$1`,
        [row.id],
      );
    }
    await addEvent(
      client,
      row,
      actorUserId,
      "sensitive_updated",
      "Restricted witness/guest context updated. The values are not copied into the general timeline.",
    );
    await audit(
      client,
      row,
      actorUserId,
      actorSessionId,
      "security.incident.sensitive_context",
      null,
      {
        updated: true,
        closureRequestReset: row.status === "closure_pending",
      },
    );
  });
}

export async function addSecurityIncidentAttachment({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  caseId,
  rowVersion,
  caption,
  media,
}) {
  await assertPermission(actorUserId, campgroundId, "security.incident.manage");
  await assertPermission(
    actorUserId,
    campgroundId,
    "security.incident.sensitive.read",
  );
  const description = incidentText(caption, "Evidence caption", 8, 500);
  return withTransaction(async (client) => {
    await assertTransactionPermission(
      client,
      actorUserId,
      campgroundId,
      "security.incident.sensitive.read",
    );
    await assertTransactionPermission(
      client,
      actorUserId,
      campgroundId,
      "security.incident.manage",
    );
    const row = await lockedCase(client, campgroundId, caseId, rowVersion);
    if (row.status === "closed" || row.status === "closure_pending")
      throw new Error("Reopen or return the case before attaching evidence.");
    const count = await client.query(
      `select count(*)::int as total from icamp_private.security_incident_attachments where case_id=$1`,
      [row.id],
    );
    if (count.rows[0].total >= 10)
      throw new Error("The case already has ten attachments.");
    await client.query(
      `insert into icamp_private.media_assets
      (id,organization_id,campground_id,classification,media_kind,storage_provider,
       bucket_key,object_key,original_filename,content_type,byte_size,checksum_sha256,
       validation_state,lifecycle_state,created_by_user_id,activated_at)
      values($1,$2,$3,'confidential',$4,'supabase',$5,$6,$7,$8,$9,$10,'validated','active',$11,statement_timestamp())`,
      [
        media.id,
        row.organization_id,
        campgroundId,
        media.mediaKind,
        media.bucketKey,
        media.objectKey,
        media.originalFilename,
        media.contentType,
        media.byteSize,
        media.checksumSha256,
        actorUserId,
      ],
    );
    await client.query(
      `insert into icamp_private.media_lifecycle_events
      (media_asset_id,event_type,from_state,to_state,actor_user_id,reason,metadata)
      values($1,'registered',null,'pending',$2,$3,$4::jsonb),
       ($1,'activated','pending','active',$2,$3,$4::jsonb)`,
      [
        media.id,
        actorUserId,
        "Validated confidential security incident evidence retained.",
        JSON.stringify({ source: "security.incident", caseId: row.id }),
      ],
    );
    const attached = await client.query(
      `insert into icamp_private.security_incident_attachments
      (organization_id,campground_id,case_id,media_asset_id,checksum_sha256,caption,actor_user_id)
      values($1,$2,$3,$4,$5,$6,$7) returning id`,
      [
        row.organization_id,
        campgroundId,
        row.id,
        media.id,
        media.checksumSha256,
        description,
        actorUserId,
      ],
    );
    await addEvent(
      client,
      row,
      actorUserId,
      "evidence_attached",
      "Validated confidential evidence attached and retained as a private checksum-backed object.",
    );
    await audit(
      client,
      row,
      actorUserId,
      actorSessionId,
      "security.incident.evidence_attach",
      null,
      {
        attachmentId: attached.rows[0].id,
      },
    );
    return attached.rows[0].id;
  });
}

export async function getSecurityIncidentAttachment({
  actorUserId,
  attachmentId,
}) {
  const id = incidentUuid(attachmentId, "Attachment");
  const result = await getPool().query(
    `select a.case_id,a.campground_id,m.id as media_asset_id,
      m.classification,m.lifecycle_state,m.storage_provider,m.bucket_key,m.object_key
    from icamp_private.security_incident_attachments a
    join icamp_private.media_assets m on m.id=a.media_asset_id where a.id=$1`,
    [id],
  );
  const row = result.rows[0];
  if (!row) return null;
  const auth = await getCampgroundAuthorization(actorUserId, row.campground_id);
  if (
    !auth?.permissions.includes("security.incident.sensitive.read") ||
    !auth.permissions.includes("media.confidential.read") ||
    !auth.permissions.some((p) =>
      ["security.incident.manage", "security.incident.review"].includes(p),
    )
  )
    return null;
  if (row.classification !== "confidential" || row.lifecycle_state !== "active")
    return null;
  return {
    campgroundId: row.campground_id,
    storageProvider: row.storage_provider,
    bucketKey: row.bucket_key,
    objectKey: row.object_key,
  };
}

export async function isSecurityIncidentMedia(mediaAssetId) {
  const result = await getPool().query(
    `select campground_id from icamp_private.security_incident_attachments
    where media_asset_id=$1 limit 1`,
    [incidentUuid(mediaAssetId, "Media")],
  );
  return result.rows[0]?.campground_id ?? null;
}
