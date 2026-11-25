import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign, createHash } from "node:crypto";
import {
  EXTERNAL_FINAL_ACK_KIND281,
  validateCustodyReview281,
  validateMfaContinuity281,
  validateFinalAck281,
  validateMonitorSample281,
  verifyExternalProviderAck281,
  classifyLiveMonitor281,
} from "../lib/build281/core.mjs";
const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const cert = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const continuity = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const now = Date.parse("2026-11-25T13:00:00Z");
const kp = generateKeyPairSync("ed25519");
const publicKeyPem = kp.publicKey.export({ type: "spki", format: "pem" });
const fingerprint = createHash("sha256")
  .update(kp.publicKey.export({ type: "spki", format: "der" }))
  .digest("hex");
const providerKey = {
  providerId: "original_external_backup",
  keyId: "original_provider_key281",
  fingerprint,
  evidenceDigest: "a".repeat(64),
  publicKeyPem,
};
const original = {
  providerId: providerKey.providerId,
  originalClosureId: id,
  certificateId: cert,
  originalClosureDigest: "b".repeat(64),
  sourceHostSha256: "c".repeat(64),
  isolatedHostSha256: "d".repeat(64),
};
const body = JSON.stringify({
  kind: EXTERNAL_FINAL_ACK_KIND281,
  providerId: providerKey.providerId,
  keyId: providerKey.keyId,
  providerEventId: "genuine_provider_event281",
  nonce: "separate_provider_nonce281",
  observedAt: new Date(now - 30000).toISOString(),
  originalClosureId: id,
  certificateId: cert,
  originalClosureDigest: original.originalClosureDigest,
  sourceHostSha256: original.sourceHostSha256,
  isolatedHostSha256: original.isolatedHostSha256,
});
const signature = sign(null, Buffer.from(body), kp.privateKey).toString(
  "base64url",
);
test("verifies new external Ed25519 ACK and binds original hosts and certificates", () => {
  const good = verifyExternalProviderAck281({
    body,
    signature,
    providerKey,
    original,
    now,
  });
  assert.equal(good.providerId, providerKey.providerId);
  assert.equal(good.certificateId, cert);
  assert.throws(() =>
    verifyExternalProviderAck281({
      body,
      signature: signature.slice(2) + "aa",
      providerKey,
      original,
      now,
    }),
  );
  assert.throws(() =>
    verifyExternalProviderAck281({
      body,
      signature,
      providerKey,
      original: { ...original, sourceHostSha256: "a".repeat(64) },
      now,
    }),
  );
  assert.throws(() =>
    verifyExternalProviderAck281({
      body,
      signature,
      providerKey,
      original,
      now: now + 360000,
    }),
  );
  assert.throws(() =>
    verifyExternalProviderAck281({
      body: body.replace(EXTERNAL_FINAL_ACK_KIND281, "unapproved"),
      signature,
      providerKey,
      original,
      now,
    }),
  );
  assert.throws(() =>
    verifyExternalProviderAck281({
      body,
      signature,
      providerKey: { ...providerKey, fingerprint: "0".repeat(64) },
      original,
      now,
    }),
  );
});
test("independent custody, owner continuity and monitor references are validated", () => {
  const sha = "a".repeat(64);
  assert.equal(
    validateCustodyReview281({ providerClosureId: id, evidenceDigest: sha })
      .providerClosureId,
    id,
  );
  assert.throws(() =>
    validateCustodyReview281({
      providerClosureId: "other",
      evidenceDigest: sha,
    }),
  );
  assert.equal(
    validateMfaContinuity281({
      originalWitnessId: id,
      sessionId: cert,
      evidenceDigest: sha,
    }).sessionId,
    cert,
  );
  assert.throws(() =>
    validateMfaContinuity281({
      originalWitnessId: id,
      sessionId: cert,
      evidenceDigest: "INVALID",
    }),
  );
  assert.equal(
    validateFinalAck281({
      certificateId: cert,
      custodyReviewId: id,
      ownerContinuityId: continuity,
      body,
      signature,
    }).certificateId,
    cert,
  );
  assert.throws(() =>
    validateFinalAck281({
      certificateId: cert,
      custodyReviewId: id,
      ownerContinuityId: "bad",
      body,
      signature,
    }),
  );
  assert.throws(() =>
    validateMonitorSample281({ ackId: id, evidenceDigest: "bad" }),
  );
});
test("readback is time limited and never claims production restoration", () => {
  const admission = { adopted: true, host: { pinned: true } };
  const args = {
    admission,
    providerCustody: true,
    ownerContinuity: true,
    providerAck: true,
    sourceCount: 7,
    certificatePresent: true,
    sampledAt: new Date(now - 20000).toISOString(),
    now,
  };
  const ok = classifyLiveMonitor281(args);
  assert.equal(ok.externalProviderFinalAcknowledgmentVerified, true);
  assert.equal(ok.productionRestored, false);
  assert.equal(
    classifyLiveMonitor281({ ...args, providerAck: false })
      .independentReviewLive,
    false,
  );
  assert.equal(
    classifyLiveMonitor281({ ...args, sourceCount: 6 }).independentReviewLive,
    false,
  );
  assert.equal(
    classifyLiveMonitor281({
      ...args,
      sampledAt: new Date(now - 500000).toISOString(),
    }).independentReviewLive,
    false,
  );
  assert.equal(
    classifyLiveMonitor281({ ...args, ownerContinuity: false })
      .independentReviewLive,
    false,
  );
});
