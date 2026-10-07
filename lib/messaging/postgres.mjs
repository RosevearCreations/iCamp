import { createHash } from "node:crypto";

import pg from "pg";

import { appendAuditEvent } from "../audit/postgres.mjs";
import { hasCampgroundPermission } from "../authz/postgres.mjs";
import {
  createCommunicationDispatch,
  recordCommunicationAttempt,
} from "../communications/postgres.mjs";
import { classifyMessagingConsentKeyword } from "../consent/core.mjs";
import {
  applyMessagingPreferenceKeywordInTransaction,
  assertMessagingDispatchAllowed,
} from "../consent/postgres.mjs";
import {
  MESSAGE_MMS_MAX_ATTACHMENTS,
  parseMessagingCommand,
  summarizeMessageForTelemetry,
  validateMessagingCommand,
} from "./commands.mjs";

const { Pool } = pg;

let pool;

function databaseUrl() {
  const value = process.env.DATABASE_URL?.trim();

  if (!value) {
    throw new Error("DATABASE_URL is required for messaging operations.");
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

function normalizeProviderKey(value) {
  const key = String(value ?? "")
    .trim()
    .toLowerCase();

  if (!/^[a-z][a-z0-9_-]{1,63}$/u.test(key)) {
    throw new Error("Messaging provider key is invalid.");
  }

  return key;
}

function normalizeProviderReference(value, label) {
  const reference = String(value ?? "").trim();

  if (reference.length < 1 || reference.length > 240) {
    throw new Error(label + " is invalid.");
  }

  return reference;
}

function mapLine(row) {
  if (!row) return null;

  return {
    id: row.id,
    organizationId: row.organization_id,
    campgroundId: row.campground_id,
    endpointId: row.endpoint_id,
    providerKey: row.provider_key,
    sandboxMode: row.sandbox_mode,
    lifecycleState: row.lifecycle_state,
  };
}

function mapMessage(row) {
  if (!row) return null;

  return {
    id: row.id,
    conversationId: row.conversation_id,
    dispatchId: row.dispatch_id,
    direction: row.direction,
    channel: row.channel,
    purpose: row.purpose,
    deliveryState: row.delivery_state,
    bodyLength: Number(row.body_length),
    commandKind: row.command_kind,
    commandSource: row.command_source,
    commandState: row.command_state,
    occurredAt: toIso(row.occurred_at),
    deliveredAt: toIso(row.delivered_at),
    readAt: toIso(row.read_at),
  };
}

async function assertPermission(actorUserId, campgroundId, permission) {
  const allowed = await hasCampgroundPermission(
    actorUserId,
    campgroundId,
    permission,
  );

  if (!allowed) {
    throw new Error("Not authorized for messaging gateway operation.");
  }
}

function providerEventIdempotency(providerKey, providerEventId) {
  return (
    "msg:" +
    createHash("sha256")
      .update(providerKey)
      .update(":")
      .update(providerEventId)
      .digest("hex")
  );
}

async function getLineAndDestination(
  client,
  { campgroundId, lineId, destinationEndpointId },
) {
  const result = await client.query(
    `select
       ml.*,
       destination.endpoint_value as destination_value
     from icamp_private.messaging_lines ml
     join icamp_private.communication_endpoints destination
       on destination.id = $3
      and destination.campground_id = ml.campground_id
      and destination.endpoint_kind = 'phone'
      and destination.lifecycle_state = 'active'
     where ml.id = $2
       and ml.campground_id = $1
       and ml.lifecycle_state = 'active'
     limit 1`,
    [campgroundId, lineId, destinationEndpointId],
  );

  if (result.rowCount !== 1) {
    throw new Error("Messaging line or destination was not found.");
  }

  return result.rows[0];
}

async function ensureConversation(
  client,
  {
    organizationId,
    campgroundId,
    lineId,
    remoteEndpointId,
    channel,
    occurredAt = null,
  },
) {
  const result = await client.query(
    `insert into icamp_private.messaging_conversations (
       organization_id,
       campground_id,
       line_id,
       remote_endpoint_id,
       preferred_channel,
       last_message_at
     )
     values ($1, $2, $3, $4, $5, $6)
     on conflict (line_id, remote_endpoint_id)
       where conversation_state = 'active'
     do update set
       preferred_channel = excluded.preferred_channel,
       last_message_at = coalesce(
         excluded.last_message_at,
         icamp_private.messaging_conversations.last_message_at
       )
     returning *`,
    [
      organizationId,
      campgroundId,
      lineId,
      remoteEndpointId,
      channel,
      occurredAt,
    ],
  );

  return result.rows[0];
}

async function outboundMedia(
  client,
  { organizationId, campgroundId, mediaAssetIds },
) {
  if (!Array.isArray(mediaAssetIds)) {
    throw new Error("Outbound media asset list is invalid.");
  }

  if (mediaAssetIds.length > MESSAGE_MMS_MAX_ATTACHMENTS) {
    throw new Error("Too many outbound MMS attachments.");
  }

  if (mediaAssetIds.length === 0) return [];

  const result = await client.query(
    `select id, content_type, byte_size
     from icamp_private.media_assets
     where organization_id = $1
       and campground_id = $2
       and id = any($3::uuid[])
       and media_kind = 'image'
       and validation_state = 'validated'
       and lifecycle_state = 'active'
       and content_type in (
         'image/jpeg',
         'image/png',
         'image/webp',
         'image/gif'
       )
       and byte_size between 1 and 10485760`,
    [organizationId, campgroundId, mediaAssetIds],
  );

  if (result.rowCount !== mediaAssetIds.length) {
    throw new Error("One or more outbound MMS assets are not eligible.");
  }

  return result.rows.map((row) => ({
    mediaAssetId: row.id,
    contentType: row.content_type,
    bytes: Number(row.byte_size),
  }));
}

export async function registerMessagingLine({
  actorUserId,
  organizationId,
  campgroundId,
  endpointId,
  providerKey,
  providerNumberReference,
  sandboxMode = true,
  reason = "Register SMS/MMS provider line.",
}) {
  await assertPermission(actorUserId, campgroundId, "communications.manage");

  const key = normalizeProviderKey(providerKey);
  const reference = normalizeProviderReference(
    providerNumberReference,
    "Messaging provider number reference",
  );
  const client = await getPool().connect();

  try {
    await client.query("begin");

    const endpoint = await client.query(
      `select id
       from icamp_private.communication_endpoints
       where id = $1
         and organization_id = $2
         and campground_id = $3
         and endpoint_kind = 'phone'
         and lifecycle_state = 'active'
       limit 1`,
      [endpointId, organizationId, campgroundId],
    );

    if (endpoint.rowCount !== 1) {
      throw new Error("Messaging line endpoint was not found in campground.");
    }

    const result = await client.query(
      `insert into icamp_private.messaging_lines (
         organization_id,
         campground_id,
         endpoint_id,
         provider_key,
         provider_number_reference,
         sandbox_mode
       )
       values ($1, $2, $3, $4, $5, $6)
       on conflict (provider_key, provider_number_reference)
       do update set
         endpoint_id = excluded.endpoint_id,
         sandbox_mode = excluded.sandbox_mode,
         lifecycle_state = 'active'
       returning *`,
      [organizationId, campgroundId, endpointId, key, reference, sandboxMode],
    );

    const line = mapLine(result.rows[0]);

    await appendAuditEvent(client, {
      actorUserId,
      organizationId,
      campgroundId,
      actionKey: "messaging.line.upsert",
      permissionKey: "communications.manage",
      riskLevel: "elevated",
      outcome: "succeeded",
      reason,
      subjectType: "messaging.line",
      subjectId: line.id,
      afterState: {
        providerKey: line.providerKey,
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

export async function startOutboundMessage({
  actorUserId,
  organizationId,
  campgroundId,
  lineId,
  destinationEndpointId,
  purpose = "operational",
  idempotencyKey,
  text,
  mediaAssetIds = [],
  messageKind = "normal",
  provider,
}) {
  await assertPermission(actorUserId, campgroundId, "communications.send");

  const summary = summarizeMessageForTelemetry({
    text,
    attachmentCount: mediaAssetIds.length,
  });
  const channel = mediaAssetIds.length > 0 ? "mms" : "sms";
  const client = await getPool().connect();
  let line;
  let media;

  try {
    line = await getLineAndDestination(client, {
      campgroundId,
      lineId,
      destinationEndpointId,
    });
    media = await outboundMedia(client, {
      organizationId,
      campgroundId,
      mediaAssetIds,
    });
  } finally {
    client.release();
  }

  if (line.organization_id !== organizationId) {
    throw new Error("Messaging line organization does not match request.");
  }

  if (line.provider_key !== provider.providerKey) {
    throw new Error("Messaging provider does not match registered line.");
  }

  await assertMessagingDispatchAllowed({
    campgroundId,
    endpointId: destinationEndpointId,
    purpose,
    channel,
    messageKind,
  });

  const dispatch = await createCommunicationDispatch({
    actorUserId,
    organizationId,
    campgroundId,
    endpointId: destinationEndpointId,
    direction: "outbound",
    channel,
    purpose,
    idempotencyKey,
    reason: "Create outbound SMS/MMS dispatch.",
  });

  const writeClient = await getPool().connect();

  try {
    await writeClient.query("begin");

    const existing = await writeClient.query(
      `select *
       from icamp_private.messaging_messages
       where dispatch_id = $1
       limit 1`,
      [dispatch.id],
    );

    if (existing.rowCount === 1) {
      await writeClient.query("commit");
      return {
        message: mapMessage(existing.rows[0]),
        duplicate: true,
      };
    }

    const conversation = await ensureConversation(writeClient, {
      organizationId,
      campgroundId,
      lineId,
      remoteEndpointId: destinationEndpointId,
      channel,
    });

    const inserted = await writeClient.query(
      `insert into icamp_private.messaging_messages (
         organization_id,
         campground_id,
         conversation_id,
         dispatch_id,
         provider_key,
         direction,
         channel,
         purpose,
         delivery_state,
         body_length
       )
       values ($1, $2, $3, $4, $5, 'outbound', $6, $7, 'queued', $8)
       returning *`,
      [
        organizationId,
        campgroundId,
        conversation.id,
        dispatch.id,
        provider.providerKey,
        channel,
        purpose,
        summary.textLength,
      ],
    );

    for (const item of media) {
      await writeClient.query(
        `insert into icamp_private.messaging_attachments (
           message_id,
           media_asset_id,
           content_type,
           byte_size,
           intake_state
         )
         values ($1, $2, $3, $4, 'accepted')`,
        [inserted.rows[0].id, item.mediaAssetId, item.contentType, item.bytes],
      );
    }

    await writeClient.query("commit");

    const providerResult = await provider.sendMessage({
      dispatchId: dispatch.id,
      destination: line.destination_value,
      text,
      mediaReferences: media.map((item) => item.mediaAssetId),
      idempotencyKey,
    });

    await recordCommunicationAttempt({
      dispatchId: dispatch.id,
      providerKey: provider.providerKey,
      attemptState: "accepted",
      retryable: false,
      providerReference: providerResult.providerReference,
    });

    const updated = await getPool().query(
      `update icamp_private.messaging_messages
       set provider_message_reference = $2,
           delivery_state = 'submitted'
       where id = $1
       returning *`,
      [inserted.rows[0].id, providerResult.providerMessageReference],
    );

    await getPool().query(
      `update icamp_private.messaging_conversations
       set last_message_at = statement_timestamp()
       where id = $1`,
      [conversation.id],
    );

    return {
      message: mapMessage(updated.rows[0]),
      duplicate: false,
    };
  } catch (error) {
    try {
      await writeClient.query("rollback");
    } catch {
      // The transaction may already be committed before provider dispatch.
    }
    throw error;
  } finally {
    writeClient.release();
  }
}

async function findInboundLine(client, event) {
  const line = await client.query(
    `select *
     from icamp_private.messaging_lines
     where provider_key = $1
       and provider_number_reference = $2
       and lifecycle_state = 'active'
     limit 1`,
    [event.providerKey, event.providerNumberReference],
  );

  if (line.rowCount !== 1) {
    throw new Error("Inbound messaging line is not registered.");
  }

  return line.rows[0];
}

async function upsertRemoteEndpoint(client, line, remoteAddress) {
  const result = await client.query(
    `insert into icamp_private.communication_endpoints (
       organization_id,
       campground_id,
       endpoint_kind,
       endpoint_value,
       display_hint,
       verified_at
     )
     values ($1, $2, 'phone', $3, $4, null)
     on conflict (
       organization_id,
       campground_id,
       endpoint_kind,
       endpoint_value
     )
     do update set lifecycle_state = 'active'
     returning id`,
    [
      line.organization_id,
      line.campground_id,
      remoteAddress,
      "unverified messaging endpoint",
    ],
  );

  return result.rows[0].id;
}

async function insertProviderEvent(client, { event, dispatchId, metadata }) {
  return client.query(
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
      event.providerKey,
      event.providerEventId,
      dispatchId,
      event.channel,
      event.eventType,
      event.eventStatus,
      JSON.stringify(metadata),
      event.occurredAt,
    ],
  );
}

function deliveryStateForEvent(eventType) {
  if (eventType === "message.sent") return "submitted";
  if (eventType === "message.delivered") return "delivered";
  if (eventType === "message.read") return "read";
  if (eventType === "message.failed") return "failed";
  return null;
}

export async function ingestMessagingProviderEvent(event) {
  const client = await getPool().connect();

  try {
    await client.query("begin");

    const existingEvent = await client.query(
      `select dispatch_id, received_at
       from icamp_private.communication_provider_events
       where provider_key = $1
         and provider_event_id = $2
       limit 1`,
      [event.providerKey, event.providerEventId],
    );

    if (existingEvent.rowCount === 1) {
      const existingMessage = existingEvent.rows[0].dispatch_id
        ? await client.query(
            `select *
             from icamp_private.messaging_messages
             where dispatch_id = $1
             limit 1`,
            [existingEvent.rows[0].dispatch_id],
          )
        : { rowCount: 0, rows: [] };

      await client.query("commit");
      return {
        duplicate: true,
        message: mapMessage(existingMessage.rows[0]),
        command: null,
      };
    }

    const line = await findInboundLine(client, event);

    if (event.eventType !== "message.received") {
      const state = deliveryStateForEvent(event.eventType);
      const target = await client.query(
        `select mm.*
         from icamp_private.messaging_messages mm
         join icamp_private.messaging_conversations mc
           on mc.id = mm.conversation_id
         where mm.provider_key = $1
           and mm.provider_message_reference = $2
           and mc.line_id = $3
         limit 1`,
        [event.providerKey, event.providerMessageReference, line.id],
      );

      if (target.rowCount !== 1) {
        throw new Error("Messaging provider event does not match a message.");
      }

      const deliveredAt =
        state === "delivered" || state === "read" ? event.occurredAt : null;
      const readAt = state === "read" ? event.occurredAt : null;
      const updated = await client.query(
        `update icamp_private.messaging_messages
         set delivery_state = $2,
             delivered_at = coalesce($3, delivered_at),
             read_at = coalesce($4, read_at)
         where id = $1
         returning *`,
        [target.rows[0].id, state, deliveredAt, readAt],
      );

      await client.query(
        `update icamp_private.communication_dispatches
         set delivery_state = $2,
             completed_at = case
               when $2 in ('delivered', 'failed')
               then coalesce(completed_at, $3::timestamptz)
               else completed_at
             end
         where id = $1`,
        [
          target.rows[0].dispatch_id,
          state === "read" ? "delivered" : state,
          event.occurredAt,
        ],
      );

      const providerEvent = await insertProviderEvent(client, {
        event,
        dispatchId: target.rows[0].dispatch_id,
        metadata: {
          rawBodyExcluded: true,
          messageBodyExcluded: true,
          providerPayloadExcluded: true,
        },
      });

      if (providerEvent.rowCount !== 1) {
        await client.query("rollback");
        return {
          duplicate: true,
          message: mapMessage(target.rows[0]),
          command: null,
        };
      }

      await client.query("commit");
      return {
        duplicate: false,
        message: mapMessage(updated.rows[0]),
        command: null,
      };
    }

    if (!event.remoteAddress) {
      throw new Error("Inbound messaging event is missing remote address.");
    }

    const remoteEndpointId = await upsertRemoteEndpoint(
      client,
      line,
      event.remoteAddress,
    );
    const preferenceKeyword = classifyMessagingConsentKeyword(event.text);
    const dispatchResult = await client.query(
      `insert into icamp_private.communication_dispatches (
         organization_id,
         campground_id,
         endpoint_id,
         direction,
         channel,
         purpose,
         idempotency_key,
         delivery_state,
         max_attempts,
         attempt_count,
         completed_at
       )
       values (
         $1,
         $2,
         $3,
         'inbound',
         $4,
         'operational',
         $5,
         'delivered',
         1,
         1,
         $6
       )
       on conflict (campground_id, idempotency_key)
       do update set id = icamp_private.communication_dispatches.id
       returning *`,
      [
        line.organization_id,
        line.campground_id,
        remoteEndpointId,
        event.channel,
        providerEventIdempotency(event.providerKey, event.providerEventId),
        event.occurredAt,
      ],
    );
    const dispatch = dispatchResult.rows[0];

    const existingMessage = await client.query(
      `select *
       from icamp_private.messaging_messages
       where dispatch_id = $1
       limit 1`,
      [dispatch.id],
    );

    if (existingMessage.rowCount === 1) {
      await client.query("commit");
      return {
        duplicate: true,
        message: mapMessage(existingMessage.rows[0]),
        command: null,
      };
    }

    if (preferenceKeyword) {
      await applyMessagingPreferenceKeywordInTransaction(client, {
        organizationId: line.organization_id,
        campgroundId: line.campground_id,
        endpointId: remoteEndpointId,
        providerKey: event.providerKey,
        providerEventId: event.providerEventId,
        action: preferenceKeyword.action,
        occurredAt: event.occurredAt,
      });
    }

    const parsed = preferenceKeyword
      ? {
          kind: "consent." + preferenceKeyword.action,
          source: "keyword",
          action: "consent." + preferenceKeyword.action,
          value: null,
          status: "parsed",
          requiresValidation: false,
        }
      : parseMessagingCommand(event.text);
    const validation = preferenceKeyword
      ? {
          accepted: true,
          state: "navigation",
          action: "consent." + preferenceKeyword.action,
        }
      : validateMessagingCommand(parsed);
    const summary = summarizeMessageForTelemetry({
      text: event.text,
      attachmentCount: event.attachments.length,
      command: parsed,
    });
    const conversation = await ensureConversation(client, {
      organizationId: line.organization_id,
      campgroundId: line.campground_id,
      lineId: line.id,
      remoteEndpointId,
      channel: event.channel,
      occurredAt: event.occurredAt,
    });
    const inserted = await client.query(
      `insert into icamp_private.messaging_messages (
         organization_id,
         campground_id,
         conversation_id,
         dispatch_id,
         provider_key,
         provider_message_reference,
         direction,
         channel,
         purpose,
         delivery_state,
         body_length,
         command_kind,
         command_source,
         command_state,
         occurred_at
       )
       values (
         $1,
         $2,
         $3,
         $4,
         $5,
         $6,
         'inbound',
         $7,
         'operational',
         'received',
         $8,
         $9,
         $10,
         $11,
         $12
       )
       returning *`,
      [
        line.organization_id,
        line.campground_id,
        conversation.id,
        dispatch.id,
        event.providerKey,
        event.providerMessageReference,
        event.channel,
        summary.textLength,
        parsed.kind,
        parsed.source,
        validation.state,
        event.occurredAt,
      ],
    );

    for (const attachment of event.attachments) {
      await client.query(
        `insert into icamp_private.messaging_attachments (
           message_id,
           provider_media_reference,
           content_type,
           byte_size,
           intake_state
         )
         values ($1, $2, $3, $4, 'pending_scan')`,
        [
          inserted.rows[0].id,
          attachment.mediaReference,
          attachment.contentType,
          attachment.bytes,
        ],
      );
    }

    const providerEvent = await insertProviderEvent(client, {
      event,
      dispatchId: dispatch.id,
      metadata: {
        commandKind: parsed.kind,
        commandSource: parsed.source,
        commandState: validation.state,
        attachmentCount: summary.attachmentCount,
        textLength: summary.textLength,
        rawBodyExcluded: true,
        messageBodyExcluded: true,
        providerPayloadExcluded: true,
      },
    });

    if (providerEvent.rowCount !== 1) {
      await client.query("rollback");
      return {
        duplicate: true,
        message: null,
        command: null,
      };
    }

    await client.query("commit");

    return {
      duplicate: false,
      message: mapMessage(inserted.rows[0]),
      command: {
        kind: parsed.kind,
        source: parsed.source,
        validation,
      },
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function getMessagingGatewayHealth() {
  const [lines, messages, attachments] = await Promise.all([
    getPool().query(
      `select
         count(*) filter (where lifecycle_state = 'active')::integer as active,
         count(*) filter (
           where lifecycle_state = 'active' and sandbox_mode
         )::integer as sandbox
       from icamp_private.messaging_lines`,
    ),
    getPool().query(
      `select
         count(*) filter (
           where occurred_at >= statement_timestamp() - interval '24 hours'
             and direction = 'inbound'
         )::integer as inbound_24h,
         count(*) filter (
           where occurred_at >= statement_timestamp() - interval '24 hours'
             and direction = 'outbound'
         )::integer as outbound_24h,
         count(*) filter (
           where occurred_at >= statement_timestamp() - interval '24 hours'
             and delivery_state = 'failed'
         )::integer as failed_24h,
         count(*) filter (
           where occurred_at >= statement_timestamp() - interval '24 hours'
             and command_state in (
               'verification_required',
               'validation_required'
             )
         )::integer as gated_commands_24h
       from icamp_private.messaging_messages`,
    ),
    getPool().query(
      `select count(*) filter (
         where intake_state = 'pending_scan'
       )::integer as pending_scan
       from icamp_private.messaging_attachments`,
    ),
  ]);

  const l = lines.rows[0];
  const m = messages.rows[0];
  const a = attachments.rows[0];
  const degraded = Number(m.failed_24h) > 0;

  return {
    status: degraded ? "degraded" : "operational",
    lines: {
      active: Number(l.active),
      sandbox: Number(l.sandbox),
    },
    messages: {
      inbound24h: Number(m.inbound_24h),
      outbound24h: Number(m.outbound_24h),
      failed24h: Number(m.failed_24h),
      gatedCommands24h: Number(m.gated_commands_24h),
    },
    attachments: {
      pendingScan: Number(a.pending_scan),
    },
  };
}

export async function closeMessagingPoolForTests() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}
