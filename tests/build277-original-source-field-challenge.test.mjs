import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import {
  originalHostPin277,
  validateOwnerPin277,
  verifyFieldResponse277,
  classifyFieldReadback277,
  classifyExternalRestore277,
  closure277,
  digest277,
} from "../lib/build277/core.mjs";

const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const publicKeyPem = publicKey.export({ type: "spki", format: "pem" });
const pins = {
  icamp: {
    keyId: "original_icamp_277",
    commitSha: "e".repeat(40),
    publicKeyPem,
  },
};
const now = Date.parse("2026-11-24T00:20:00.000Z");
const issued = {
  challengeId: "server_original_challenge_277",
  source: "icamp",
  keyId: pins.icamp.keyId,
  commitSha: pins.icamp.commitSha,
  requestNonce: "original_request_nonce_277",
  issuedAt: now - 30000,
  expiresAt: now + 60000,
};
const body = JSON.stringify({
  source: "icamp",
  keyId: pins.icamp.keyId,
  commitSha: pins.icamp.commitSha,
  challengeId: issued.challengeId,
  nonce: "original_response_nonce_277",
  observedAt: new Date(now).toISOString(),
});
const signature = sign(null, Buffer.from(body), privateKey).toString(
  "base64url",
);
test("host pin never equates URL availability with verified original identity", () => {
  const url = "postgresql://user:secret@db.original.invalid:5432/postgres";
  assert.equal(originalHostPin277(url, "db.original.invalid").pinned, true);
  assert.equal(originalHostPin277(url, "other.invalid").pinned, false);
  assert.equal(
    originalHostPin277(url, "").status,
    "HOLD_OWNER_DATABASE_HOST_PIN",
  );
  assert.equal(
    originalHostPin277("http://wrong.invalid", "db.original.invalid").pinned,
    false,
  );
  assert.equal(
    JSON.stringify(originalHostPin277(url, "db.original.invalid")).includes(
      "secret",
    ),
    false,
  );
});
test("original owner adoption requires actual Rosevear AAL2 context", () => {
  const input = {
    proposalId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    evidenceDigest: "b".repeat(64),
    ownerSessionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    ownerUserId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    ownerUsername: "Rosevear",
    assuranceLevel: "aal2",
  };
  assert.equal(validateOwnerPin277(input).proposalId, input.proposalId);
  assert.throws(() =>
    validateOwnerPin277({ ...input, assuranceLevel: "aal1" }),
  );
  assert.throws(() =>
    validateOwnerPin277({ ...input, ownerUsername: "other" }),
  );
});
test("server-issued challenge is bound to source, revision, nonce and short expiry", () => {
  assert.equal(
    verifyFieldResponse277({ body, signature, pins, issued, now }).source,
    "icamp",
  );
  assert.throws(() =>
    verifyFieldResponse277({
      body,
      signature,
      pins,
      issued: { ...issued, challengeId: "another_server_challenge_277" },
      now,
    }),
  );
  assert.throws(() =>
    verifyFieldResponse277({
      body,
      signature,
      pins,
      issued: { ...issued, requestNonce: "original_response_nonce_277" },
      now,
    }),
  );
  assert.throws(() =>
    verifyFieldResponse277({
      body,
      signature,
      pins,
      issued,
      now: now + 120000,
    }),
  );
  assert.throws(() =>
    verifyFieldResponse277({ body, signature, pins: {}, issued, now }),
  );
});
test("fresh signed field response does not certify seven sources or original restore", () => {
  const rows = [
    {
      source_id: "icamp",
      key_id: issued.keyId,
      commit_sha: issued.commitSha,
      challenge_id: issued.challengeId,
      request_nonce: issued.requestNonce,
      issued_at: new Date(issued.issuedAt).toISOString(),
      expires_at: new Date(issued.expiresAt).toISOString(),
      accepted_at: new Date(now).toISOString(),
      signed_body: body,
      signature_b64url: signature,
      body_sha256: digest277(body),
    },
  ];
  const v = classifyFieldReadback277(rows, pins, now);
  assert.equal(v.count, 1);
  assert.equal(v.checks.length, 7);
  assert.equal(classifyFieldReadback277(rows, pins, now + 400000).count, 0);
  assert.equal(
    classifyFieldReadback277(
      [{ ...rows[0], body_sha256: "f".repeat(64) }],
      pins,
      now,
    ).count,
    0,
  );
  assert.equal(
    classifyExternalRestore277(true, true, false).status,
    "HOLD_INDEPENDENT_EXTERNAL_RESTORE_ACCEPTANCE",
  );
  assert.equal(
    closure277({
      host: { pinned: true },
      owner: { status: "HOLD" },
      peer: { count: 7 },
      restore: classifyExternalRestore277(true, true, true),
    }).productionRestored,
    false,
  );
});
