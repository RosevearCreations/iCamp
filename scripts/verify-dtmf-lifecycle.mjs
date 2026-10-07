import assert from "node:assert/strict";

import pg from "pg";

import { closeAuthorizationPoolForTests } from "../lib/authz/postgres.mjs";
import { closeCommunicationsPoolForTests } from "../lib/communications/postgres.mjs";
import {
  closeVoicePoolForTests,
  getVoiceGatewayHealth,
  ingestVoiceProviderEvent,
  registerVoiceLine,
} from "../lib/voice/postgres.mjs";
import { createMockVoiceProvider } from "../lib/voice/provider.mjs";

const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for Build 011 verification.");
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

function dtmfEvent({
  id,
  callReference,
  numberReference,
  inputKind,
  digits = null,
  eventType = "dtmf.input",
}) {
  const numeric = digits === null ? "" : digits.replace(/#$/u, "");

  return {
    providerKey: "mock",
    providerEventId: id,
    providerCallReference: callReference,
    providerNumberReference: numberReference,
    eventType,
    eventStatus: eventType,
    direction: "inbound",
    occurredAt: new Date().toISOString(),
    sandbox: true,
    dtmf: {
      inputKind,
      digits,
      digitCount: (numeric.match(/[0-9]/gu) ?? []).length,
      sensitive: ["pin", "verification"].includes(inputKind),
    },
  };
}

try {
  const organization = await setupPool.query(
    `insert into public.organizations (name, slug)
     values ('Build 011 Lifecycle Org', 'build-011-lifecycle-org')
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
       'Build 011 Lifecycle Camp',
       'build-011-lifecycle-camp',
       'America/Toronto'
     )
     returning id`,
    [organizationId],
  );
  const campgroundId = campground.rows[0].id;

  const ownerId = await createStaff("build011-owner@example.test");
  await assignOwner(ownerId, organizationId, campgroundId);

  const lineEndpointId = await createPhoneEndpoint({
    organizationId,
    campgroundId,
    value: "+15555551111",
    hint: "campground line ending 1111",
  });
  const staffEndpointId = await createPhoneEndpoint({
    organizationId,
    campgroundId,
    value: "+15555551112",
    hint: "staff line ending 1112",
  });

  const line = await registerVoiceLine({
    actorUserId: ownerId,
    organizationId,
    campgroundId,
    endpointId: lineEndpointId,
    providerKey: "mock",
    providerNumberReference: "mock-number-1111",
    staffTransferEndpointId: staffEndpointId,
    sandboxMode: true,
  });

  assert.equal(line.sandboxMode, true);

  const provider = createMockVoiceProvider();
  const callReference = "mock-build011-call-1";
  const numberReference = "mock-number-1111";

  const inbound = await ingestVoiceProviderEvent({
    providerKey: "mock",
    providerEventId: "build011-call-start",
    providerCallReference: callReference,
    providerNumberReference: numberReference,
    eventType: "call.initiated",
    eventStatus: "ringing",
    direction: "inbound",
    occurredAt: new Date().toISOString(),
    sandbox: true,
  });

  assert.ok(inbound.sessionId);

  const siteMenu = await ingestVoiceProviderEvent(
    dtmfEvent({
      id: "build011-menu-site",
      callReference,
      numberReference,
      inputKind: "menu",
      digits: "1",
    }),
    provider,
  );
  assert.equal(siteMenu.dtmf.action, "prompt.site");

  const siteEntry = await ingestVoiceProviderEvent(
    dtmfEvent({
      id: "build011-site-entry",
      callReference,
      numberReference,
      inputKind: "site",
      digits: "042#",
    }),
    provider,
  );
  assert.deepEqual(siteEntry.dtmf.transientEntry, {
    kind: "site",
    value: "042",
  });

  const siteDuplicate = await ingestVoiceProviderEvent(
    dtmfEvent({
      id: "build011-site-entry",
      callReference,
      numberReference,
      inputKind: "site",
      digits: "042#",
    }),
    provider,
  );
  assert.equal(siteDuplicate.duplicate, true);
  assert.equal(siteDuplicate.dtmf.transientEntry, null);

  const reservationMenu = await ingestVoiceProviderEvent(
    dtmfEvent({
      id: "build011-menu-reservation",
      callReference,
      numberReference,
      inputKind: "menu",
      digits: "2",
    }),
    provider,
  );
  assert.equal(reservationMenu.dtmf.action, "prompt.reservation");

  const reservationEntry = await ingestVoiceProviderEvent(
    dtmfEvent({
      id: "build011-reservation-entry",
      callReference,
      numberReference,
      inputKind: "reservation",
      digits: "7654321#",
    }),
    provider,
  );
  assert.equal(reservationEntry.dtmf.transientEntry?.value, "7654321");

  const passMenu = await ingestVoiceProviderEvent(
    dtmfEvent({
      id: "build011-menu-pass",
      callReference,
      numberReference,
      inputKind: "menu",
      digits: "3",
    }),
    provider,
  );
  assert.equal(passMenu.dtmf.action, "prompt.pass");

  const passEntry = await ingestVoiceProviderEvent(
    dtmfEvent({
      id: "build011-pass-entry",
      callReference,
      numberReference,
      inputKind: "pass",
      digits: "90017#",
    }),
    provider,
  );
  assert.equal(passEntry.dtmf.transientEntry?.value, "90017");

  await ingestVoiceProviderEvent(
    dtmfEvent({
      id: "build011-menu-site-back-test",
      callReference,
      numberReference,
      inputKind: "menu",
      digits: "1",
    }),
    provider,
  );

  const back = await ingestVoiceProviderEvent(
    dtmfEvent({
      id: "build011-back",
      callReference,
      numberReference,
      inputKind: "site",
      digits: "*",
    }),
    provider,
  );
  assert.equal(back.dtmf.eventType, "dtmf.back");
  assert.equal(back.dtmf.action, "prompt.main");

  const repeat = await ingestVoiceProviderEvent(
    dtmfEvent({
      id: "build011-repeat",
      callReference,
      numberReference,
      inputKind: "menu",
      digits: "8",
    }),
    provider,
  );
  assert.equal(repeat.dtmf.eventType, "dtmf.repeat");

  const main = await ingestVoiceProviderEvent(
    dtmfEvent({
      id: "build011-main",
      callReference,
      numberReference,
      inputKind: "menu",
      digits: "0",
    }),
    provider,
  );
  assert.equal(main.dtmf.eventType, "dtmf.main");

  const sensitive = await ingestVoiceProviderEvent(
    dtmfEvent({
      id: "build011-sensitive-pin",
      callReference,
      numberReference,
      inputKind: "pin",
      digits: "2468#",
    }),
    provider,
  );
  assert.equal(sensitive.dtmf.sensitive, true);
  assert.equal(sensitive.dtmf.transientEntry, null);
  assert.equal(sensitive.dtmf.eventType, "dtmf.invalid");

  const timeoutOne = await ingestVoiceProviderEvent(
    dtmfEvent({
      id: "build011-timeout-1",
      callReference,
      numberReference,
      inputKind: "menu",
      eventType: "dtmf.timeout",
    }),
    provider,
  );
  assert.equal(timeoutOne.dtmf.eventType, "dtmf.timeout");
  assert.equal(timeoutOne.transfer, null);

  const timeoutTwo = await ingestVoiceProviderEvent(
    dtmfEvent({
      id: "build011-timeout-2",
      callReference,
      numberReference,
      inputKind: "menu",
      eventType: "dtmf.timeout",
    }),
    provider,
  );
  assert.equal(timeoutTwo.dtmf.action, "transfer.staff");
  assert.equal(timeoutTwo.transfer.transferred, true);

  const providerEvidence = await setupPool.query(
    `select
       provider_event_id,
       event_status,
       metadata::text as metadata_text
     from icamp_private.communication_provider_events
     where provider_event_id like 'build011-%'
     order by provider_event_id`,
  );

  assert.ok(providerEvidence.rowCount >= 10);

  const providerText = JSON.stringify(providerEvidence.rows);
  for (const raw of ["042", "7654321", "90017", "2468"]) {
    assert.doesNotMatch(providerText, new RegExp(raw, "u"));
  }
  assert.match(providerText, /"rawDigitsExcluded": true/u);
  assert.match(providerText, /"sensitive": true/u);

  const ivrEvidence = await setupPool.query(
    `select event_type, from_state, to_state, action_key
     from icamp_private.voice_ivr_events
     where session_id = $1
     order by occurred_at`,
    [inbound.sessionId],
  );

  const ivrText = JSON.stringify(ivrEvidence.rows);
  for (const raw of ["042", "7654321", "90017", "2468"]) {
    assert.doesNotMatch(ivrText, new RegExp(raw, "u"));
  }
  assert.match(ivrText, /dtmf\.site\.accepted/u);
  assert.match(ivrText, /dtmf\.reservation\.accepted/u);
  assert.match(ivrText, /dtmf\.pass\.accepted/u);
  assert.match(ivrText, /dtmf\.timeout/u);

  const health = await getVoiceGatewayHealth();
  assert.equal(health.dtmf.inputs24h >= 10, true);
  assert.equal(health.dtmf.invalid24h >= 1, true);
  assert.equal(health.dtmf.timeouts24h >= 2, true);

  process.stdout.write(
    "Build 011 numeric keypad and DTMF lifecycle verification passed.\n",
  );
} finally {
  await closeVoicePoolForTests();
  await closeCommunicationsPoolForTests();
  await closeAuthorizationPoolForTests();
  await setupPool.end();
}
