import pg from "pg";

import { appendAuditEvent } from "../audit/postgres.mjs";
import { hasCampgroundPermission } from "../authz/postgres.mjs";

const { Pool } = pg;

const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_RETRY_BASE_SECONDS = 30;
const MAX_RETRY_DELAY_SECONDS = 3600;

let pool;

function databaseUrl() {
  const value = process.env.DATABASE_URL?.trim();

  if (!value) {
    throw new Error("DATABASE_URL is required for communications operations.");
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

function toIso(value) {
  return value instanceof Date ? value.toISOString() : (value ?? null);
}

function mapEndpoint(row) {
  if (!row) return null;

  return {
    id: row.id,
    organizationId: row.organization_id,
    campgroundId: row.campground_id,
    ownerUserId: row.owner_user_id,
    endpointKind: row.endpoint_kind,
    displayHint: row.display_hint,
    verifiedAt: toIso(row.verified_at),
    lifecycleState: row.lifecycle_state,
  };
}

function mapDispatch(row) {
  if (!row) return null;

  return {
    id: row.id,
    organizationId: row.organization_id,
    campgroundId: row.campground_id,
    endpointId: row.endpoint_id,
    direction: row.direction,
    channel: row.channel,
    purpose: row.purpose,
    idempotencyKey: row.idempotency_key,
    contentReference: row.content_reference,
    deliveryState: row.delivery_state,
    maxAttempts: Number(row.max_attempts),
    attemptCount: Number(row.attempt_count),
    nextAttemptAt: toIso(row.next_attempt_at),
    lastErrorCode: row.last_error_code,
    lastErrorSummary: row.last_error_summary,
    completedAt: toIso(row.completed_at),
  };
}

async function assertPermission(actorUserId, campgroundId, permission) {
  const allowed = await hasCampgroundPermission(
    actorUserId,
    campgroundId,
    permission,
  );

  if (!allowed) {
    throw new Error("Not authorized for communication operation.");
  }
}

export function communicationRetryDelaySeconds(
  attemptNumber,
  baseSeconds = DEFAULT_RETRY_BASE_SECONDS,
) {
  if (!Number.isInteger(attemptNumber) || attemptNumber < 1) {
    throw new Error("Attempt number must be a positive integer.");
  }

  if (
    !Number.isInteger(baseSeconds) ||
    baseSeconds < 1 ||
    baseSeconds > MAX_RETRY_DELAY_SECONDS
  ) {
    throw new Error("Retry base seconds must be between 1 and 3600.");
  }

  return Math.min(
    MAX_RETRY_DELAY_SECONDS,
    baseSeconds * 2 ** Math.max(0, attemptNumber - 1),
  );
}

export async function registerCommunicationEndpoint({
  actorUserId,
  organizationId,
  campgroundId,
  ownerUserId = null,
  endpointKind,
  endpointValue,
  displayHint = null,
  verifiedAt = null,
  reason = "Register communication endpoint.",
}) {
  await assertPermission(actorUserId, campgroundId, "communications.manage");

  const client = await getPool().connect();

  try {
    await client.query("begin");

    const result = await client.query(
      `insert into icamp_private.communication_endpoints (
         organization_id,
         campground_id,
         owner_user_id,
         endpoint_kind,
         endpoint_value,
         display_hint,
         verified_at
       )
       values ($1, $2, $3, $4, $5, $6, $7)
       on conflict (
         organization_id,
         campground_id,
         endpoint_kind,
         endpoint_value
       )
       do update set
         owner_user_id = excluded.owner_user_id,
         display_hint = excluded.display_hint,
         verified_at = coalesce(
           excluded.verified_at,
           icamp_private.communication_endpoints.verified_at
         ),
         lifecycle_state = 'active'
       returning *`,
      [
        organizationId,
        campgroundId,
        ownerUserId,
        endpointKind,
        endpointValue,
        displayHint,
        verifiedAt,
      ],
    );

    const endpoint = mapEndpoint(result.rows[0]);

    await appendAuditEvent(client, {
      actorUserId,
      organizationId,
      campgroundId,
      actionKey: "communications.endpoint.upsert",
      permissionKey: "communications.manage",
      riskLevel: "elevated",
      outcome: "succeeded",
      reason,
      subjectType: "communications.endpoint",
      subjectId: endpoint.id,
      afterState: {
        endpointKind: endpoint.endpointKind,
        displayHint: endpoint.displayHint,
        lifecycleState: endpoint.lifecycleState,
      },
      metadata: {
        rawEndpointExcluded: true,
      },
    });

    await client.query("commit");
    return endpoint;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function setCommunicationPreference({
  actorUserId,
  campgroundId,
  endpointId,
  purpose,
  channel,
  preferenceState,
  source = "user",
  reason = "Update communication preference.",
}) {
  await assertPermission(actorUserId, campgroundId, "communications.manage");
  const client = await getPool().connect();

  try {
    await client.query("begin");

    const result = await client.query(
      `insert into icamp_private.communication_preferences (
         endpoint_id,
         purpose,
         channel,
         preference_state,
         source,
         updated_by_user_id
       )
       select id, $2, $3, $4, $5, $6
       from icamp_private.communication_endpoints
       where id = $1
         and campground_id = $7
       on conflict (endpoint_id, purpose, channel)
       do update set
         preference_state = excluded.preference_state,
         source = excluded.source,
         updated_by_user_id = excluded.updated_by_user_id
       returning id, endpoint_id, purpose, channel, preference_state, source`,
      [
        endpointId,
        purpose,
        channel,
        preferenceState,
        source,
        actorUserId,
        campgroundId,
      ],
    );

    if (result.rowCount !== 1) {
      throw new Error("Communication endpoint was not found in campground.");
    }

    const row = result.rows[0];

    await appendAuditEvent(client, {
      actorUserId,
      campgroundId,
      actionKey: "communications.preference.upsert",
      permissionKey: "communications.manage",
      riskLevel: "elevated",
      outcome: "succeeded",
      reason,
      subjectType: "communications.preference",
      subjectId: row.id,
      afterState: {
        purpose: row.purpose,
        channel: row.channel,
        preferenceState: row.preference_state,
        source: row.source,
      },
    });

    await client.query("commit");

    return {
      id: row.id,
      endpointId: row.endpoint_id,
      purpose: row.purpose,
      channel: row.channel,
      preferenceState: row.preference_state,
      source: row.source,
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function recordCommunicationConsent({
  actorUserId,
  campgroundId,
  endpointId,
  purpose,
  channel,
  consentState,
  evidenceSource,
  evidenceReference = null,
  reason = "Record communication consent evidence.",
}) {
  await assertPermission(actorUserId, campgroundId, "communications.manage");
  const client = await getPool().connect();

  try {
    await client.query("begin");

    const endpoint = await client.query(
      `select organization_id
       from icamp_private.communication_endpoints
       where id = $1
         and campground_id = $2
       limit 1`,
      [endpointId, campgroundId],
    );

    if (endpoint.rowCount !== 1) {
      throw new Error("Communication endpoint was not found in campground.");
    }

    const result = await client.query(
      `insert into icamp_private.communication_consents (
         endpoint_id,
         purpose,
         channel,
         consent_state,
         evidence_source,
         evidence_reference,
         recorded_by_user_id
       )
       values ($1, $2, $3, $4, $5, $6, $7)
       returning id, occurred_at`,
      [
        endpointId,
        purpose,
        channel,
        consentState,
        evidenceSource,
        evidenceReference,
        actorUserId,
      ],
    );

    await appendAuditEvent(client, {
      actorUserId,
      organizationId: endpoint.rows[0].organization_id,
      campgroundId,
      actionKey: "communications.consent.record",
      permissionKey: "communications.manage",
      riskLevel: "elevated",
      outcome: "succeeded",
      reason,
      subjectType: "communications.consent",
      subjectId: result.rows[0].id,
      afterState: {
        purpose,
        channel,
        consentState,
        evidenceSource,
      },
      metadata: {
        evidenceReferenceExcluded: evidenceReference != null,
      },
    });

    await client.query("commit");

    return {
      id: result.rows[0].id,
      occurredAt: toIso(result.rows[0].occurred_at),
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function createCommunicationDispatch({
  actorUserId,
  organizationId,
  campgroundId,
  endpointId = null,
  direction = "outbound",
  channel,
  purpose,
  idempotencyKey,
  contentReference = null,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  reason = "Create communication dispatch.",
}) {
  await assertPermission(actorUserId, campgroundId, "communications.send");
  const client = await getPool().connect();

  try {
    await client.query("begin");

    const result = await client.query(
      `insert into icamp_private.communication_dispatches (
         organization_id,
         campground_id,
         endpoint_id,
         direction,
         channel,
         purpose,
         idempotency_key,
         content_reference,
         max_attempts,
         created_by_user_id
       )
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       on conflict (campground_id, idempotency_key)
       do update set id = icamp_private.communication_dispatches.id
       returning *`,
      [
        organizationId,
        campgroundId,
        endpointId,
        direction,
        channel,
        purpose,
        idempotencyKey,
        contentReference,
        maxAttempts,
        actorUserId,
      ],
    );

    const dispatch = mapDispatch(result.rows[0]);

    await appendAuditEvent(client, {
      actorUserId,
      organizationId,
      campgroundId,
      actionKey: "communications.dispatch.create",
      permissionKey: "communications.send",
      riskLevel: "elevated",
      outcome: "succeeded",
      reason,
      subjectType: "communications.dispatch",
      subjectId: dispatch.id,
      afterState: {
        direction: dispatch.direction,
        channel: dispatch.channel,
        purpose: dispatch.purpose,
        deliveryState: dispatch.deliveryState,
      },
      metadata: {
        endpointExcluded: endpointId != null,
        contentReferenceExcluded: contentReference != null,
      },
    });

    await client.query("commit");
    return dispatch;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function recordCommunicationAttempt({
  dispatchId,
  providerKey,
  attemptState,
  retryable = false,
  providerReference = null,
  errorCode = null,
  errorSummary = null,
  retryBaseSeconds = DEFAULT_RETRY_BASE_SECONDS,
}) {
  const client = await getPool().connect();

  try {
    await client.query("begin");

    const locked = await client.query(
      `select *
       from icamp_private.communication_dispatches
       where id = $1
       for update`,
      [dispatchId],
    );

    const dispatch = locked.rows[0];

    if (!dispatch) {
      throw new Error("Communication dispatch was not found.");
    }

    if (["delivered", "cancelled"].includes(dispatch.delivery_state)) {
      throw new Error("Communication dispatch is already terminal.");
    }

    const attemptNumber = Number(dispatch.attempt_count) + 1;

    if (attemptNumber > Number(dispatch.max_attempts)) {
      throw new Error("Communication dispatch attempt limit is exhausted.");
    }

    await client.query(
      `insert into icamp_private.communication_attempts (
         dispatch_id,
         attempt_number,
         provider_key,
         attempt_state,
         retryable,
         provider_reference,
         error_code,
         error_summary,
         completed_at
       )
       values (
         $1, $2, $3, $4, $5, $6, $7, $8,
         case when $4 in ('delivered', 'failed') then statement_timestamp() else null end
       )`,
      [
        dispatchId,
        attemptNumber,
        providerKey,
        attemptState,
        retryable,
        providerReference,
        errorCode,
        errorSummary,
      ],
    );

    const canRetry =
      attemptState === "failed" &&
      retryable &&
      attemptNumber < Number(dispatch.max_attempts);

    const terminalFailure =
      attemptState === "failed" &&
      (!retryable || attemptNumber >= Number(dispatch.max_attempts));

    const deliveryState =
      attemptState === "delivered"
        ? "delivered"
        : terminalFailure
          ? "failed"
          : canRetry
            ? "queued"
            : "submitted";

    const delaySeconds = canRetry
      ? communicationRetryDelaySeconds(attemptNumber, retryBaseSeconds)
      : null;

    const updated = await client.query(
      `update icamp_private.communication_dispatches
       set
         attempt_count = $2,
         delivery_state = $3,
         next_attempt_at = case
           when $4::integer is null then null
           else statement_timestamp() + make_interval(secs => $4::integer)
         end,
         last_error_code = $5,
         last_error_summary = $6,
         completed_at = case
           when $3 in ('delivered', 'failed', 'cancelled')
             then statement_timestamp()
           else null
         end
       where id = $1
       returning *`,
      [
        dispatchId,
        attemptNumber,
        deliveryState,
        delaySeconds,
        errorCode,
        errorSummary,
      ],
    );

    await client.query("commit");
    return mapDispatch(updated.rows[0]);
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function recordCommunicationProviderEvent({
  providerKey,
  providerEventId,
  dispatchId = null,
  channel,
  eventType,
  eventStatus,
  metadata = {},
  occurredAt,
}) {
  const result = await getPool().query(
    `insert into icamp_private.communication_provider_events (
       provider_key,
       provider_event_id,
       dispatch_id,
       channel,
       event_type,
       event_status,
       metadata,
       occurred_at
     )
     values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
     on conflict (provider_key, provider_event_id) do nothing
     returning id, received_at`,
    [
      providerKey,
      providerEventId,
      dispatchId,
      channel,
      eventType,
      eventStatus,
      JSON.stringify(metadata ?? {}),
      occurredAt,
    ],
  );

  return result.rowCount === 1
    ? {
        inserted: true,
        id: result.rows[0].id,
        receivedAt: toIso(result.rows[0].received_at),
      }
    : { inserted: false, id: null, receivedAt: null };
}

export async function getCommunicationsHealth({ overdueSeconds = 300 } = {}) {
  const [dispatchCounts, attempts, events] = await Promise.all([
    getPool().query(
      `select
         count(*) filter (where delivery_state = 'queued')::integer as queued,
         count(*) filter (where delivery_state = 'submitted')::integer as submitted,
         count(*) filter (where delivery_state = 'delivered')::integer as delivered,
         count(*) filter (where delivery_state = 'failed')::integer as failed,
         count(*) filter (
           where delivery_state in ('queued', 'submitted')
             and created_at < statement_timestamp() - make_interval(secs => $1)
         )::integer as overdue,
         count(*) filter (
           where channel in ('voice', 'dtmf', 'speech')
             and delivery_state in ('queued', 'submitted')
         )::integer as active_call_work
       from icamp_private.communication_dispatches`,
      [overdueSeconds],
    ),
    getPool().query(
      `select
         count(*) filter (
           where attempt_state = 'failed'
             and retryable = true
         )::integer as retryable_failures,
         count(*) filter (
           where attempt_state = 'failed'
             and retryable = false
         )::integer as terminal_attempt_failures
       from icamp_private.communication_attempts`,
    ),
    getPool().query(
      `select
         max(received_at) as latest_provider_event_at,
         count(*) filter (
           where received_at >= statement_timestamp() - interval '24 hours'
         )::integer as provider_events_24h
       from icamp_private.communication_provider_events`,
    ),
  ]);

  const d = dispatchCounts.rows[0];
  const a = attempts.rows[0];
  const e = events.rows[0];
  const degraded =
    Number(d.failed) > 0 ||
    Number(d.overdue) > 0 ||
    Number(a.terminal_attempt_failures) > 0;

  return {
    status: degraded ? "degraded" : "operational",
    delivery: {
      queued: Number(d.queued),
      submitted: Number(d.submitted),
      delivered: Number(d.delivered),
      failed: Number(d.failed),
      overdue: Number(d.overdue),
    },
    calls: {
      activeWork: Number(d.active_call_work),
    },
    retries: {
      retryableFailures: Number(a.retryable_failures),
      terminalAttemptFailures: Number(a.terminal_attempt_failures),
    },
    providers: {
      events24h: Number(e.provider_events_24h),
      latestEventAt: toIso(e.latest_provider_event_at),
    },
  };
}

export async function closeCommunicationsPoolForTests() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}
