import pg from "pg";

import { appendAuditEvent } from "../audit/postgres.mjs";
import { hasCampgroundPermission } from "../authz/postgres.mjs";
import {
  assertDeviceSupportsGateCommand,
  normalizeGateOverrideInput,
  normalizeGateProviderOutcome,
} from "./override.mjs";

const { Pool } = pg;
let pool;

function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL?.trim();
    if (!connectionString) {
      throw new Error("DATABASE_URL is required for gate override operations.");
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

export async function closeGateOverridePoolForTests() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

async function findExistingRequest(campgroundId, requestId) {
  const result = await getPool().query(
    `select
       r.id,
       r.command,
       r.requested_at,
       o.outcome,
       o.provider_command_reference,
       o.provider_status,
       o.provider_message,
       o.occurred_at as outcome_occurred_at
     from public.gate_override_requests r
     left join lateral (
       select
         outcome,
         provider_command_reference,
         provider_status,
         provider_message,
         occurred_at
       from public.gate_override_outcomes
       where request_id=r.id
       order by occurred_at desc
       limit 1
     ) o on true
     where r.campground_id=$1
       and r.request_id=$2
     limit 1`,
    [campgroundId, requestId],
  );

  return result.rows[0] ?? null;
}

async function appendOutcome(client, request, providerOutcome) {
  const normalized = normalizeGateProviderOutcome(providerOutcome);

  const result = await client.query(
    `insert into public.gate_override_outcomes (
       organization_id,
       campground_id,
       request_id,
       outcome,
       provider_command_reference,
       provider_status,
       provider_message,
       provider_metadata
     )
     values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
     returning id,outcome,occurred_at`,
    [
      request.organizationId,
      request.campgroundId,
      request.id,
      normalized.outcome,
      normalized.providerCommandReference,
      normalized.providerStatus,
      normalized.providerMessage,
      JSON.stringify(normalized.providerMetadata),
    ],
  );

  return {
    ...normalized,
    id: result.rows[0].id,
    occurredAt: result.rows[0].occurred_at,
  };
}

export async function executeManualGateOverride({
  actorUserId,
  actorSessionId,
  campgroundId,
  deviceId,
  command,
  reason,
  reauthenticatedAt,
  assuranceLevel,
  requestId,
  requestTraceId = null,
  sourceChannel = "web",
  provider,
}) {
  const normalized = normalizeGateOverrideInput({
    command,
    reason,
    reauthenticatedAt,
    assuranceLevel,
    requestId,
    sourceChannel,
  });

  const existing = await findExistingRequest(campgroundId, normalized.requestId);
  if (existing) {
    return { duplicate: true, request: existing };
  }

  const allowed = await hasCampgroundPermission(
    actorUserId,
    campgroundId,
    normalized.permission,
  );

  if (!allowed) {
    throw new Error(`Not authorized for ${normalized.permission}.`);
  }

  const client = await getPool().connect();
  let request;

  try {
    await client.query("begin");

    const deviceResult = await client.query(
      `select
         id,
         organization_id,
         campground_id,
         display_name,
         provider_code,
         provider_device_reference,
         capabilities,
         is_active
       from public.access_devices
       where campground_id=$1
         and id=$2
       limit 1`,
      [campgroundId, deviceId],
    );

    const row = deviceResult.rows[0];
    if (!row) {
      throw new Error("Access device does not exist.");
    }

    assertDeviceSupportsGateCommand(
      {
        isActive: row.is_active,
        capabilities: row.capabilities,
      },
      normalized.command,
    );

    const inserted = await client.query(
      `insert into public.gate_override_requests (
         organization_id,
         campground_id,
         device_id,
         command,
         actor_user_id,
         actor_session_id,
         reason,
         source_channel,
         request_id,
         reauthenticated_at,
         assurance_level,
         provider_code,
         provider_device_reference
       )
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       returning id,organization_id,campground_id,requested_at`,
      [
        row.organization_id,
        row.campground_id,
        row.id,
        normalized.command,
        actorUserId,
        actorSessionId,
        normalized.reason,
        normalized.sourceChannel,
        normalized.requestId,
        normalized.reauthenticatedAt,
        normalized.assuranceLevel,
        row.provider_code,
        row.provider_device_reference,
      ],
    );

    request = {
      id: inserted.rows[0].id,
      organizationId: inserted.rows[0].organization_id,
      campgroundId: inserted.rows[0].campground_id,
      deviceId: row.id,
      deviceName: row.display_name,
      command: normalized.command,
      requestedAt: inserted.rows[0].requested_at,
      providerCode: row.provider_code,
      providerDeviceReference: row.provider_device_reference,
    };

    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: request.organizationId,
      campgroundId: request.campgroundId,
      actionKey: `access.gate_override.${normalized.command}`,
      permissionKey: normalized.permission,
      riskLevel: "high",
      outcome: "succeeded",
      reason: normalized.reason,
      subjectType: "access.device",
      subjectId: request.deviceId,
      requestId: requestTraceId ?? normalized.requestId,
      afterState: {
        command: request.command,
        overrideRequestId: request.id,
        requestedAt: request.requestedAt,
      },
      metadata: {
        sourceChannel: normalized.sourceChannel,
      },
      reauthenticatedAt: normalized.reauthenticatedAt,
      assuranceLevel: normalized.assuranceLevel,
    });

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }

  if (!provider?.sendGateCommand) {
    const client2 = await getPool().connect();
    try {
      await client2.query("begin");
      const outcome = await appendOutcome(client2, request, {
        outcome: "unsupported",
        providerStatus: "provider_unavailable",
        providerMessage: "No gate command provider is configured.",
      });

      await appendAuditEvent(client2, {
        actorUserId,
        actorSessionId,
        organizationId: request.organizationId,
        campgroundId: request.campgroundId,
        actionKey: "access.gate_override.provider_result",
        permissionKey: normalized.permission,
        riskLevel: "high",
        outcome: "failed",
        reason: normalized.reason,
        subjectType: "access.gate_override_request",
        subjectId: request.id,
        requestId: requestTraceId ?? normalized.requestId,
        afterState: {
          providerOutcome: outcome.outcome,
          providerStatus: outcome.providerStatus,
        },
        reauthenticatedAt: normalized.reauthenticatedAt,
        assuranceLevel: normalized.assuranceLevel,
      });

      await client2.query("commit");
      return { duplicate: false, request, outcome };
    } catch (error) {
      await client2.query("rollback");
      throw error;
    } finally {
      client2.release();
    }
  }

  let providerResult;
  try {
    providerResult = await provider.sendGateCommand({
      requestId: request.id,
      command: request.command,
      providerCode: request.providerCode,
      providerDeviceReference: request.providerDeviceReference,
    });
  } catch (error) {
    providerResult = {
      outcome: "failed",
      providerStatus: "provider_exception",
      providerMessage: String(error?.message ?? "Gate provider command failed").slice(0, 500),
    };
  }

  const client3 = await getPool().connect();
  try {
    await client3.query("begin");
    const outcome = await appendOutcome(client3, request, providerResult);
    const auditOutcome = outcome.outcome === "succeeded" ? "succeeded" : "failed";

    await appendAuditEvent(client3, {
      actorUserId,
      actorSessionId,
      organizationId: request.organizationId,
      campgroundId: request.campgroundId,
      actionKey: "access.gate_override.provider_result",
      permissionKey: normalized.permission,
      riskLevel: "high",
      outcome: auditOutcome,
      reason: normalized.reason,
      subjectType: "access.gate_override_request",
      subjectId: request.id,
      requestId: requestTraceId ?? normalized.requestId,
      afterState: {
        providerOutcome: outcome.outcome,
        providerStatus: outcome.providerStatus,
        providerCommandReference: outcome.providerCommandReference,
      },
      reauthenticatedAt: normalized.reauthenticatedAt,
      assuranceLevel: normalized.assuranceLevel,
    });

    await client3.query("commit");
    return { duplicate: false, request, outcome };
  } catch (error) {
    await client3.query("rollback");
    throw error;
  } finally {
    client3.release();
  }
}
