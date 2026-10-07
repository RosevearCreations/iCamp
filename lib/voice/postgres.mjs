import { createHash } from "node:crypto";

import pg from "pg";

import { appendAuditEvent } from "../audit/postgres.mjs";
import { hasCampgroundPermission } from "../authz/postgres.mjs";
import {
  createCommunicationDispatch,
  recordCommunicationAttempt,
} from "../communications/postgres.mjs";
import { routeDtmfInput, summarizeDtmfInput } from "./dtmf.mjs";
import { DEFAULT_IVR_SESSION_SECONDS, transitionIvrState } from "./ivr.mjs";

const { Pool } = pg;

let pool;

function databaseUrl() {
  const value = process.env.DATABASE_URL?.trim();

  if (!value) {
    throw new Error("DATABASE_URL is required for voice gateway operations.");
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

function mapLine(row) {
  if (!row) return null;

  return {
    id: row.id,
    organizationId: row.organization_id,
    campgroundId: row.campground_id,
    endpointId: row.endpoint_id,
    providerKey: row.provider_key,
    routeKey: row.route_key,
    staffTransferEndpointId: row.staff_transfer_endpoint_id,
    inboundEnabled: row.inbound_enabled,
    outboundEnabled: row.outbound_enabled,
    sandboxMode: row.sandbox_mode,
    lifecycleState: row.lifecycle_state,
  };
}

function mapCall(row) {
  if (!row) return null;

  return {
    id: row.id,
    organizationId: row.organization_id,
    campgroundId: row.campground_id,
    lineId: row.line_id,
    dispatchId: row.dispatch_id,
    remoteEndpointId: row.remote_endpoint_id,
    providerKey: row.provider_key,
    direction: row.direction,
    routeKey: row.route_key,
    callState: row.call_state,
    transferState: row.transfer_state,
    lastErrorCode: row.last_error_code,
    lastErrorSummary: row.last_error_summary,
    startedAt: toIso(row.started_at),
    answeredAt: toIso(row.answered_at),
    endedAt: toIso(row.ended_at),
  };
}

async function assertPermission(actorUserId, campgroundId, permission) {
  const allowed = await hasCampgroundPermission(
    actorUserId,
    campgroundId,
    permission,
  );

  if (!allowed) {
    throw new Error("Not authorized for voice gateway operation.");
  }
}

function inboundIdempotencyKey(providerKey, providerCallReference) {
  const digest = createHash("sha256")
    .update(providerKey)
    .update("\0")
    .update(providerCallReference)
    .digest("hex");

  return "voice:inbound:" + digest;
}

function eventCallState(eventType) {
  if (eventType === "call.answered") return "in_progress";
  if (eventType === "call.completed") return "completed";
  if (eventType === "call.failed") return "failed";
  return "ringing";
}

function dispatchState(eventType) {
  if (eventType === "call.completed") return "delivered";
  if (eventType === "call.failed") return "failed";
  return "submitted";
}

export async function registerVoiceLine({
  actorUserId,
  organizationId,
  campgroundId,
  endpointId,
  providerKey,
  providerNumberReference,
  routeKey = "main",
  staffTransferEndpointId = null,
  inboundEnabled = true,
  outboundEnabled = true,
  sandboxMode = true,
  reason = "Register campground voice line.",
}) {
  await assertPermission(actorUserId, campgroundId, "communications.manage");
  const client = await getPool().connect();

  try {
    await client.query("begin");

    const result = await client.query(
      `insert into icamp_private.voice_lines (
         organization_id,
         campground_id,
         endpoint_id,
         provider_key,
         provider_number_reference,
         route_key,
         staff_transfer_endpoint_id,
         inbound_enabled,
         outbound_enabled,
         sandbox_mode
       )
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       on conflict (provider_key, provider_number_reference)
       do update set
         organization_id = excluded.organization_id,
         campground_id = excluded.campground_id,
         endpoint_id = excluded.endpoint_id,
         route_key = excluded.route_key,
         staff_transfer_endpoint_id = excluded.staff_transfer_endpoint_id,
         inbound_enabled = excluded.inbound_enabled,
         outbound_enabled = excluded.outbound_enabled,
         sandbox_mode = excluded.sandbox_mode,
         lifecycle_state = 'active'
       returning *`,
      [
        organizationId,
        campgroundId,
        endpointId,
        providerKey,
        providerNumberReference,
        routeKey,
        staffTransferEndpointId,
        inboundEnabled,
        outboundEnabled,
        sandboxMode,
      ],
    );

    const line = mapLine(result.rows[0]);

    await appendAuditEvent(client, {
      actorUserId,
      organizationId,
      campgroundId,
      actionKey: "voice.line.upsert",
      permissionKey: "communications.manage",
      riskLevel: "elevated",
      outcome: "succeeded",
      reason,
      subjectType: "voice.line",
      subjectId: line.id,
      afterState: {
        providerKey: line.providerKey,
        routeKey: line.routeKey,
        inboundEnabled: line.inboundEnabled,
        outboundEnabled: line.outboundEnabled,
        sandboxMode: line.sandboxMode,
        lifecycleState: line.lifecycleState,
      },
      metadata: {
        providerNumberReferenceExcluded: true,
      },
    });

    await client.query("commit");
    return line;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function startOutboundVoiceCall({
  actorUserId,
  organizationId,
  campgroundId,
  lineId,
  destinationEndpointId,
  purpose = "operational",
  idempotencyKey,
  provider,
}) {
  await assertPermission(actorUserId, campgroundId, "communications.send");

  if (!provider || typeof provider.placeCall !== "function") {
    throw new Error("Voice provider adapter is required.");
  }

  const lookup = await getPool().query(
    `select
       l.*,
       destination.endpoint_value as destination_value
     from icamp_private.voice_lines l
     join icamp_private.communication_endpoints destination
       on destination.id = $2
      and destination.campground_id = l.campground_id
      and destination.endpoint_kind = 'phone'
      and destination.lifecycle_state = 'active'
     where l.id = $1
       and l.organization_id = $3
       and l.campground_id = $4
       and l.lifecycle_state = 'active'
       and l.outbound_enabled = true
     limit 1`,
    [lineId, destinationEndpointId, organizationId, campgroundId],
  );

  if (lookup.rowCount !== 1) {
    throw new Error("Outbound voice route is unavailable.");
  }

  const lineRow = lookup.rows[0];

  const dispatch = await createCommunicationDispatch({
    actorUserId,
    organizationId,
    campgroundId,
    endpointId: destinationEndpointId,
    direction: "outbound",
    channel: "voice",
    purpose,
    idempotencyKey,
    contentReference: "voice:outbound",
    reason: "Start outbound voice call.",
  });

  const existing = await getPool().query(
    `select *
     from icamp_private.voice_calls
     where dispatch_id = $1
     limit 1`,
    [dispatch.id],
  );

  if (existing.rowCount === 1) {
    return mapCall(existing.rows[0]);
  }

  let placed;

  try {
    placed = await provider.placeCall({
      dispatchId: dispatch.id,
      providerNumberReference: lineRow.provider_number_reference,
      destination: lineRow.destination_value,
      idempotencyKey,
    });
  } catch (error) {
    await recordCommunicationAttempt({
      dispatchId: dispatch.id,
      providerKey: provider.providerKey ?? lineRow.provider_key,
      attemptState: "failed",
      retryable: false,
      errorCode: "voice_provider_rejected",
      errorSummary: "Voice provider rejected outbound call.",
    });
    throw error;
  }

  await recordCommunicationAttempt({
    dispatchId: dispatch.id,
    providerKey: provider.providerKey ?? lineRow.provider_key,
    attemptState: "accepted",
    providerReference: placed.providerReference,
  });

  const inserted = await getPool().query(
    `insert into icamp_private.voice_calls (
       organization_id,
       campground_id,
       line_id,
       dispatch_id,
       remote_endpoint_id,
       provider_key,
       provider_call_reference,
       direction,
       route_key,
       call_state
     )
     values ($1, $2, $3, $4, $5, $6, $7, 'outbound', $8, 'ringing')
     on conflict (dispatch_id)
     do update set id = icamp_private.voice_calls.id
     returning *`,
    [
      organizationId,
      campgroundId,
      lineId,
      dispatch.id,
      destinationEndpointId,
      provider.providerKey ?? lineRow.provider_key,
      placed.providerCallReference,
      lineRow.route_key,
    ],
  );

  return mapCall(inserted.rows[0]);
}

async function ingestDtmfProviderEvent(event, provider) {
  if (!event.dtmf) {
    throw new Error("DTMF provider event is missing normalized keypad input.");
  }

  const client = await getPool().connect();
  let callRow;
  let sessionId = null;
  let transition = null;
  let duplicate = false;
  const summary = summarizeDtmfInput({
    inputKind: event.dtmf.inputKind,
    digits: event.dtmf.digits,
  });

  try {
    await client.query("begin");

    const lookup = await client.query(
      `select
         c.*,
         s.id as session_id,
         s.state_key,
         s.session_state,
         s.retry_count,
         s.max_retries,
         s.expires_at
       from icamp_private.voice_calls c
       join icamp_private.voice_ivr_sessions s on s.call_id = c.id
       where c.provider_key = $1
         and c.provider_call_reference = $2
       limit 1
       for update of c, s`,
      [event.providerKey, event.providerCallReference],
    );

    if (lookup.rowCount !== 1) {
      throw new Error("DTMF provider event does not match an active IVR call.");
    }

    const row = lookup.rows[0];
    callRow = row;
    sessionId = row.session_id;

    const eventInsert = await client.query(
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
       values (
         $1, $2, $3, 'dtmf', $4, $5, $6::jsonb, $7
       )
       on conflict (provider_key, provider_event_id) do nothing
       returning id`,
      [
        event.providerKey,
        event.providerEventId,
        row.dispatch_id,
        event.eventType,
        event.eventStatus,
        JSON.stringify({
          direction: event.direction,
          sandbox: event.sandbox === true,
          inputKind: summary.inputKind,
          digitCount: summary.digitCount,
          sensitive: summary.sensitive,
          rawDigitsExcluded: true,
        }),
        event.occurredAt,
      ],
    );

    if (eventInsert.rowCount === 0) {
      duplicate = true;
      await client.query("commit");
    } else {
      if (
        ["completed", "failed"].includes(row.call_state) ||
        row.session_state !== "active"
      ) {
        throw new Error("DTMF input cannot modify a terminal voice session.");
      }

      const expired = new Date(row.expires_at).getTime() <= Date.now();

      transition = routeDtmfInput({
        stateKey: row.state_key,
        inputKind: event.dtmf.inputKind,
        digits: event.dtmf.digits,
        timedOut: expired || event.eventType === "dtmf.timeout",
        retryCount: Number(row.retry_count),
        maxRetries: Number(row.max_retries),
      });

      await client.query(
        `update icamp_private.voice_ivr_sessions
         set
           state_key = $2,
           session_state = $3,
           retry_count = $4
         where id = $1`,
        [
          sessionId,
          transition.toState,
          transition.sessionState,
          transition.retryCount,
        ],
      );

      await client.query(
        `insert into icamp_private.voice_ivr_events (
           session_id,
           event_type,
           from_state,
           to_state,
           action_key
         )
         values ($1, $2, $3, $4, $5)`,
        [
          sessionId,
          transition.eventType,
          transition.fromState,
          transition.toState,
          transition.action,
        ],
      );

      await client.query("commit");
    }
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }

  if (duplicate) {
    return {
      inserted: false,
      duplicate: true,
      call: mapCall(callRow),
      sessionId,
      dtmf: {
        action: "acknowledge",
        eventType: "duplicate",
        inputKind: summary.inputKind,
        digitCount: summary.digitCount,
        sensitive: summary.sensitive,
        transientEntry: null,
      },
      transfer: null,
    };
  }

  let transfer = null;

  if (transition.action === "transfer.staff") {
    transfer = await transferVoiceCallToStaff({
      callId: callRow.id,
      provider,
      reason:
        transition.eventType === "dtmf.timeout"
          ? "DTMF retry limit reached after timeout."
          : "DTMF flow requested staff transfer.",
    });
  }

  return {
    inserted: true,
    duplicate: false,
    call: mapCall(callRow),
    sessionId,
    dtmf: {
      action: transition.action,
      eventType: transition.eventType,
      inputKind: transition.inputKind,
      digitCount: transition.digitCount,
      sensitive: transition.sensitive,
      transientEntry: transition.sensitive ? null : transition.transientEntry,
    },
    transfer,
  };
}

export async function ingestVoiceProviderEvent(event, provider = null) {
  if (event.eventType === "dtmf.input" || event.eventType === "dtmf.timeout") {
    return ingestDtmfProviderEvent(event, provider);
  }
  const client = await getPool().connect();

  try {
    await client.query("begin");

    const existingCall = await client.query(
      `select *
       from icamp_private.voice_calls
       where provider_key = $1
         and provider_call_reference = $2
       for update`,
      [event.providerKey, event.providerCallReference],
    );
    const existing = existingCall.rows[0] ?? null;

    const eventInsert = await client.query(
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
       values (
         $1, $2, $3, 'voice', $4, $5, $6::jsonb, $7
       )
       on conflict (provider_key, provider_event_id) do nothing
       returning id`,
      [
        event.providerKey,
        event.providerEventId,
        existing?.dispatch_id ?? null,
        event.eventType,
        event.eventStatus,
        JSON.stringify({
          direction: event.direction,
          sandbox: event.sandbox === true,
        }),
        event.occurredAt,
      ],
    );

    if (eventInsert.rowCount === 0) {
      await client.query("commit");
      return {
        inserted: false,
        duplicate: true,
        call: existing ? mapCall(existing) : null,
        sessionId: null,
      };
    }

    let callRow = existing;
    let sessionId = null;

    if (!callRow) {
      const lineResult = await client.query(
        `select *
         from icamp_private.voice_lines
         where provider_key = $1
           and provider_number_reference = $2
           and lifecycle_state = 'active'
           and (
             ($3 = 'inbound' and inbound_enabled = true)
             or
             ($3 = 'outbound' and outbound_enabled = true)
           )
         limit 1
         for update`,
        [event.providerKey, event.providerNumberReference, event.direction],
      );

      if (lineResult.rowCount !== 1) {
        throw new Error("Voice provider event does not match an active line.");
      }

      const line = lineResult.rows[0];
      const callState = eventCallState(event.eventType);
      const inboundKey = inboundIdempotencyKey(
        event.providerKey,
        event.providerCallReference,
      );

      const dispatchResult = await client.query(
        `insert into icamp_private.communication_dispatches (
           organization_id,
           campground_id,
           direction,
           channel,
           purpose,
           idempotency_key,
           content_reference,
           delivery_state,
           completed_at
         )
         values (
           $1, $2, $3, 'voice', 'operational', $4, 'voice:provider',
           $5,
           case when $5 in ('delivered', 'failed') then statement_timestamp() else null end
         )
         on conflict (campground_id, idempotency_key)
         do update set id = icamp_private.communication_dispatches.id
         returning *`,
        [
          line.organization_id,
          line.campground_id,
          event.direction,
          inboundKey,
          dispatchState(event.eventType),
        ],
      );
      const dispatch = dispatchResult.rows[0];

      const callResult = await client.query(
        `insert into icamp_private.voice_calls (
           organization_id,
           campground_id,
           line_id,
           dispatch_id,
           provider_key,
           provider_call_reference,
           direction,
           route_key,
           call_state,
           answered_at,
           ended_at
         )
         values (
           $1, $2, $3, $4, $5, $6, $7, $8, $9,
           case when $9 = 'in_progress' then statement_timestamp() else null end,
           case when $9 in ('completed', 'failed') then statement_timestamp() else null end
         )
         returning *`,
        [
          line.organization_id,
          line.campground_id,
          line.id,
          dispatch.id,
          event.providerKey,
          event.providerCallReference,
          event.direction,
          line.route_key,
          callState,
        ],
      );
      callRow = callResult.rows[0];

      if (
        event.direction === "inbound" &&
        !["completed", "failed"].includes(callState)
      ) {
        const sessionResult = await client.query(
          `insert into icamp_private.voice_ivr_sessions (
             call_id,
             route_key,
             state_key,
             expires_at
           )
           values (
             $1, $2, 'main_menu',
             statement_timestamp() + make_interval(secs => $3)
           )
           returning id`,
          [callRow.id, line.route_key, DEFAULT_IVR_SESSION_SECONDS],
        );
        sessionId = sessionResult.rows[0].id;

        await client.query(
          `insert into icamp_private.voice_ivr_events (
             session_id,
             event_type,
             from_state,
             to_state,
             action_key
           )
           values ($1, 'call.started', null, 'main_menu', 'prompt.main')`,
          [sessionId],
        );
      }
    } else if (!["completed", "failed"].includes(callRow.call_state)) {
      const nextState = eventCallState(event.eventType);
      const updatedCall = await client.query(
        `update icamp_private.voice_calls
         set
           call_state = $2,
           answered_at = case
             when $2 = 'in_progress'
               then coalesce(answered_at, statement_timestamp())
             else answered_at
           end,
           ended_at = case
             when $2 in ('completed', 'failed')
               then coalesce(ended_at, statement_timestamp())
             else ended_at
           end
         where id = $1
         returning *`,
        [callRow.id, nextState],
      );
      callRow = updatedCall.rows[0];

      const existingSession = await client.query(
        `select id
         from icamp_private.voice_ivr_sessions
         where call_id = $1
         limit 1`,
        [callRow.id],
      );
      sessionId = existingSession.rows[0]?.id ?? null;
    }

    const nextDispatchState = dispatchState(event.eventType);

    await client.query(
      `update icamp_private.communication_dispatches
       set
         delivery_state = $2,
         completed_at = case
           when $2 in ('delivered', 'failed')
             then coalesce(completed_at, statement_timestamp())
           else null
         end
       where id = $1`,
      [callRow.dispatch_id, nextDispatchState],
    );

    await client.query("commit");

    return {
      inserted: true,
      duplicate: false,
      call: mapCall(callRow),
      sessionId,
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function advanceVoiceIvr({ callId, eventType, provider = null }) {
  const client = await getPool().connect();
  let transition;
  let expired = false;

  try {
    await client.query("begin");

    const sessionResult = await client.query(
      `select s.*, c.call_state
       from icamp_private.voice_ivr_sessions s
       join icamp_private.voice_calls c on c.id = s.call_id
       where s.call_id = $1
       for update of s`,
      [callId],
    );

    if (sessionResult.rowCount !== 1) {
      throw new Error("Active IVR session was not found.");
    }

    const session = sessionResult.rows[0];

    if (session.session_state !== "active") {
      throw new Error("IVR session is already terminal.");
    }

    expired = new Date(session.expires_at).getTime() <= Date.now();

    transition = transitionIvrState({
      stateKey: session.state_key,
      eventType: expired ? "timeout" : eventType,
      retryCount: expired
        ? Math.max(Number(session.retry_count), Number(session.max_retries) - 1)
        : Number(session.retry_count),
      maxRetries: Number(session.max_retries),
    });

    await client.query(
      `update icamp_private.voice_ivr_sessions
       set
         state_key = $2,
         session_state = $3,
         retry_count = $4
       where id = $1`,
      [
        session.id,
        transition.toState,
        transition.sessionState,
        transition.retryCount,
      ],
    );

    await client.query(
      `insert into icamp_private.voice_ivr_events (
         session_id,
         event_type,
         from_state,
         to_state,
         action_key
       )
       values ($1, $2, $3, $4, $5)`,
      [
        session.id,
        transition.eventType,
        transition.fromState,
        transition.toState,
        transition.action,
      ],
    );

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }

  if (transition.action === "transfer.staff") {
    const transfer = await transferVoiceCallToStaff({
      callId,
      provider,
      reason: expired
        ? "IVR session expired."
        : "IVR requested staff transfer.",
    });

    return { ...transition, transfer };
  }

  return { ...transition, transfer: null };
}

export async function transferVoiceCallToStaff({
  callId,
  provider,
  reason = "Transfer voice call to campground staff.",
}) {
  if (!provider || typeof provider.transferCall !== "function") {
    throw new Error("Voice provider adapter is required for transfer.");
  }

  const lookup = await getPool().query(
    `select
       c.*,
       l.staff_transfer_endpoint_id,
       transfer.endpoint_value as transfer_destination
     from icamp_private.voice_calls c
     join icamp_private.voice_lines l on l.id = c.line_id
     left join icamp_private.communication_endpoints transfer
       on transfer.id = l.staff_transfer_endpoint_id
      and transfer.campground_id = c.campground_id
      and transfer.endpoint_kind = 'phone'
      and transfer.lifecycle_state = 'active'
     where c.id = $1
     limit 1`,
    [callId],
  );

  if (lookup.rowCount !== 1) {
    throw new Error("Voice call was not found.");
  }

  const call = lookup.rows[0];

  if (!call.transfer_destination) {
    await getPool().query(
      `update icamp_private.voice_calls
       set
         transfer_state = 'fallback',
         last_error_code = 'staff_transfer_unavailable',
         last_error_summary = 'No active staff transfer destination is configured.'
       where id = $1`,
      [callId],
    );

    return {
      transferred: false,
      fallback: true,
      reason,
    };
  }

  try {
    await getPool().query(
      `update icamp_private.voice_calls
       set
         call_state = 'transferring',
         transfer_state = 'requested'
       where id = $1`,
      [callId],
    );

    await provider.transferCall({
      providerCallReference: call.provider_call_reference,
      destination: call.transfer_destination,
    });

    await getPool().query(
      `update icamp_private.voice_calls
       set transfer_state = 'completed'
       where id = $1`,
      [callId],
    );

    return {
      transferred: true,
      fallback: false,
      reason,
    };
  } catch (error) {
    await getPool().query(
      `update icamp_private.voice_calls
       set
         transfer_state = 'failed',
         last_error_code = 'staff_transfer_failed',
         last_error_summary = 'Voice provider could not complete staff transfer.'
       where id = $1`,
      [callId],
    );

    throw error;
  }
}

export async function getVoiceGatewayHealth() {
  const [lines, calls, sessions, dtmfEvents] = await Promise.all([
    getPool().query(
      `select
         count(*) filter (where lifecycle_state = 'active')::integer as active,
         count(*) filter (
           where lifecycle_state = 'active' and sandbox_mode = true
         )::integer as sandbox
       from icamp_private.voice_lines`,
    ),
    getPool().query(
      `select
         count(*) filter (
           where call_state in ('ringing', 'in_progress', 'transferring')
         )::integer as active,
         count(*) filter (
           where transfer_state = 'fallback'
         )::integer as transfer_fallbacks,
         count(*) filter (
           where call_state = 'failed'
             and started_at >= statement_timestamp() - interval '24 hours'
         )::integer as failed_24h
       from icamp_private.voice_calls`,
    ),
    getPool().query(
      `select
         count(*) filter (where session_state = 'active')::integer as active,
         count(*) filter (
           where session_state = 'active'
             and expires_at <= statement_timestamp()
         )::integer as expired
       from icamp_private.voice_ivr_sessions`,
    ),
    getPool().query(
      `select
         count(*) filter (
           where event_type like 'dtmf.%'
             and occurred_at >= statement_timestamp() - interval '24 hours'
         )::integer as inputs_24h,
         count(*) filter (
           where event_type = 'dtmf.invalid'
             and occurred_at >= statement_timestamp() - interval '24 hours'
         )::integer as invalid_24h,
         count(*) filter (
           where event_type = 'dtmf.timeout'
             and occurred_at >= statement_timestamp() - interval '24 hours'
         )::integer as timeouts_24h
       from icamp_private.voice_ivr_events`,
    ),
  ]);

  const l = lines.rows[0];
  const c = calls.rows[0];
  const s = sessions.rows[0];
  const d = dtmfEvents.rows[0];
  const degraded =
    Number(c.failed_24h) > 0 ||
    Number(c.transfer_fallbacks) > 0 ||
    Number(s.expired) > 0;

  return {
    status: degraded ? "degraded" : "operational",
    lines: {
      active: Number(l.active),
      sandbox: Number(l.sandbox),
    },
    calls: {
      active: Number(c.active),
      failed24h: Number(c.failed_24h),
      transferFallbacks: Number(c.transfer_fallbacks),
    },
    ivr: {
      active: Number(s.active),
      expired: Number(s.expired),
    },
    dtmf: {
      inputs24h: Number(d.inputs_24h),
      invalid24h: Number(d.invalid_24h),
      timeouts24h: Number(d.timeouts_24h),
    },
  };
}

export async function closeVoicePoolForTests() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}
