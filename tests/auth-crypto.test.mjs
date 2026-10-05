import assert from "node:assert/strict";
import test from "node:test";

import {
  generateOpaqueToken,
  hashOpaqueToken,
  hashPassword,
  normalizeEmail,
  validateEmail,
  validatePassword,
  verifyPassword,
} from "../lib/auth/crypto.mjs";

test("email normalization is stable and validation rejects malformed input", () => {
  assert.equal(normalizeEmail("  USER@Example.COM  "), "user@example.com");
  assert.equal(validateEmail("user@example.com"), true);
  assert.equal(validateEmail("not-an-email"), false);
  assert.equal(validateEmail("@example.com"), false);
});

test("password policy requires a long password without arbitrary composition rules", () => {
  assert.equal(validatePassword("short").ok, false);
  assert.equal(validatePassword("long enough password phrase").ok, true);
});

test("password hashing uses unique salts and constant-time verification", async () => {
  const password = "Very-Long-Test-Password-1";
  const first = await hashPassword(password);
  const second = await hashPassword(password);

  assert.notEqual(first, second);
  assert.equal(await verifyPassword(password, first), true);
  assert.equal(await verifyPassword("wrong-password-value", first), false);
  assert.equal(await verifyPassword(password, "invalid-format"), false);
});

test("opaque tokens are high entropy and only their hashes need persistence", () => {
  const first = generateOpaqueToken();
  const second = generateOpaqueToken();

  assert.notEqual(first, second);
  assert.ok(first.length >= 40);
  assert.equal(hashOpaqueToken(first).length, 32);
  assert.notDeepEqual(hashOpaqueToken(first), hashOpaqueToken(second));
});
