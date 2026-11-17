import test from "node:test";
import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { readFileSync } from "node:fs";

import {
  BUILD261_MIGRATION,
  assessMigrationReadback261,
  evaluateAssurance261,
  verifyProviderEnrollment261,
} from "../lib/finance-assurance261/core.mjs";

const issuer = generateKeyPairSync("ed25519");
const reviewer = generateKeyPairSync("ed25519");
const publicPem = (key) =>
  key.export({ type: "spki", format: "pem" });
const fingerprint = (key) =>
  createHash("sha256")
    .update(key.export({ type: "spki", format: "der" }))
    .digest("hex");
const revision = "d".repeat(40);
const now = new Date("2026-11-17T15:00:00.000Z");
const base = {
  envelopeJson: "",
  provider: "external_test",
  keyId: "external-test-2026",
  providerPublicKeyPem: publicPem(issuer.publicKey),
  reviewerPublicKeyPem: publicPem(reviewer.publicKey),
  reviewerIndependentlyEnrolled: true,
  sourceRevision: revision,
  now,
};
function envelope(overrides = {}) {
  const payload = {
    schema: "icamp.provider-enrollment.v1",
    provider: base.provider,
    keyId: base.keyId,
    issuerFingerprintSha256: fingerprint(issuer.publicKey),
    reviewerFingerprintSha256: fingerprint(reviewer.publicKey),
    sourceRevision: revision,
    migrationVersion: BUILD261_MIGRATION.version,
    migrationChecksumSha256: BUILD261_MIGRATION.checksumSha256,
    independentReviewReference: "provider-legal-approval-2026",
    issuedAt: "2026-11-17T14:00:00.000Z",
    expiresAt: "2026-11-20T14:00:00.000Z",
    ...overrides,
  };
  const bytes = Buffer.from(JSON.stringify(payload));
  return JSON.stringify({
    payload,
    issuerSignatureBase64: sign(null, bytes, issuer.privateKey).toString("base64"),
    reviewerSignatureBase64: sign(null, bytes, reviewer.privateKey).toString("base64"),
  });
}
const trustedSchema = {
  forceRls: true,
  guardPresent: true,
  scopedPolicyCount: 2,
  mutableGrantPresent: false,
};
function migration(overrides = {}) {
  return assessMigrationReadback261({
    runtimeProduction: true,
    revision,
    targetPinned: true,
    ledgerExists: true,
    ledgerReadSucceeded: true,
    record: {
      version: BUILD261_MIGRATION.version,
      name: BUILD261_MIGRATION.name,
      checksum_sha256: BUILD261_MIGRATION.checksumSha256,
    },
    schema: trustedSchema,
    ...overrides,
  });
}

test("Build 261 checks exact canonical Build 260 migration bytes", () => {
  const migrationBytes = readFileSync(
    new URL(
      "../database/migrations/0238_build260_owner_financial_close.sql",
      import.meta.url,
    ),
  );
  assert.equal(
    createHash("sha256").update(migrationBytes).digest("hex"),
    BUILD261_MIGRATION.checksumSha256,
  );
});

test("Build 261 production migration must match pin, ledger checksum and RLS", () => {
  assert.equal(migration().status, "PINNED_RUNTIME_LEDGER_AND_SCHEMA_MATCH");
  for (const override of [
    { targetPinned: false },
    { runtimeProduction: false },
    { ledgerReadSucceeded: false },
    { schema: { ...trustedSchema, guardPresent: false } },
    { record: { ...BUILD261_MIGRATION, version: "0237" } },
    { record: { version: "0238", name: BUILD261_MIGRATION.name, checksum_sha256: "a".repeat(64) } },
  ]) {
    const result = migration(override);
    assert.equal(result.status, "HOLD_PRODUCTION_MIGRATION_PROVENANCE");
    assert.equal(result.verifiedOnProductionDatabase, false);
  }
});

test("Build 261 requires distinct issuer/reviewer signatures, source, expiry", () => {
  const ok = verifyProviderEnrollment261({
    ...base,
    envelopeJson: envelope(),
  });
  assert.equal(ok.status, "DUAL_SIGNED_ENROLLMENT_OBSERVED");
  for (const input of [
    { reviewerIndependentlyEnrolled: false },
    { reviewerPublicKeyPem: base.providerPublicKeyPem },
    { envelopeJson: envelope({ sourceRevision: "a".repeat(40) }) },
    { envelopeJson: envelope({ expiresAt: "2026-11-17T14:00:00.000Z" }) },
    { envelopeJson: envelope().replace("provider-legal-approval-2026", "provider-legal-approval-2025") },
  ]) {
    assert.throws(() => verifyProviderEnrollment261({
      ...base,
      envelopeJson: envelope(),
      ...input,
    }), /HOLD|distinct|signature/iu);
  }
});

test("Build 261 no signed enrollment or no migration cannot approve a close", () => {
  const enrolled = verifyProviderEnrollment261({
    ...base,
    envelopeJson: envelope(),
  });
  const ready = evaluateAssurance261({
    migration: migration(),
    enrollment: enrolled,
    configuredProvider: "external_test",
    expectedProvider: "external_test",
    revision,
  });
  assert.equal(ready.approvalEligible, true);
  assert.equal(ready.livePaymentsEnabled, false);
  const held = evaluateAssurance261({
    migration: migration({ targetPinned: false }),
    enrollment: enrolled,
    configuredProvider: "external_test",
    expectedProvider: "external_test",
    revision,
  });
  assert.equal(held.approvalEligible, false);
  assert.equal(evaluateAssurance261({
    migration: migration(),
    enrollment: null,
    configuredProvider: "mock",
    expectedProvider: "external_test",
    revision,
  }).status, "HOLD_EXTERNAL_FINANCIAL_ASSURANCE");
});
