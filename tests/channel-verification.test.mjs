import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateVerificationAvailability,
  generateVerificationCode,
  hashStaffPin,
  hashSubjectReference,
  hashVerificationCode,
  mergeFraudSignals,
  requiredVerificationFactors,
  sanitizeVerificationChallenge,
  verifyStaffPin,
  verifySubjectReference,
  verifyVerificationCode,
} from "../lib/verification/core.mjs";

test("Build 013 generates six-digit one-time codes without exposing secrets", () => {
  for (let index = 0; index < 25; index += 1) {
    assert.match(generateVerificationCode(), /^[0-9]{6}$/u);
  }
});

test("Build 013 salts guest reference and one-time-code verifiers", async () => {
  const reference = "7654321";
  const code = "902114";
  const referenceHash = await hashSubjectReference("reservation", reference);
  const codeHash = await hashVerificationCode(code);

  assert.doesNotMatch(referenceHash, new RegExp(reference, "u"));
  assert.doesNotMatch(codeHash, new RegExp(code, "u"));
  assert.equal(
    await verifySubjectReference("reservation", reference, referenceHash),
    true,
  );
  assert.equal(
    await verifySubjectReference("reservation", "7654322", referenceHash),
    false,
  );
  assert.equal(await verifyVerificationCode(code, codeHash), true);
  assert.equal(await verifyVerificationCode("902115", codeHash), false);
});

test("Build 013 stores staff PINs only as salted verifiers", async () => {
  const pin = "2468";
  const encoded = await hashStaffPin(pin);

  assert.doesNotMatch(encoded, /2468/u);
  assert.equal(await verifyStaffPin(pin, encoded), true);
  assert.equal(await verifyStaffPin("2469", encoded), false);
});

test("Build 013 applies risk-based guest and staff factors", () => {
  assert.deepEqual(
    requiredVerificationFactors({
      actorKind: "guest",
      purpose: "guest_lookup",
    }),
    ["subject_reference", "one_time_code"],
  );
  assert.deepEqual(
    requiredVerificationFactors({
      actorKind: "staff",
      purpose: "staff_access",
    }),
    ["staff_pin"],
  );
  assert.deepEqual(
    requiredVerificationFactors({
      actorKind: "staff",
      purpose: "staff_privileged",
      riskLevel: "high",
    }),
    [
      "staff_pin",
      "one_time_code_or_recent_session_reauthentication",
    ],
  );
});

test("Build 013 challenge availability fails closed on expiry and lockout", () => {
  const now = new Date("2026-10-07T16:00:00.000Z");

  assert.deepEqual(
    evaluateVerificationAvailability({
      status: "pending",
      expiresAt: "2026-10-07T16:05:00.000Z",
      now,
    }),
    { usable: true, reason: null },
  );
  assert.deepEqual(
    evaluateVerificationAvailability({
      status: "pending",
      expiresAt: "2026-10-07T15:59:59.000Z",
      now,
    }),
    { usable: false, reason: "expired" },
  );
  assert.deepEqual(
    evaluateVerificationAvailability({
      status: "pending",
      expiresAt: "2026-10-07T16:05:00.000Z",
      lockedUntil: "2026-10-07T16:10:00.000Z",
      now,
    }),
    { usable: false, reason: "locked" },
  );
});

test("Build 013 sanitized evidence never treats caller or sender as identity", () => {
  const challenge = sanitizeVerificationChallenge({
    id: "challenge-1",
    organization_id: "org-1",
    campground_id: "camp-1",
    channel: "sms",
    actor_kind: "guest",
    purpose: "guest_lookup",
    subject_kind: "reservation",
    status: "pending",
    attempt_count: 0,
    max_attempts: 5,
    expires_at: "2026-10-07T16:05:00.000Z",
    fraud_signals: [],
    code_hash: "secret-hash",
    subject_reference_hash: "secret-reference-hash",
  });

  assert.equal(challenge.secretsExcluded, true);
  assert.equal(challenge.callerOrSenderHintIsAuthentication, false);
  assert.equal(Object.hasOwn(challenge, "code_hash"), false);
  assert.equal(Object.hasOwn(challenge, "subject_reference_hash"), false);
});

test("Build 013 fraud signals stay categorical, unique and bounded", () => {
  let signals = [];
  for (let index = 0; index < 30; index += 1) {
    signals = mergeFraudSignals(signals, "signal_" + index);
  }
  signals = mergeFraudSignals(signals, "signal_29");

  assert.equal(signals.length, 20);
  assert.equal(new Set(signals).size, 20);
  assert.equal(signals.at(-1), "signal_29");
});
