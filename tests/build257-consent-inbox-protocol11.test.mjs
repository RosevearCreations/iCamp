import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  CONTACT_SCHEMA,
  PROTOCOL,
  authorizeContactAction,
  contactEventDigest,
  evaluateFollowup,
  negotiateContactProtocol,
  planMasterHandoff,
  validateContactIntake,
} from "../lib/release/build257-contact-inbox-core.mjs";

const read = (path) =>
  readFileSync(new URL("../" + path, import.meta.url), "utf8");
const tenant1 = "11111111-2222-4333-8444-555555555555";
const tenant2 = "22222222-3333-4444-8555-666666666666";
const event = {
  campgroundId: tenant1,
  providerKey: "private_sms",
  providerEventId: "provider-source-event-original-123",
};

test("protocol 1.1 independent additive release retains legacy 1.0 health", () => {
  assert.equal(PROTOCOL.minor, 1);
  assert.equal(PROTOCOL.lockstepReleaseRequired, false);
  const legacy = negotiateContactProtocol({
    peer: "1.0",
    capability: "source.health.read",
  });
  assert.equal(legacy.negotiatedProtocol, "1.0");
  assert.equal(legacy.peerDeployRequired, false);
  assert.equal(legacy.remoteExecutionAuthorized, false);
  const modern = negotiateContactProtocol({
    peer: "1.1",
    capability: "campground.contact.handoff.read",
  });
  assert.equal(modern.negotiatedProtocol, "1.1");
  assert.equal(modern.receiverConnected, false);
  assert.equal(
    negotiateContactProtocol({
      peer: "1.0",
      capability: "campground.contact.handoff.read",
    }).status,
    "HOLD",
  );
});

test("only the dependent peer feature is held; local inbox continues", () => {
  for (const input of [
    { peerAvailable: false },
    { peer: "2.0" },
    { peer: "1.0", capability: "unknown.remote.write" },
    { peer: "1.1", changeType: "BREAKING" },
    {
      peer: {
        protocolMajor: 1,
        protocolMinor: 1,
        capabilities: ["source.health.read"],
      },
      capability: "campground.contact.handoff.read",
    },
  ]) {
    const result = negotiateContactProtocol(input);
    assert.equal(result.status, "HOLD");
    assert.equal(result.localOperationsContinue, true);
    assert.equal(result.peerDeployRequired, false);
    assert.equal(result.remoteExecutionAuthorized, false);
  }
});

test("known original ingress channels are local review only", () => {
  for (const channel of ["sms", "mms", "voice", "dtmf", "speech"]) {
    const result = validateContactIntake({
      channel,
      contactKind: "staff_transfer",
      purpose: "operational",
    });
    assert.equal(result.valid, true);
    assert.equal(result.externalMessageSent, false);
  }
  for (const params of [
    { channel: "email", contactKind: "staff_transfer" },
    { channel: "sms", contactKind: "unknown" },
    { channel: "sms", contactKind: "staff_transfer", purpose: "marketing" },
    { channel: "sms", contactKind: "staff_transfer", messageText: "STOP" },
    { channel: "sms", contactKind: "staff_transfer", messageText: "START" },
    { channel: "sms", contactKind: "staff_transfer", messageText: "Hello" },
  ]) {
    assert.equal(validateContactIntake(params).status, "HOLD");
  }
});

test("current STOP suppression blocks even operational text followup", () => {
  const suppressed = evaluateFollowup({
    channel: "sms",
    purpose: "operational",
    providerSuppressed: true,
    preferenceState: "enabled",
  });
  assert.equal(suppressed.status, "HOLD");
  assert.match(suppressed.reason, /PROVIDER_SUPPRESSED/u);
  const notOptedIn = evaluateFollowup({
    channel: "sms",
    purpose: "marketing",
    providerSuppressed: false,
    preferenceState: "enabled",
    consentState: "withdrawn",
  });
  assert.equal(notOptedIn.status, "HOLD");
  const eligible = evaluateFollowup({
    channel: "sms",
    purpose: "marketing",
    providerSuppressed: false,
    preferenceState: "enabled",
    consentState: "granted",
  });
  assert.equal(eligible.status, "CONSENT_ELIGIBLE_NOT_DISPATCHED");
  assert.equal(eligible.providerDispatchAuthorized, false);
  assert.equal(
    evaluateFollowup({ channel: "voice", purpose: "operational" }).status,
    "HOLD",
  );
});

test("role-isolated staff task actions never authorize a cross-app send", () => {
  assert.equal(
    authorizeContactAction({
      action: "acknowledge",
      permissions: ["communications.read"],
      roleCodes: [],
    }).allowed,
    true,
  );
  assert.equal(
    authorizeContactAction({
      action: "escalate",
      permissions: ["communications.read"],
      roleCodes: [],
    }).allowed,
    false,
  );
  assert.equal(
    authorizeContactAction({
      action: "resolve",
      permissions: ["communications.read", "communications.manage"],
      roleCodes: [],
    }).allowed,
    false,
  );
  assert.equal(
    authorizeContactAction({
      action: "resolve",
      permissions: ["communications.read", "communications.manage"],
      roleCodes: ["owner_admin"],
    }).allowed,
    true,
  );
  assert.equal(
    authorizeContactAction({
      action: "delete",
      permissions: ["communications.manage", "communications.read"],
      roleCodes: ["owner_admin"],
    }).allowed,
    false,
  );
});

test("source idempotency hashes separate tenants and preserve event identity", () => {
  const first = contactEventDigest(event);
  assert.equal(first, contactEventDigest(event));
  assert.notEqual(
    first,
    contactEventDigest({ ...event, campgroundId: tenant2 }),
  );
  assert.notEqual(
    first,
    contactEventDigest({ ...event, providerEventId: "different-original" }),
  );
  assert.match(first, /^[0-9a-f]{64}$/u);
  assert.throws(() => contactEventDigest({ ...event, providerKey: "???" }));
});

test("Master handoff is metadata-only with no receipt or authority", () => {
  const plan = planMasterHandoff({
    peerProtocol: "1.1",
    peerAvailable: true,
    contactKind: "booking_question",
  });
  assert.equal(plan.schema, CONTACT_SCHEMA);
  assert.deepEqual(plan.targets, ["rosevear-comms-hub"]);
  assert.equal(plan.state, undefined);
  assert.equal(plan.remoteExecutionAuthorized, false);
  assert.equal(plan.deliveryAcknowledged, false);
  assert.equal(plan.containsCustomerPii, false);
  assert.equal(plan.directPeerDatabaseSync, false);
  assert.equal(
    planMasterHandoff({
      peerProtocol: "1.0",
      peerAvailable: true,
    }).status,
    "HOLD",
  );
});

test("private migration enforces scoped originals, idempotency and role RLS", () => {
  const sql = read(
    "database/migrations/0236_build257_consent_inbox_protocol11.sql",
  );
  const verification = read(
    "database/verify/0236_build257_consent_inbox_protocol11.sql",
  );
  assert.match(sql, /icamp_contact_inbox257/u);
  assert.match(sql, /communication_provider_events/u);
  assert.match(sql, /direction='inbound'/u);
  assert.match(sql, /unique \(campground_id,provider_event_id\)/u);
  assert.match(sql, /unique \(campground_id,event_digest_sha256\)/u);
  assert.match(sql, /icamp_contact_task_actions257_role_select/u);
  assert.match(sql, /icamp_contact_inbox257_role_select/u);
  assert.match(sql, /as restrictive for select/u);
  assert.match(sql, /force row level security/u);
  assert.match(sql, /hold_undelivered/u);
  assert.doesNotMatch(sql, /grant update|grant delete/iu);
  assert.match(
    verification,
    /three restrictive role-isolation policies required/u,
  );
  assert.match(verification, /Build257 no public\/anon\/authenticated RLS/u);
});

test("server and UI require current staff/MFA; never inject provider body", () => {
  const server = read("lib/release/build257-contact-inbox-postgres.mjs");
  const actions = read(
    "app/workspaces/management/campgrounds/contact-inbox/actions.ts",
  );
  const page = read(
    "app/workspaces/management/campgrounds/contact-inbox/page.tsx",
  );
  assert.match(server, /getCampgroundAuthorization/u);
  assert.match(server, /assertMessagingDispatchAllowed/u);
  assert.match(server, /on conflict \(campground_id,provider_event_id\)/u);
  assert.match(server, /set local role icamp_app/u);
  assert.match(server, /appendAuditEvent/u);
  assert.match(actions, /assuranceLevel !== "aal2"/u);
  assert.match(page, /Slave Application Shell/u);
  assert.match(page, /Protocol 1\.1/u);
  assert.match(read("components/app-shell.tsx"), /SLAVE APPLICATION SHELL/u);
  assert.match(read("components/sysop-shell.tsx"), /SLAVE APPLICATION SHELL/u);
});
