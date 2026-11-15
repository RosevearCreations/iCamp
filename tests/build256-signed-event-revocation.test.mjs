import assert from "node:assert/strict";
import {
  createHash,
  generateKeyPairSync,
  sign,
} from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import { ENVELOPE_SCHEMA, REGISTRY_SCHEMA } from "../lib/release/build255-contract-registry.mjs";
import {
  OUTBOX_SCHEMA,
  SIGNED_PACKET_SCHEMA,
  inspectExpiry,
  planRevocationHandoffs,
  signedEventMessage,
  verifyOriginalSignedEvent,
} from "../lib/release/build256-signed-events.mjs";
import { STANDARD_THEME } from "../lib/theme/standard.mjs";

const source = (path) =>
  readFileSync(new URL("../" + path, import.meta.url), "utf8");
const now = "2026-11-15T18:00:00.000Z";
const revision = "a".repeat(40);
const tenant = "11111111-2222-4333-8444-555555555555";
const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const spki = publicKey.export({ format: "der", type: "spki" });
const fingerprint = createHash("sha256").update(spki).digest("hex");
const pin = {
  appId: "icamp",
  keyId: "icamp-independent-issuer-1",
  sourceRevision: revision,
  publicKeySpkiBase64: spki.toString("base64"),
  fingerprintSha256: fingerprint,
  notBefore: "2026-11-01T00:00:00.000Z",
  notAfter: "2026-12-01T00:00:00.000Z",
  custodianAttested: true,
};
const envelope = {
  schema: ENVELOPE_SCHEMA,
  contractVersion: REGISTRY_SCHEMA,
  sourceAppId: "icamp",
  targetAppId: "ai-data-platform",
  sourceRevision: revision,
  eventType: "fulfillment_signal.v1",
  issuedAt: "2026-11-15T17:58:00.000Z",
  nonce: "independent-source-original-unique-nonce-01",
  tenantId: tenant,
  dataClassification: "non_sensitive_metadata",
};
function packetFor(overrides = {}) {
  const packet = {
    schema: SIGNED_PACKET_SCHEMA,
    envelope: { ...envelope },
    expiresAt: "2026-11-15T18:08:00.000Z",
    keyId: pin.keyId,
    ...overrides,
  };
  packet.signatureBase64 = sign(
    null,
    Buffer.from(signedEventMessage(packet)),
    privateKey,
  ).toString("base64");
  return packet;
}
const verify = (packet, overrides = {}) =>
  verifyOriginalSignedEvent({
    packet,
    pin,
    asOf: now,
    custodianEnrolled: true,
    revocations: [],
    ...overrides,
  });

test("Independent Ed25519 source receipt validates but never connects", () => {
  const actual = verify(packetFor());
  assert.equal(actual.verified, true);
  assert.equal(actual.status, "SIGNED_ORIGINAL_OBSERVED_HOLD");
  assert.equal(actual.ownerAcceptance, "HOLD");
  assert.equal(actual.receiverConnected, false);
  assert.equal(actual.tenantId, tenant);
  assert.equal(actual.sourceRevision, revision);
  assert.match(actual.receiptDigestSha256, /^[a-f0-9]{64}$/u);
});

test("Replay of exact nonce deterministically yields same digest for SQL unique", () => {
  const first = verify(packetFor());
  const again = verify(packetFor());
  assert.equal(first.nonceDigestSha256, again.nonceDigestSha256);
  assert.equal(first.receiptDigestSha256, again.receiptDigestSha256);
});

test("Missing custodian, unknown original pin and invalid Ed25519 signatures HOLD", () => {
  const packet = packetFor();
  assert.equal(
    verify(packet, { custodianEnrolled: false }).verified,
    false,
  );
  assert.equal(verify(packet, { pin: null }).verified, false);
  assert.equal(
    verify(packet, { pin: { ...pin, fingerprintSha256: "f".repeat(64) } })
      .verified,
    false,
  );
  assert.equal(
    verify({
      ...packet,
      envelope: { ...packet.envelope, targetAppId: "rosevear-comms-hub" },
    }).verified,
    false,
  );
  assert.equal(
    verify({ ...packet, signatureBase64: "invalid" }).verified,
    false,
  );
});

test("Expired, stale, future, unknown identity and extra PII HOLD", () => {
  const packet = packetFor();
  for (const changed of [
    { expiresAt: "2026-11-15T18:00:00.000Z" },
    { expiresAt: "2026-11-15T19:00:00.000Z" },
    { envelope: { ...packet.envelope, issuedAt: "2026-11-15T17:30:00.000Z" } },
    { envelope: { ...packet.envelope, issuedAt: "2026-11-15T18:02:00.000Z" } },
    { envelope: { ...packet.envelope, sourceAppId: "fake-master" } },
    { envelope: { ...packet.envelope, dataClassification: "customer_pii" } },
    { creditCard: "not-allowed" },
  ]) {
    assert.equal(verify({ ...packet, ...changed }).verified, false);
  }
});

test("Revoked, expired or reused issuer pins fail closed", () => {
  const packet = packetFor();
  assert.equal(verify(packet, { pin: { ...pin, revoked: true } }).verified, false);
  assert.equal(
    verify(packet, { pin: { ...pin, notAfter: "2026-11-15T17:59:59.000Z" } })
      .verified,
    false,
  );
  assert.equal(
    verify(packet, {
      revocations: [
        { appId: "icamp", keyId: pin.keyId, revokedAt: "2026-11-15T17:59:00.000Z" },
      ],
    }).verified,
    false,
  );
});

test("Renewal, clock skew and expired originals are independently visible", () => {
  assert.deepEqual(
    inspectExpiry({ expiresAt: "2026-11-15T18:04:00.000Z", asOf: now }),
    { status: "HOLD_RENEWAL_REQUIRED_SOON", renewalDue: true },
  );
  assert.equal(
    inspectExpiry({ expiresAt: "2026-11-15T17:59:00.000Z", asOf: now }).status,
    "HOLD_ORIGINAL_RECEIPT_EXPIRED",
  );
  assert.equal(
    inspectExpiry({ expiresAt: "2026-11-15T18:20:00.000Z", asOf: now })
      .renewalDue,
    false,
  );
});

test("Original signed revocation creates an undelivered Master-only handoff", () => {
  const packet = packetFor({
    envelope: { ...envelope, eventType: "security_exception.v1" },
    revokesReceiptDigestSha256: "b".repeat(64),
  });
  const verifiedRevocation = verify(packet);
  assert.equal(verifiedRevocation.verified, true);
  const plan = planRevocationHandoffs({
    sourceAppId: "icamp",
    verifiedRevocation,
  });
  assert.equal(plan.schema, OUTBOX_SCHEMA);
  assert.equal(plan.status, "SOURCE_VERIFIED_UNDELIVERED_HOLD");
  assert.deepEqual(plan.targets, [
    "ai-data-platform",
    "rosevear-ai-hub",
    "rosevear-comms-hub",
  ]);
  assert.equal(plan.targets.includes("devilndove"), false);
  assert.equal(plan.targets.includes("rosiedazzlers"), false);
  assert.equal(plan.receiverConnected, false);
  assert.equal(plan.ownerAcceptance, "HOLD");
  assert.deepEqual(
    planRevocationHandoffs({
      sourceAppId: "icamp",
      verifiedRevocation: { ...verifiedRevocation, verified: false },
    }).targets,
    [],
  );
});

test("Force RLS, append-only and exact-source database replay guards exist", () => {
  const sql = source(
    "database/migrations/0235_build256_signed_event_revocation_outbox.sql",
  );
  const verifySql = source(
    "database/verify/0235_build256_signed_event_revocation_outbox.sql",
  );
  assert.match(sql, /unique \(nonce_digest_sha256\)/u);
  assert.match(sql, /unique \(receipt_digest_sha256\)/u);
  assert.match(sql, /unique \(revoked_receipt_id\)/u);
  assert.match(sql, /unique \(revocation_id,target_app\)/u);
  assert.match(sql, /force row level security/iu);
  assert.match(sql, /hold_undelivered/u);
  assert.match(sql, /current_setting\('icamp.source_revision',true\)/u);
  assert.match(sql, /guard_build256_original_revocation/u);
  assert.doesNotMatch(sql, /grant (update|delete)/iu);
  assert.match(verifySql, /Build256 all three ledgers require FORCE RLS/u);
});

test("Protected server intake checks three Master originals and MFA owner actions", () => {
  const server = source("lib/release/build256-signed-events-postgres.mjs");
  const actions = source(
    "app/workspaces/management/campgrounds/signed-event-custody/actions.ts",
  );
  const page = source(
    "app/workspaces/management/campgrounds/signed-event-custody/page.tsx",
  );
  assert.match(server, /protectedThreeMasterFreshness/u);
  assert.match(server, /process\.env\.ICAMP_BUILD256_SOURCE_CUSTODIAN_ENROLLED/u);
  assert.match(server, /verifyOriginalSignedEvent/u);
  assert.match(server, /set local role icamp_app/u);
  assert.match(server, /appendAuditEvent/u);
  assert.match(actions, /assuranceLevel !== "aal2"/u);
  assert.match(page, /SLAVE APPLICATION SHELL/i);
  assert.match(page, /Master CONNECTED HOLD/u);
});

test("Build 407 Slave Shell and iCamp Meadow theme preserved", () => {
  assert.equal(STANDARD_THEME.style, "Meadow & evergreen");
  assert.match(source("components/app-shell.tsx"), /SLAVE APPLICATION SHELL/u);
  assert.match(source("components/sysop-shell.tsx"), /SLAVE APPLICATION SHELL/u);
  assert.match(source("app/settings/themes/page.tsx"), /Orbit/u);
});
