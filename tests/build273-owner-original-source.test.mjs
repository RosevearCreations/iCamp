import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHmac } from "node:crypto";
import {
  verifyOneTimeCredential273,
  ownerSetupReadiness273,
  signedConsumerScope273,
  consumerAckDecision273,
  restoreProviderDecision273,
} from "../lib/build273/core.mjs";
import {
  verifySignedBody273,
  parseOriginalConsumer273,
  parseOriginalRestore273,
} from "../lib/build273/protocol.mjs";
const id = "11111111-1111-4111-8111-111111111111";
const now = Date.parse("2026-11-22T12:00:00Z");
test("Rosevear first-password credential is one-time, expiring, production-only", () => {
  const fakeCredential = Array.from({ length: 50 }, (_, i) =>
    String.fromCharCode(97 + (i % 26)),
  ).join("");
  const args = {
    supplied: fakeCredential,
    configured: fakeCredential,
    expiresAt: "2026-11-24T12:00:00Z",
    now,
    environment: "production",
  };
  assert.equal(verifyOneTimeCredential273(args), true);
  assert.equal(
    verifyOneTimeCredential273({ ...args, environment: "preview" }),
    false,
  );
  assert.equal(
    verifyOneTimeCredential273({
      ...args,
      now: Date.parse("2026-11-25T12:00:00Z"),
    }),
    false,
  );
  assert.equal(
    verifyOneTimeCredential273({ ...args, supplied: "x" + fakeCredential }),
    false,
  );
  assert.equal(
    verifyOneTimeCredential273({ ...args, configured: "weak" }),
    false,
  );
});
test("Owner first password or one-time existing recovery cannot replay or grant Sysop", () => {
  const eligible = {
    originalAccount: true,
    accountType: "staff",
    archived: false,
    existingCredential: false,
    issuedAt: "2026-11-22T21:30:00Z",
    mfaRequired: true,
  };
  assert.match(ownerSetupReadiness273(eligible), /^ELIGIBLE/);
  assert.equal(
    ownerSetupReadiness273({
      ...eligible,
      existingCredential: true,
      existingCredentialChangedAt: "2026-11-21T18:00:00Z",
    }),
    "ELIGIBLE_SUPERVISED_ONE_TIME_EXISTING_PASSWORD_RECOVERY",
  );
  assert.equal(
    ownerSetupReadiness273({
      ...eligible,
      existingCredential: true,
      existingCredentialChangedAt: "2026-11-22T21:31:00Z",
    }),
    "OWNER_CREDENTIAL_ALREADY_CLAIMED",
  );
  assert.match(
    ownerSetupReadiness273({ ...eligible, issuedAt: "unconfigured" }),
    /^HOLD/,
  );
  assert.match(
    ownerSetupReadiness273({ ...eligible, accountType: "guest" }),
    /^HOLD/,
  );
  const source = readFileSync("lib/build273/owner-postgres.mjs", "utf8");
  assert.ok(source.includes("on conflict do nothing"));
  assert.ok(source.includes("account_state='active'"));
  assert.ok(!source.includes("update icamp_private.platform_operator_grants"));
  assert.ok(
    !source.includes("update icamp_private.platform_master_owner_bindings"),
  );
});
test("Consumer and restore HMAC is signed, fresh, bounded and tenant scoped", () => {
  const fakeHmacKey = Array.from({ length: 44 }, (_, i) =>
    String.fromCharCode(65 + (i % 26)),
  ).join("");
  const p = {
    campgroundId: id,
    sourcePairId: id,
    kind: "booking",
    subjectId: id,
    sourceId: "camp_rosevear_test",
    providerEventId: "provider-receipt-id-01234567890",
    nonce: "nonce_1234567890123456",
    evidenceSha256: "a".repeat(64),
    observedAt: "2026-11-22T11:59:30Z",
  };
  const body = JSON.stringify(p),
    sig = createHmac("sha256", fakeHmacKey).update(body).digest("hex");
  assert.equal(verifySignedBody273(body, sig, fakeHmacKey), true);
  assert.equal(verifySignedBody273(body + " ", sig, fakeHmacKey), false);
  assert.equal(parseOriginalConsumer273(body, now).kind, "booking");
  assert.throws(() =>
    parseOriginalConsumer273(
      JSON.stringify({ ...p, guestEmail: "person@test.invalid" }),
      now,
    ),
  );
  assert.throws(() => parseOriginalConsumer273(body, now + 300000));
  const restore = {
    restoreReviewId: id,
    providerId: "restore_host_a",
    providerEventId: "external-host-review-123456789",
    nonce: "nonce_2345678901234567",
    attestationSha256: "b".repeat(64),
    sourceHostSha256: "c".repeat(64),
    isolatedHostSha256: "d".repeat(64),
    observedAt: "2026-11-22T11:59:30Z",
  };
  assert.equal(
    parseOriginalRestore273(JSON.stringify(restore), now).providerId,
    "restore_host_a",
  );
  assert.throws(() =>
    parseOriginalRestore273(
      JSON.stringify({
        ...restore,
        isolatedHostSha256: restore.sourceHostSha256,
      }),
      now,
    ),
  );
});
test("Original consumer ACK is not a delivered message or automatic closure", () => {
  const e = {
    sourcePaired: true,
    hmacVerified: true,
    originalReference: true,
    tenantMatched: true,
    providerDelivered: true,
    recipientAcknowledged: true,
  };
  assert.match(consumerAckDecision273(e), /^ACK_EVIDENCE/);
  assert.match(
    consumerAckDecision273({ ...e, recipientAcknowledged: false }),
    /^HOLD/,
  );
  assert.match(consumerAckDecision273({ ...e, tenantMatched: false }), /^HOLD/);
  assert.match(
    signedConsumerScope273({
      campgroundId: id,
      kind: "comms",
      nonce: "nonce_1234567890123456",
      evidenceSha256: "a".repeat(64),
    }),
    /^SOURCE_SHAPE/,
  );
});
test("Original isolated restore source is separate from signed provider attribution", () => {
  const e = {
    originalBackup: true,
    isolatedRestore: true,
    providerSigned: true,
    providerHostMatched: true,
    allFourScopesMatch: true,
    independentReviewer: true,
  };
  assert.match(restoreProviderDecision273(e), /^ATTESTED/);
  assert.match(
    restoreProviderDecision273({ ...e, providerHostMatched: false }),
    /^HOLD/,
  );
});
test("Build 273 schema forces private immutable receipts and real original closure state", () => {
  const s = readFileSync(
    "database/migrations/0248_build273_consumer_source_custody.sql",
    "utf8",
  );
  for (const x of [
    "source_enrollment_review273",
    "consumer_ack273",
    "incident_ack_closure273",
    "restore_provider_attestation273",
    "force row level security",
    "c.status='resolved'",
    "p.received_at>statement_timestamp()-interval '24 hours'",
    "source_host_sha256<>isolated_host_sha256",
  ])
    assert.ok(s.includes(x), x);
});
