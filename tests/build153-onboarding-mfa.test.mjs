import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import {
  acceptedTotpStep,
  generateTotpSeed,
  openTotpSeed,
  sealTotpSeed,
  totpAtStep,
} from "../lib/auth/totp.mjs";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const knownSeed = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

test("TOTP RFC6238 vector, drift tolerance and one-time step replay denial", () => {
  assert.equal(totpAtStep(knownSeed, 1), "287082");
  assert.equal(acceptedTotpStep(knownSeed, "287082", -1, 59_000), 1);
  assert.equal(acceptedTotpStep(knownSeed, "287082", 1, 59_000), null);
  assert.equal(acceptedTotpStep(knownSeed, "123", -1, 59_000), null);
});

test("TOTP seeds encrypt with per-user authenticated encryption", () => {
  const seed = generateTotpSeed();
  const key = Buffer.alloc(32, 42).toString("base64url");
  const ciphertext = sealTotpSeed(seed, "test-user-a", key);
  assert.notEqual(ciphertext, seed);
  assert.equal(openTotpSeed(ciphertext, "test-user-a", key), seed);
  assert.throws(() => openTotpSeed(ciphertext, "test-user-b", key));
});

test("MFA factor and session state enforce replay, failed attempts and AAL2 freshness", () => {
  const migration = read("database/migrations/0183_profile_totp_onboarding.sql");
  const service = read("lib/auth/mfa-postgres.mjs");
  const session = read("lib/auth/postgres.mjs");
  assert.match(migration, /totp_last_accepted_step/u);
  assert.match(migration, /mfa_one_live_totp_per_user/u);
  assert.match(service, /for update/u);
  assert.match(service, /totp_locked_until/u);
  assert.match(service, /assurance_level = 'aal2'/u);
  assert.match(session, /15 \* 60 \* 1000/u);
});

test("Operator activation refuses production, preserves pending platform grant and uses no default secrets", () => {
  const operator = read("scripts/activate-camp-rosevear-test-accounts.mjs");
  assert.match(operator, /approvedRef === "cxgszmpbeswdikzofvjv"/u);
  assert.match(operator, /ICAMP_APP_ENV !== "testing"/u);
  assert.match(operator, /grant_state !== "pending"/u);
  assert.doesNotMatch(operator, /!Sample12345|!Manage12345|!Admin12345/u);
});

test("Personal profile actions derive user identity from an authenticated session", () => {
  const action = read("app/auth/profile/actions.ts");
  assert.match(action, /requireSignedIn/u);
  assert.match(action, /session.user.id/u);
  assert.doesNotMatch(action, /formData.get\("userId"\)/u);
});
