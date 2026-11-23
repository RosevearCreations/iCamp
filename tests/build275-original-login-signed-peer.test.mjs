import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { SOURCES275, pins275, classify275, verifySigned275 } from "../lib/build275/diagnostics.mjs";

const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const pin = {
  keyId: "original_source_275",
  commitSha: "a".repeat(40),
  publicKeyPem: publicKey.export({ type: "spki", format: "pem" }),
};
const now = Date.parse("2026-11-23T18:00:00Z");
function sample(changes = {}) {
  const body = JSON.stringify({
    source: "icamp", keyId: pin.keyId, commitSha: pin.commitSha,
    challengeId: "challenge_original_275",
    nonce: "nonce_original_275",
    observedAt: new Date(now).toISOString(), ...changes,
  });
  return {body, signature: sign(null, Buffer.from(body), privateKey)
    .toString("base64url"), pins: {icamp: pin}, now};
}
test("accept only genuine pinned source signature and fresh original revision", () => {
  assert.equal(verifySigned275(sample()).source, "icamp");
  assert.throws(() => verifySigned275({...sample(), pins: {}}));
  assert.throws(() => verifySigned275({...sample(), signature: "A".repeat(86)}));
  assert.throws(() => verifySigned275(sample({commitSha: "b".repeat(40)})));
  assert.throws(() => verifySigned275({...sample(), now: now + 121000}));
  assert.throws(() => verifySigned275(sample({source: "unknown-source"})));
});
test("untrusted source registry never counts", () => {
  assert.deepEqual(pins275("oops"), {});
  assert.deepEqual(pins275('{"icamp":{"keyId":"x"}}'), {});
  assert.equal(pins275(JSON.stringify({icamp: pin})).icamp.commitSha, pin.commitSha);
});
test("even seven signed source receipts remain pending independent review", () => {
  const base = {host: {hostPinned: false, adopted: false}, owner: null,
    session: null, ledger: {schemaReady: false, receipts: []}, now};
  assert.equal(classify275(base).signedCount, 0);
  const result = classify275({
    host: {hostPinned: true, adopted: true},
    owner: {identifiedOriginalHost: true, accountFound: true, accountActive: true,
      credentialPresent: true, mfaVerified: true, recoveryEmailVerified: true,
      platformGrantActive: true, independentOwnerBinding: true},
    session: {originalRosevear: true, aal2: true},
    ledger: {schemaReady: true, receipts: SOURCES275.map((source) => ({
      source, observedAt: new Date(now).toISOString()}))},
    configured: [...SOURCES275], now,
  });
  assert.equal(result.signedCount, 7);
  assert.equal(result.closureStatus, "PENDING_INDEPENDENT_RESTORE_REVIEW");
  assert.ok(result.checks.every((check) => check.status !== "CERTIFIED"));
});
