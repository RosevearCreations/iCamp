import assert from "node:assert/strict";

import pg from "pg";

import { closeAuthorizationPoolForTests } from "../lib/authz/postgres.mjs";
import { closeCommunicationsPoolForTests } from "../lib/communications/postgres.mjs";
import {
  advanceVoiceIvr,
  closeVoicePoolForTests,
  getVoiceGatewayHealth,
  ingestVoiceProviderEvent,
  registerVoiceLine,
  startOutboundVoiceCall,
} from "../lib/voice/postgres.mjs";
import { createMockVoiceProvider } from "../lib/voice/provider.mjs";

const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for Build 010 verification.");
}

const setupPool = new Pool({ connectionString: databaseUrl, max: 2 });

async function createStaff(email) {
  const result = await setupPool.query(
    `insert into icamp_private.user_accounts (
       email_normalized,
       account_type
     )
     values ($1, 'staff')
     returning id`,
    [email],
  );

  return result.rows[0].id;
}

async function assignOwner(userId, organizationId, campgroundId) {
  const assignment = await setupPool.query(
    `insert into icamp_private.campground_assignments (
       user_id,
       organization_id,
       campground_id
     )
     values ($1, $2, $3)
     returning id`,
    [userId, organizationId, campgroundId],
  );

  const role = await setupPool.query(
    `select id
     from icamp_private.roles
     where role_kind = 'template'
       and role_code = 'owner_admin'
       and lifecycle_state = 'active'
     limit 1`,
  );

  assert.equal(role.rowCount, 1);

  await setupPool.query(
    `insert into icamp_private.campground_assignment_roles (
       assignment_id,
       role_id
     )
     values ($1, $2)`,
    [assignment.rows[0].id, role.rows[0].id],
  );
}

async function createPhoneEndpoint({
  organizationId,
  campgroundId,
  value,
  hint,
}) {
  const result = await setupPool.query(
    `insert into icamp_private.communication_endpoints (
       organization_id,
       campground_id,
       endpoint_kind,
       endpoint_value,
       display_hint,
       verified_at
     )
     values ($1, $2, 'phone', $3, $4, statement_timestamp())
     returning id`,
    [organizationId, campgroundId, value, hint],
  );

  return result.rows[0].id;
}

try {
  const organization = await setupPool.query(
    `insert into public.organizations (name, slug)
     values ('Build 010 Lifecycle Org', 'build-010-lifecycle-org')
     returning id`,
  );
  const organizationId = organization.rows[0].id;

  const campground = await setupPool.query(
    `insert into public.campgrounds (
       organization_id,
       name,
       slug,
       timezone
     )
     values (
       $1,
       'Build 010 Lifecycle Camp',
       'build-010-lifecycle-camp',
       'America/Toronto'
     )
     returning id`,
    [organizationId],
  );
  const campgroundId = campground.rows[0].id;

  const ownerId = await createStaff("build010-owner@example.test");
  const unassignedId = await createStaff("build010-unassigned@example.test");

  await assignOwner(ownerId, organizationId, campgroundId);

  const lineEndpointId = await createPhoneEndpoint({
    organizationId,
    campgroundId,
    value: "+15555551011",
    hint: "campground line ending 1011",
  });
  const staffEndpointId = await createPhoneEndpoint({
    organizationId,
    campgroundId,
    value: "+15555551012",
    hint: "staff line ending 1012",
  });
  const destinationEndpointId = await createPhoneEndpoint({
    organizationId,
    campgroundId,
    value: "+15555551013",
    hint: "guest line ending 1013",
  });

  await assert.rejects(
    () =>
      registerVoiceLine({
        actorUserId: unassignedId,
        organizationId,
        campgroundId,
        endpointId: lineEndpointId,
        providerKey: "mock",
        providerNumberReference: "mock-number-unauthorized",
      }),
    /Not authorized for voice gateway operation/,
  );

  const line = await registerVoiceLine({
    actorUserId: ownerId,
    organizationId,
    campgroundId,
    endpointId: lineEndpointId,
    providerKey: "mock",
    providerNumberReference: "mock-number-1011",
    staffTransferEndpointId: staffEndpointId,
    sandboxMode: true,
  });

  assert.equal(line.sandboxMode, true);
  assert.equal(Object.hasOwn(line, "providerNumberReference"), false);

  const provider = createMockVoiceProvider();

  const outbound = await startOutboundVoiceCall({
    actorUserId: ownerId,
    organizationId,
    campgroundId,
    lineId: line.id,
    destinationEndpointId,
    purpose: "operational",
    idempotencyKey: "build010-outbound-voice-001",
    provider,
  });

  assert.equal(outbound.direction, "outbound");
  assert.equal(outbound.callState, "ringing");

  const outboundDuplicate = await startOutboundVoiceCall({
    actorUserId: ownerId,
    organizationId,
    campgroundId,
    lineId: line.id,
    destinationEndpointId,
    purpose: "operational",
    idempotencyKey: "build010-outbound-voice-001",
    provider,
  });

  assert.equal(outboundDuplicate.id, outbound.id);

  const inboundEvent = {
    providerKey: "mock",
    providerEventId: "build010-inbound-event-1",
    providerCallReference: "mock-inbound-call-1",
    providerNumberReference: "mock-number-1011",
    eventType: "call.initiated",
    eventStatus: "ringing",
    direction: "inbound",
    occurredAt: new Date().toISOString(),
    sandbox: true,
  };

  const inbound = await ingestVoiceProviderEvent(inboundEvent);

  assert.equal(inbound.inserted, true);
  assert.equal(inbound.call.direction, "inbound");
  assert.equal(inbound.call.callState, "ringing");
  assert.ok(inbound.sessionId);

  const duplicateInbound = await ingestVoiceProviderEvent(inboundEvent);
  assert.equal(duplicateInbound.duplicate, true);
  assert.equal(duplicateInbound.call.id, inbound.call.id);

  const transfer = await advanceVoiceIvr({
    callId: inbound.call.id,
    eventType: "staff_transfer",
    provider,
  });

  assert.equal(transfer.action, "transfer.staff");
  assert.equal(transfer.transfer.transferred, true);
  assert.equal(transfer.transfer.fallback, false);

  const completed = await ingestVoiceProviderEvent({
    ...inboundEvent,
    providerEventId: "build010-inbound-event-2",
    eventType: "call.completed",
    eventStatus: "completed",
    occurredAt: new Date().toISOString(),
  });

  assert.equal(completed.call.callState, "completed");
  assert.ok(completed.call.endedAt);

  const ivrEvent = await setupPool.query(
    `select id
     from icamp_private.voice_ivr_events
     where session_id = $1
     order by occurred_at desc
     limit 1`,
    [inbound.sessionId],
  );

  assert.equal(ivrEvent.rowCount, 1);

  await assert.rejects(
    () =>
      setupPool.query(
        `update icamp_private.voice_ivr_events
         set action_key = 'mutation.must.fail'
         where id = $1`,
        [ivrEvent.rows[0].id],
      ),
    /append-only/,
  );

  const health = await getVoiceGatewayHealth();
  assert.equal(health.lines.active >= 1, true);
  assert.equal(health.lines.sandbox >= 1, true);

  process.stdout.write(
    "Build 010 inbound/outbound voice and IVR lifecycle verification passed.\n",
  );
} finally {
  await closeVoicePoolForTests();
  await closeCommunicationsPoolForTests();
  await closeAuthorizationPoolForTests();
  await setupPool.end();
}
