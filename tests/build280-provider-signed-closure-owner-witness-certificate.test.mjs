import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, createHash, sign } from "node:crypto";
import {
  PROVIDER_CLOSURE_KIND280,
  digest280,
  validateProviderKey280,
  validateProviderKeyReview280,
  verifyProviderClosure280,
  scopeDigest280,
  validateOwnerCompletion280,
  validateCertificate280,
  classifyCertificate280,
} from "../lib/build280/core.mjs";
const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  uuid = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const sha = "c".repeat(64),
  now = Date.parse("2026-11-24T20:00:00Z");
const keys = generateKeyPairSync("ed25519");
const publicKeyPem = keys.publicKey.export({ type: "spki", format: "pem" });
const fp = createHash("sha256")
  .update(keys.publicKey.export({ type: "spki", format: "der" }))
  .digest("hex");
const providerKey = validateProviderKey280({
  providerId: "original_backup_provider",
  keyId: "original_provider_key280",
  fingerprint: fp,
  evidenceDigest: sha,
  publicKeyPem,
});
const proof = {
  original_backup_manifest_sha256: "a".repeat(64),
  tenant_isolation_sha256: "b".repeat(64),
  reservation_integrity_sha256: "c".repeat(64),
  payment_ledger_sha256: "d".repeat(64),
  service_health_sha256: "e".repeat(64),
};
const original = {
  providerId: providerKey.providerId,
  sourceHostSha256: "1".repeat(64),
  isolatedHostSha256: "2".repeat(64),
  backupManifestSha256: proof.original_backup_manifest_sha256,
  scopeDigestSha256: scopeDigest280(proof),
};
const body = JSON.stringify({
  kind: PROVIDER_CLOSURE_KIND280,
  providerId: providerKey.providerId,
  keyId: providerKey.keyId,
  providerEventId: "actual_provider_event280",
  nonce: "actual_provider_nonce280",
  sourceHostSha256: original.sourceHostSha256,
  isolatedHostSha256: original.isolatedHostSha256,
  backupManifestSha256: original.backupManifestSha256,
  scopeDigestSha256: original.scopeDigestSha256,
  observedAt: new Date(now - 30000).toISOString(),
});
const signature = sign(null, Buffer.from(body), keys.privateKey).toString(
  "base64url",
);
test("real Ed25519 public key fingerprint is enforced", () => {
  assert.ok(providerKey.publicKeyPem.includes("BEGIN PUBLIC KEY"));
  assert.throws(() =>
    validateProviderKey280({ ...providerKey, fingerprint: sha }),
  );
  assert.throws(() =>
    validateProviderKey280({ ...providerKey, publicKeyPem: "PRIVATE KEY" }),
  );
  assert.throws(() =>
    validateProviderKeyReview280({ proposalId: "bad", evidenceDigest: sha }),
  );
});
test("cryptographic provider signature, original host and scope are bound", () => {
  assert.equal(
    verifyProviderClosure280({ body, signature, providerKey, original, now })
      .providerId,
    providerKey.providerId,
  );
  assert.equal(
    verifyProviderClosure280({ body, signature, providerKey, original, now })
      .digest,
    digest280(body),
  );
  assert.throws(() =>
    verifyProviderClosure280({
      body,
      signature: signature.slice(1) + "_",
      providerKey,
      original,
      now,
    }),
  );
  assert.throws(() =>
    verifyProviderClosure280({
      body,
      signature,
      providerKey,
      original: { ...original, isolatedHostSha256: sha },
      now,
    }),
  );
  assert.throws(() =>
    verifyProviderClosure280({
      body,
      signature,
      providerKey,
      original,
      now: now + 360000,
    }),
  );
  assert.throws(() =>
    verifyProviderClosure280({
      body,
      signature,
      providerKey: { ...providerKey, keyId: "other_provider_key" },
      original,
      now,
    }),
  );
  assert.throws(() =>
    verifyProviderClosure280({
      body: body.replace(PROVIDER_CLOSURE_KIND280, "provider-unsigned"),
      signature,
      providerKey,
      original,
      now,
    }),
  );
});
test("original backup and all four restore scopes are required", () => {
  assert.ok(scopeDigest280(proof).length === 64);
  assert.throws(() =>
    scopeDigest280({ ...proof, payment_ledger_sha256: "bad" }),
  );
  assert.throws(() =>
    validateOwnerCompletion280({ ownerAuditId: id, evidenceDigest: "bad" }),
  );
  assert.equal(
    validateCertificate280({
      providerClosureId: id,
      ownerWitnessId: uuid,
      evidenceDigest: sha,
    }).ownerWitnessId,
    uuid,
  );
});
test("certificate cannot be granted from unsigned or incomplete sources and never restores production", () => {
  const admission = { adopted: true, host: { pinned: true } };
  const ready = classifyCertificate280({
    admission,
    providerSigned: true,
    ownerWitness: true,
    sources: 7,
    certificateStored: true,
  });
  assert.equal(ready.productionRestored, false);
  assert.equal(ready.externalProviderFinalAck, false);
  assert.equal(
    classifyCertificate280({
      admission,
      providerSigned: false,
      ownerWitness: true,
      sources: 7,
      certificateStored: true,
    }).status,
    "HOLD_ORIGINAL_PROVIDER_SIGNED_RECOVERY_CERTIFICATION",
  );
  assert.equal(
    classifyCertificate280({
      admission,
      providerSigned: true,
      ownerWitness: true,
      sources: 6,
      certificateStored: true,
    }).status,
    "HOLD_ORIGINAL_PROVIDER_SIGNED_RECOVERY_CERTIFICATION",
  );
});
