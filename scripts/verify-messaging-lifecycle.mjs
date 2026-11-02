import assert from "node:assert/strict";

import pg from "pg";

import { closeAuthorizationPoolForTests } from "../lib/authz/postgres.mjs";
import { closeCommunicationsPoolForTests } from "../lib/communications/postgres.mjs";
import {
  closeMessagingPoolForTests,
  getMessagingGatewayHealth,
  ingestMessagingProviderEvent,
  registerMessagingLine,
  startOutboundMessage,
} from "../lib/messaging/postgres.mjs";
import { createMockMessagingProvider } from "../lib/messaging/provider.mjs";

const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for Build 012 verification.");
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
  verified = true,
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
     values ($1, $2, 'phone', $3, $4, $5)
     returning id`,
    [
      organizationId,
      campgroundId,
      value,
      hint,
      verified ? new Date().toISOString() : null,
    ],
  );

  return result.rows[0].id;
}

try {
  const organization = await setupPool.query(
    `insert into public.organizations (name, slug)
     values ('Build 012 Lifecycle Org', 'build-012-lifecycle-org')
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
       'Build 012 Lifecycle Camp',
       'build-012-lifecycle-camp',
       'America/Toronto'
     )
     returning id`,
    [organizationId],
  );
  const campgroundId = campground.rows[0].id;

  const ownerId = await createStaff("build012-owner@example.test");
  const unassignedId = await createStaff("build012-unassigned@example.test");

  await assignOwner(ownerId, organizationId, campgroundId);

  const lineEndpointId = await createPhoneEndpoint({
    organizationId,
    campgroundId,
    value: "+15555551211",
    hint: "campground SMS line ending 1211",
  });
  const destinationEndpointId = await createPhoneEndpoint({
    organizationId,
    campgroundId,
    value: "+15555551212",
    hint: "guest SMS line ending 1212",
  });

  await assert.rejects(
    () =>
      registerMessagingLine({
        actorUserId: unassignedId,
        organizationId,
        campgroundId,
        endpointId: lineEndpointId,
        providerKey: "mock",
        providerNumberReference: "mock-number-unauthorized",
      }),
    /Not authorized for messaging gateway operation/,
  );

  const line = await registerMessagingLine({
    actorUserId: ownerId,
    organizationId,
    campgroundId,
    endpointId: lineEndpointId,
    providerKey: "mock",
    providerNumberReference: "mock-number-1211",
    sandboxMode: true,
  });

  assert.equal(line.sandboxMode, true);
  assert.equal(Object.hasOwn(line, "providerNumberReference"), false);

  const provider = createMockMessagingProvider();

  const outbound = await startOutboundMessage({
    actorUserId: ownerId,
    organizationId,
    campgroundId,
    lineId: line.id,
    destinationEndpointId,
    purpose: "operational",
    idempotencyKey: "build012-outbound-sms-001",
    text: "Welcome to the campground.",
    provider,
  });

  assert.equal(outbound.duplicate, false);
  assert.equal(outbound.message.channel, "sms");
  assert.equal(outbound.message.deliveryState, "submitted");

  const outboundDuplicate = await startOutboundMessage({
    actorUserId: ownerId,
    organizationId,
    campgroundId,
    lineId: line.id,
    destinationEndpointId,
    purpose: "operational",
    idempotencyKey: "build012-outbound-sms-001",
    text: "Welcome to the campground.",
    provider,
  });

  assert.equal(outboundDuplicate.duplicate, true);
  assert.equal(outboundDuplicate.message.id, outbound.message.id);

  const structuredInbound = provider.normalizeWebhook(
    JSON.stringify({
      eventType: "message.received",
      eventId: "build012-inbound-1",
      messageReference: "mock-inbound-1",
      numberReference: "mock-number-1211",
      from: "+15555551213",
      channel: "sms",
      text: "SITE 120",
      occurredAt: new Date().toISOString(),
    }),
  );

  const inbound = await ingestMessagingProviderEvent(structuredInbound);
  assert.equal(inbound.duplicate, false);
  assert.equal(inbound.command.kind, "lookup.site");
  assert.equal(inbound.command.validation.accepted, false);
  assert.equal(inbound.command.validation.state, "verification_required");

  const inboundDuplicate =
    await ingestMessagingProviderEvent(structuredInbound);
  assert.equal(inboundDuplicate.duplicate, true);

  const naturalLanguageInbound = provider.normalizeWebhook(
    JSON.stringify({
      eventType: "message.received",
      eventId: "build012-inbound-2",
      messageReference: "mock-inbound-2",
      numberReference: "mock-number-1211",
      from: "+15555551213",
      channel: "sms",
      text: "Please check reservation number 7654321",
      occurredAt: new Date().toISOString(),
    }),
  );

  const proposed = await ingestMessagingProviderEvent(naturalLanguageInbound);
  assert.equal(proposed.command.source, "natural_language");
  assert.equal(proposed.command.validation.accepted, false);
  assert.equal(proposed.command.validation.state, "validation_required");

  const mmsInbound = provider.normalizeWebhook(
    JSON.stringify({
      eventType: "message.received",
      eventId: "build012-inbound-3",
      messageReference: "mock-inbound-3",
      numberReference: "mock-number-1211",
      from: "+15555551213",
      channel: "mms",
      text: "HELP",
      attachments: [
        {
          mediaReference: "mock-media-1",
          contentType: "image/jpeg",
          bytes: 4096,
        },
      ],
      occurredAt: new Date().toISOString(),
    }),
  );

  const mms = await ingestMessagingProviderEvent(mmsInbound);
  assert.equal(mms.message.channel, "mms");

  const pendingAttachment = await setupPool.query(
    `select intake_state
     from icamp_private.messaging_attachments
     where message_id = $1`,
    [mms.message.id],
  );
  assert.equal(pendingAttachment.rows[0].intake_state, "pending_scan");

  const providerMessageReference =
    "mock-message:" + outbound.message.dispatchId;

  const delivered = await ingestMessagingProviderEvent(
    provider.normalizeWebhook(
      JSON.stringify({
        eventType: "message.delivered",
        eventId: "build012-delivered-1",
        messageReference: providerMessageReference,
        numberReference: "mock-number-1211",
        to: "+15555551212",
        channel: "sms",
        occurredAt: new Date().toISOString(),
      }),
    ),
  );
  assert.equal(delivered.message.deliveryState, "delivered");

  const read = await ingestMessagingProviderEvent(
    provider.normalizeWebhook(
      JSON.stringify({
        eventType: "message.read",
        eventId: "build012-read-1",
        messageReference: providerMessageReference,
        numberReference: "mock-number-1211",
        to: "+15555551212",
        channel: "sms",
        occurredAt: new Date().toISOString(),
      }),
    ),
  );
  assert.equal(read.message.deliveryState, "read");
  assert.ok(read.message.readAt);

  const providerEvidence = await setupPool.query(
    `select coalesce(string_agg(metadata::text, ' '), '') as evidence
     from icamp_private.communication_provider_events
     where provider_event_id like 'build012-%'`,
  );
  const providerText = providerEvidence.rows[0].evidence;
  assert.doesNotMatch(providerText, /7654321/u);
  assert.doesNotMatch(providerText, /Please check reservation/u);
  assert.match(providerText, /messageBodyExcluded/u);

  const rawColumns = await setupPool.query(
    `select column_name
     from information_schema.columns
     where table_schema = 'icamp_private'
       and table_name = 'messaging_messages'
       and column_name in ('body', 'message_body', 'raw_body', 'text')`,
  );
  assert.equal(rawColumns.rowCount, 0);

  const health = await getMessagingGatewayHealth();
  assert.equal(health.lines.active >= 1, true);
  assert.equal(health.lines.sandbox >= 1, true);
  assert.equal(health.messages.inbound24h >= 3, true);
  assert.equal(health.messages.outbound24h >= 1, true);
  assert.equal(health.messages.gatedCommands24h >= 2, true);
  assert.equal(health.attachments.pendingScan >= 1, true);

  process.stdout.write(
    "Build 012 SMS/MMS conversation and command lifecycle verification passed.\n",
  );
} finally {
  await closeMessagingPoolForTests();
  await closeCommunicationsPoolForTests();
  await closeAuthorizationPoolForTests();
  await setupPool.end();
}
