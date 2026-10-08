import assert from "node:assert/strict";

import pg from "pg";

import { closeAuthorizationPoolForTests } from "../lib/authz/postgres.mjs";
import { closeCommunicationsPoolForTests } from "../lib/communications/postgres.mjs";
import {
  closeMessagingConsentPoolForTests,
  configureMessagingComplianceRule,
  getMessagingConsentHealth,
  recordMessagingMarketingConsent,
} from "../lib/consent/postgres.mjs";
import {
  closeMessagingPoolForTests,
  ingestMessagingProviderEvent,
  registerMessagingLine,
  startOutboundMessage,
} from "../lib/messaging/postgres.mjs";
import { createMockMessagingProvider } from "../lib/messaging/provider.mjs";

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for Build 014 verification.");
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
     values ('Build 014 Lifecycle Org', 'build-014-lifecycle-org')
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
       'Build 014 Lifecycle Camp',
       'build-014-lifecycle-camp',
       'America/Toronto'
     )
     returning id`,
    [organizationId],
  );
  const campgroundId = campground.rows[0].id;

  const ownerId = await createStaff("build014-owner@example.test");
  await assignOwner(ownerId, organizationId, campgroundId);

  const lineEndpointId = await createPhoneEndpoint({
    organizationId,
    campgroundId,
    value: "+15555551401",
    hint: "campground SMS line ending 1401",
  });
  const guestEndpointId = await createPhoneEndpoint({
    organizationId,
    campgroundId,
    value: "+15555551402",
    hint: "guest SMS line ending 1402",
  });

  const rule = await configureMessagingComplianceRule({
    actorUserId: ownerId,
    organizationId,
    campgroundId,
    jurisdictionCode: "CA-ON",
    isDefault: true,
    marketingRequiresConsent: true,
    marketingConsentExpiryDays: null,
    stopSuppressesAll: true,
    startGrantsMarketingConsent: false,
    helpAllowedWhenSuppressed: true,
  });
  assert.equal(rule.jurisdictionCode, "CA-ON");
  assert.equal(rule.startGrantsMarketingConsent, false);

  const line = await registerMessagingLine({
    actorUserId: ownerId,
    organizationId,
    campgroundId,
    endpointId: lineEndpointId,
    providerKey: "mock",
    providerNumberReference: "mock-number-1401",
    sandboxMode: true,
  });

  const provider = createMockMessagingProvider();

  const initialOperational = await startOutboundMessage({
    actorUserId: ownerId,
    organizationId,
    campgroundId,
    lineId: line.id,
    destinationEndpointId: guestEndpointId,
    purpose: "operational",
    idempotencyKey: "build014-operational-before-stop",
    text: "Your campsite is ready.",
    provider,
  });
  assert.equal(initialOperational.duplicate, false);

  const stopEvent = provider.normalizeWebhook(
    JSON.stringify({
      eventType: "message.received",
      eventId: "build014-stop-1",
      messageReference: "mock-build014-stop-1",
      numberReference: "mock-number-1401",
      from: "+15555551402",
      channel: "sms",
      text: "STOP",
      occurredAt: new Date().toISOString(),
    }),
  );
  const stopped = await ingestMessagingProviderEvent(stopEvent);
  assert.equal(stopped.command.kind, "consent.stop");
  assert.equal(stopped.command.validation.action, "consent.stop");

  const stoppedState = await setupPool.query(
    `select provider_suppressed, jurisdiction_code
     from icamp_private.messaging_preference_state
     where endpoint_id = $1`,
    [guestEndpointId],
  );
  assert.equal(stoppedState.rows[0].provider_suppressed, true);
  assert.equal(stoppedState.rows[0].jurisdiction_code, "CA-ON");

  const stoppedPreference = await setupPool.query(
    `select preference_state
     from icamp_private.communication_preferences
     where endpoint_id = $1
       and purpose = 'marketing'
       and channel = 'sms'`,
    [guestEndpointId],
  );
  assert.equal(stoppedPreference.rows[0].preference_state, "disabled");

  const stoppedConsent = await setupPool.query(
    `select consent_state
     from icamp_private.communication_consents
     where endpoint_id = $1
       and purpose = 'marketing'
       and channel = 'sms'
     order by occurred_at desc, id desc
     limit 1`,
    [guestEndpointId],
  );
  assert.equal(stoppedConsent.rows[0].consent_state, "withdrawn");

  await assert.rejects(
    () =>
      startOutboundMessage({
        actorUserId: ownerId,
        organizationId,
        campgroundId,
        lineId: line.id,
        destinationEndpointId: guestEndpointId,
        purpose: "operational",
        idempotencyKey: "build014-blocked-after-stop",
        text: "This ordinary message must be blocked.",
        provider,
      }),
    /provider_suppressed/,
  );

  const helpResponse = await startOutboundMessage({
    actorUserId: ownerId,
    organizationId,
    campgroundId,
    lineId: line.id,
    destinationEndpointId: guestEndpointId,
    purpose: "operational",
    messageKind: "help_response",
    idempotencyKey: "build014-help-response",
    text: "Reply START to resume messaging. Promotional consent is managed separately.",
    provider,
  });
  assert.equal(helpResponse.duplicate, false);

  const helpEvent = provider.normalizeWebhook(
    JSON.stringify({
      eventType: "message.received",
      eventId: "build014-help-1",
      messageReference: "mock-build014-help-1",
      numberReference: "mock-number-1401",
      from: "+15555551402",
      channel: "sms",
      text: "HELP",
      occurredAt: new Date().toISOString(),
    }),
  );
  const helped = await ingestMessagingProviderEvent(helpEvent);
  assert.equal(helped.command.kind, "consent.help");

  const startEvent = provider.normalizeWebhook(
    JSON.stringify({
      eventType: "message.received",
      eventId: "build014-start-1",
      messageReference: "mock-build014-start-1",
      numberReference: "mock-number-1401",
      from: "+15555551402",
      channel: "sms",
      text: "START",
      occurredAt: new Date().toISOString(),
    }),
  );
  const started = await ingestMessagingProviderEvent(startEvent);
  assert.equal(started.command.kind, "consent.start");

  const startedState = await setupPool.query(
    `select provider_suppressed
     from icamp_private.messaging_preference_state
     where endpoint_id = $1`,
    [guestEndpointId],
  );
  assert.equal(startedState.rows[0].provider_suppressed, false);

  const afterStartConsent = await setupPool.query(
    `select consent_state
     from icamp_private.communication_consents
     where endpoint_id = $1
       and purpose = 'marketing'
       and channel = 'sms'
     order by occurred_at desc, id desc
     limit 1`,
    [guestEndpointId],
  );
  assert.equal(afterStartConsent.rows[0].consent_state, "withdrawn");

  await assert.rejects(
    () =>
      startOutboundMessage({
        actorUserId: ownerId,
        organizationId,
        campgroundId,
        lineId: line.id,
        destinationEndpointId: guestEndpointId,
        purpose: "marketing",
        idempotencyKey: "build014-marketing-before-consent",
        text: "Promotional message must still be blocked.",
        provider,
      }),
    /preference_disabled|marketing_consent_required/,
  );

  const consent = await recordMessagingMarketingConsent({
    actorUserId: ownerId,
    organizationId,
    campgroundId,
    endpointId: guestEndpointId,
    channel: "sms",
    consentState: "granted",
    evidenceSource: "user",
    evidenceReference: "synthetic-explicit-consent-build014",
  });
  assert.equal(consent.consentState, "granted");

  const marketing = await startOutboundMessage({
    actorUserId: ownerId,
    organizationId,
    campgroundId,
    lineId: line.id,
    destinationEndpointId: guestEndpointId,
    purpose: "marketing",
    idempotencyKey: "build014-marketing-after-consent",
    text: "Synthetic promotion after explicit consent.",
    provider,
  });
  assert.equal(marketing.duplicate, false);

  const duplicateStart = await ingestMessagingProviderEvent(startEvent);
  assert.equal(duplicateStart.duplicate, true);

  const eventCount = await setupPool.query(
    `select count(*)::integer as count
     from icamp_private.messaging_preference_events
     where provider_key = 'mock'
       and provider_event_id = 'build014-start-1'`,
  );
  assert.equal(eventCount.rows[0].count, 1);

  const forbiddenColumns = await setupPool.query(
    `select column_name
     from information_schema.columns
     where table_schema = 'icamp_private'
       and table_name in (
         'messaging_preference_state',
         'messaging_preference_events'
       )
       and column_name in (
         'phone_number',
         'endpoint_value',
         'message_body',
         'raw_body',
         'raw_message',
         'message_text'
       )`,
  );
  assert.equal(forbiddenColumns.rowCount, 0);

  const ledgerEvidence = await setupPool.query(
    `select coalesce(string_agg(metadata::text, ' '), '') as evidence
     from icamp_private.messaging_preference_events
     where endpoint_id = $1`,
    [guestEndpointId],
  );
  assert.doesNotMatch(ledgerEvidence.rows[0].evidence, /\+15555551402/u);
  assert.match(ledgerEvidence.rows[0].evidence, /rawMessageExcluded/u);

  const health = await getMessagingConsentHealth();
  assert.equal(health.endpoints.tracked >= 1, true);
  assert.equal(health.keywords24h.stop >= 1, true);
  assert.equal(health.keywords24h.start >= 1, true);
  assert.equal(health.keywords24h.help >= 1, true);
  assert.equal(health.complianceRules.active >= 1, true);
  assert.equal(health.privacy.messageBodiesExcluded, true);

  process.stdout.write(
    "Build 014 messaging consent, STOP/START/HELP and preference-ledger verification passed.\n",
  );
} finally {
  await closeMessagingConsentPoolForTests();
  await closeMessagingPoolForTests();
  await closeCommunicationsPoolForTests();
  await closeAuthorizationPoolForTests();
  await setupPool.end();
}
