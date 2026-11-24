import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, createHash, sign } from "node:crypto";
import { SOURCES275 } from "../lib/build275/diagnostics.mjs";
import {
  validateSigner276,
  validateRegistryRow276,
  classifyOwner276,
  verifyReadback276,
  classifyRestore276,
} from "../lib/build276/core.mjs";

const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const pem = publicKey.export({ type: "spki", format: "pem" });
const fp = createHash("sha256")
  .update(publicKey.export({ type: "spki", format: "der" }))
  .digest("hex");
const candidate = {
  sourceId: "icamp",
  keyId: "icamp_original_276",
  commitSha: "a".repeat(40),
  publicKeyPem: pem,
  evidenceDigest: "b".repeat(64),
  keyFingerprint: fp,
};
const now = Date.parse("2026-11-23T20:00:00Z");
test("only an independently fingerprinted Ed25519 public signer can be nominated", () => {
  assert.equal(validateSigner276(candidate).sourceId, "icamp");
  assert.throws(() =>
    validateSigner276({ ...candidate, keyFingerprint: "c".repeat(64) }),
  );
  assert.throws(() => validateSigner276({ ...candidate, sourceId: "unknown" }));
  assert.throws(() =>
    validateSigner276({
      ...candidate,
      publicKeyPem:
        "-----BEGIN PRIVATE KEY-----secret-----END PRIVATE KEY-----",
    }),
  );
  assert.equal(
    validateRegistryRow276({
      ...{
        source_id: "icamp",
        key_id: candidate.keyId,
        commit_sha: candidate.commitSha,
        public_key_pem: pem,
        evidence_sha256: candidate.evidenceDigest,
        key_fingerprint_sha256: fp,
      },
    }).commitSha,
    candidate.commitSha,
  );
});
test("readback verifies stored bytes and pins, not receipts or counts", () => {
  const body = JSON.stringify({
    source: "icamp",
    keyId: candidate.keyId,
    commitSha: candidate.commitSha,
    challengeId: "original_challenge_276",
    nonce: "original_nonce_276",
    observedAt: new Date(now).toISOString(),
  });
  const signature = sign(null, Buffer.from(body), privateKey).toString(
    "base64url",
  );
  const row = {
    source_id: "icamp",
    key_id: candidate.keyId,
    commit_sha: candidate.commitSha,
    signed_body: body,
    signature_b64url: signature,
    body_sha256: createHash("sha256").update(body).digest("hex"),
    observed_at: new Date(now).toISOString(),
  };
  const pins = {
    icamp: {
      keyId: candidate.keyId,
      commitSha: candidate.commitSha,
      publicKeyPem: pem,
    },
  };
  assert.equal(verifyReadback276([row], pins, now).verifiedCount, 1);
  assert.equal(verifyReadback276([row], pins, now).sources.length, 7);
  assert.equal(
    verifyReadback276([row], pins, now).status,
    "HOLD_MISSING_OR_UNVERIFIED_PEERS",
  );
  assert.equal(
    verifyReadback276([{ ...row, body_sha256: "0".repeat(64) }], pins, now)
      .verifiedCount,
    0,
  );
  assert.equal(verifyReadback276([row], pins, now + 300001).verifiedCount, 0);
  assert.equal(verifyReadback276([row], {}, now).verifiedCount, 0);
  assert.equal(SOURCES275.length, 7);
});
test("password presence never confers original owner recovery", () => {
  const ready = {
    identifiedOriginalHost: true,
    accountFound: true,
    accountActive: true,
    credentialPresent: true,
    recoveryEmailVerified: true,
    platformGrantActive: true,
    independentOwnerBinding: true,
    mfaVerified: true,
  };
  assert.equal(
    classifyOwner276(ready, { originalRosevear: true, aal2: false }, 1).status,
    "HOLD_ORIGINAL_OWNER_RECOVERY",
  );
  assert.equal(
    classifyOwner276(ready, { originalRosevear: true, aal2: true }, 0).status,
    "HOLD_ORIGINAL_OWNER_RECOVERY",
  );
  assert.equal(
    classifyOwner276(ready, { originalRosevear: true, aal2: true }, 1).checks
      .length,
    7,
  );
  assert.equal(
    classifyRestore276([]).status,
    "HOLD_INDEPENDENT_RESTORE_CLOSURE",
  );
  assert.equal(
    classifyRestore276([{ reviewed_at: new Date(now).toISOString() }]).status,
    "INDEPENDENT_REVIEW_STORED_EXTERNAL_RESTORE_NOT_ASSERTED",
  );
});
