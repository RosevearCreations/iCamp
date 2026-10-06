import assert from "node:assert/strict";

import pg from "pg";

import {
  closeCommunicationsPoolForTests,
  communicationRetryDelaySeconds,
  createCommunicationDispatch,
  getCommunicationsHealth,
  recordCommunicationAttempt,
  recordCommunicationConsent,
  recordCommunicationProviderEvent,
  registerCommunicationEndpoint,
  setCommunicationPreference,
} from "../lib/communications/postgres.mjs";
import { createMockCommunicationsProvider } from "../lib/communications/provider.mjs";

const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for Build 009 verification.");
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

try {
  assert.equal(communicationRetryDelaySeconds(1), 30);
  assert.equal(communicationRetryDelaySeconds(2), 60);
  assert.equal(communicationRetryDelaySeconds(20), 3600);

  const organization = await setupPool.query(
    `insert into public.organizations (name, slug)
     values ('Build 009 Lifecycle Org', 'build-009-lifecycle-org')
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
       'Build 009 Lifecycle Camp',
       'build-009-lifecycle-camp',
       'America/Toronto'
     )
     returning id`,
    [organizationId],
  );
  const campgroundId = campground.rows[0].id;

  const ownerId = await createStaff("build009-owner@example.test");
  const unassignedId = await createStaff("build009-unassigned@example.test");

  await assignOwner(ownerId, organizationId, campgroundId);

  await assert.rejects(
    () =>
      registerCommunicationEndpoint({
        actorUserId: unassignedId,
        organizationId,
        campgroundId,
        endpointKind: "phone",
        endpointValue: "+15555550101",
        displayHint: "phone ending 0101",
      }),
    /Not authorized for communication operation/,
  );

  const endpoint = await registerCommunicationEndpoint({
    actorUserId: ownerId,
    organizationId,
    campgroundId,
    endpointKind: "phone",
    endpointValue: "+15555550199",
    displayHint: "phone ending 0199",
    verifiedAt: new Date(),
  });

  assert.equal(endpoint.endpointKind, "phone");
  assert.equal(endpoint.displayHint, "phone ending 0199");
  assert.equal(Object.hasOwn(endpoint, "endpointValue"), false);

  const preference = await setCommunicationPreference({
    actorUserId: ownerId,
    campgroundId,
    endpointId: endpoint.id,
    purpose: "operational",
    channel: "sms",
    preferenceState: "enabled",
    source: "user",
  });

  assert.equal(preference.preferenceState, "enabled");

  const consent = await recordCommunicationConsent({
    actorUserId: ownerId,
    campgroundId,
    endpointId: endpoint.id,
    purpose: "marketing",
    channel: "sms",
    consentState: "withdrawn",
    evidenceSource: "user",
    evidenceReference: "build009-lifecycle-consent",
  });

  assert.ok(consent.id);

  const otherOrganization = await setupPool.query(
    `insert into public.organizations (name, slug)
     values ('Build 009 Other Org', 'build-009-other-org')
     returning id`,
  );
  const otherCampground = await setupPool.query(
    `insert into public.campgrounds (
       organization_id,
       name,
       slug,
       timezone
     )
     values (
       $1,
       'Build 009 Other Camp',
       'build-009-other-camp',
       'America/Toronto'
     )
     returning id`,
    [otherOrganization.rows[0].id],
  );
  const otherEndpoint = await setupPool.query(
    `insert into icamp_private.communication_endpoints (
       organization_id,
       campground_id,
       endpoint_kind,
       endpoint_value,
       display_hint
     )
     values ($1, $2, 'email', 'other@example.test', 'other email')
     returning id`,
    [otherOrganization.rows[0].id, otherCampground.rows[0].id],
  );

  await assert.rejects(
    () =>
      createCommunicationDispatch({
        actorUserId: ownerId,
        organizationId,
        campgroundId,
        endpointId: otherEndpoint.rows[0].id,
        channel: "email",
        purpose: "operational",
        idempotencyKey: "build009-cross-camp-endpoint",
      }),
    /communication_dispatches_endpoint_scope_fk/,
  );

  const dispatch = await createCommunicationDispatch({
    actorUserId: ownerId,
    organizationId,
    campgroundId,
    endpointId: endpoint.id,
    channel: "sms",
    purpose: "operational",
    idempotencyKey: "build009-operational-sms-001",
    contentReference: "template:maintenance-assignment",
    maxAttempts: 3,
  });

  const duplicate = await createCommunicationDispatch({
    actorUserId: ownerId,
    organizationId,
    campgroundId,
    endpointId: endpoint.id,
    channel: "sms",
    purpose: "operational",
    idempotencyKey: "build009-operational-sms-001",
    contentReference: "template:maintenance-assignment",
    maxAttempts: 3,
  });

  assert.equal(duplicate.id, dispatch.id);

  const retrying = await recordCommunicationAttempt({
    dispatchId: dispatch.id,
    providerKey: "mock",
    attemptState: "failed",
    retryable: true,
    errorCode: "temporary_unavailable",
    errorSummary: "Synthetic retryable provider failure.",
  });

  assert.equal(retrying.deliveryState, "queued");
  assert.equal(retrying.attemptCount, 1);
  assert.ok(retrying.nextAttemptAt);

  const mock = createMockCommunicationsProvider();
  const providerResult = await mock.dispatch({
    dispatchId: dispatch.id,
    channel: dispatch.channel,
    purpose: dispatch.purpose,
    endpointHint: endpoint.displayHint,
    idempotencyKey: dispatch.idempotencyKey,
  });

  assert.equal(providerResult.state, "accepted");

  const delivered = await recordCommunicationAttempt({
    dispatchId: dispatch.id,
    providerKey: providerResult.providerKey,
    attemptState: "delivered",
    providerReference: providerResult.providerReference,
  });

  assert.equal(delivered.deliveryState, "delivered");
  assert.equal(delivered.attemptCount, 2);

  const event = await recordCommunicationProviderEvent({
    providerKey: "mock",
    providerEventId: "build009-event-001",
    dispatchId: dispatch.id,
    channel: "sms",
    eventType: "delivery",
    eventStatus: "delivered",
    occurredAt: new Date(),
    metadata: { normalized: true },
  });
  assert.equal(event.inserted, true);

  const duplicateEvent = await recordCommunicationProviderEvent({
    providerKey: "mock",
    providerEventId: "build009-event-001",
    dispatchId: dispatch.id,
    channel: "sms",
    eventType: "delivery",
    eventStatus: "delivered",
    occurredAt: new Date(),
    metadata: { normalized: true },
  });
  assert.equal(duplicateEvent.inserted, false);

  await assert.rejects(
    () =>
      setupPool.query(
        `update icamp_private.communication_consents
         set evidence_reference = 'mutation must fail'
         where id = $1`,
        [consent.id],
      ),
    /append-only/,
  );

  const health = await getCommunicationsHealth();
  assert.equal(health.delivery.delivered >= 1, true);
  assert.equal(health.retries.retryableFailures >= 1, true);

  process.stdout.write(
    "Build 009 omnichannel communications lifecycle verification passed.\n",
  );
} finally {
  await closeCommunicationsPoolForTests();
  await setupPool.end();
}
