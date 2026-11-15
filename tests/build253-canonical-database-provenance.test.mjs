import assert from "node:assert/strict";
import {
  createHash,
  generateKeyPairSync,
  sign,
} from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import {
  BUILD253_CANONICAL_MIGRATIONS,
  canonicalMigrationManifestDigest,
} from "../lib/release/build253-canonical-migrations.mjs";
import {
  databaseProvenanceReceiptMessage,
  reconcileCanonicalMigrationChecksums,
  sha256Text,
  superviseRemediationEvidence,
  verifyIndependentDatabaseProvenance,
} from "../lib/release/build253-provenance-core.mjs";
import { STANDARD_THEME } from "../lib/theme/standard.mjs";

const revision = "c".repeat(40);
const host = "runtime-postgres.example.org";
const when = "2026-11-14T19:00:00.000Z";
const source = (path) =>
  readFileSync(new URL("../" + path, import.meta.url), "utf8");
const ledger = BUILD253_CANONICAL_MIGRATIONS.map((item) => ({
  version: item.version,
  name: item.name,
  checksum_sha256: item.sha256,
}));
const complete = {
  sourceRevision: revision,
  hostnameMatchesConfiguredPin: true,
  querySucceeded: true,
  ledgerExists: true,
  records: ledger,
};

test("Canonical SHA-256 comes from byte-exact reviewed migration SQL", () => {
  for (const migration of BUILD253_CANONICAL_MIGRATIONS) {
    const bytes = readFileSync(
      new URL("../" + migration.path, import.meta.url),
    );
    assert.equal(
      createHash("sha256").update(bytes).digest("hex"),
      migration.sha256,
    );
    assert.equal(bytes.includes(Buffer.from("create")), true);
    assert.match(migration.gitBlobSha1, /^[a-f0-9]{40}$/u);
  }
  assert.match(canonicalMigrationManifestDigest(), /^[a-f0-9]{64}$/u);
});

test("Live ledger compares exact source hashes without implying approval", () => {
  const result = reconcileCanonicalMigrationChecksums(complete);
  assert.equal(result.status, "SOURCE_CHECKSUMS_MATCH_RECORDED_LEDGER");
  assert.equal(result.sourceChecksumsMatch, true);
  assert.equal(result.independentDatabaseProvenance, false);
  assert.equal(result.realSchemaMigrationAdoptionApproved, false);
  assert.equal(result.masterConnected, false);
  assert.equal(result.ownerProductionAcceptance, "HOLD");
  assert.equal(result.rows.every((row) => row.checksumMatches), true);
  assert.equal(
    JSON.stringify(result).includes(BUILD253_CANONICAL_MIGRATIONS[0].sha256),
    false,
  );
});

test("Missing host pin, rows, or altered SQL digest fail closed", () => {
  assert.equal(
    reconcileCanonicalMigrationChecksums({
      ...complete,
      hostnameMatchesConfiguredPin: false,
    }).sourceChecksumsMatch,
    false,
  );
  assert.equal(
    reconcileCanonicalMigrationChecksums({
      ...complete,
      ledgerExists: false,
    }).status,
    "HOLD_MIGRATION_LEDGER_TABLE_MISSING",
  );
  assert.equal(
    reconcileCanonicalMigrationChecksums({
      ...complete,
      querySucceeded: false,
    }).status,
    "HOLD_MIGRATION_LEDGER_QUERY_FAILED",
  );
  assert.equal(
    reconcileCanonicalMigrationChecksums({
      ...complete,
      records: ledger.slice(0, 2),
    }).status,
    "HOLD_MIGRATION_LEDGER_MISSING_OR_WRONG_NAME",
  );
  assert.equal(
    reconcileCanonicalMigrationChecksums({
      ...complete,
      records: [
        { ...ledger[0], checksum_sha256: "e".repeat(64) },
        ...ledger.slice(1),
      ],
    }).status,
    "HOLD_CANONICAL_MIGRATION_CHECKSUM_MISMATCH",
  );
  assert.equal(
    reconcileCanonicalMigrationChecksums({
      ...complete,
      sourceRevision: "local",
    }).status,
    "HOLD_EXACT_DEPLOYED_SHA_MISSING",
  );
});

function signingFixture() {
  const original = generateKeyPairSync("ed25519");
  const reviewer = generateKeyPairSync("ed25519");
  const pin = (pair, id) => {
    const der = pair.publicKey.export({ format: "der", type: "spki" });
    return {
      keyId: id,
      publicKeySpkiBase64: der.toString("base64"),
      independentlyAuthenticatedSpkiFingerprint: createHash("sha256")
        .update(der)
        .digest("hex"),
    };
  };
  const originalSourcePin = pin(original, "ORIGINAL-ICAMP-SIGNER");
  const reviewerPin = pin(reviewer, "INDEPENDENT-DB-REVIEWER");
  const payload = {
    schema: "icamp.database.provenance-receipt.v1",
    sourceId: "icamp",
    sourceRevision: revision,
    reviewerKeyId: reviewerPin.keyId,
    decision: "DATABASE_TARGET_AND_MIGRATION_CHECKSUMS_OBSERVED",
    databaseHostnameSha256: sha256Text(host),
    migrationManifestSha256: canonicalMigrationManifestDigest(),
    observedAt: when,
    nonce: "INDEPENDENT-DB-PROVENANCE-20261114-ABCD",
  };
  const receipt = {
    ...payload,
    signatureBase64: sign(
      null,
      Buffer.from(databaseProvenanceReceiptMessage(payload)),
      reviewer.privateKey,
    ).toString("base64"),
  };
  const input = {
    sourceRevision: revision,
    databaseHostname: host,
    reconciled: reconcileCanonicalMigrationChecksums(complete),
    reviewerEnrolled: true,
    reviewerPin,
    originalSourceEnrolled: true,
    originalSourcePin,
    receipt,
    asOf: when,
  };
  return input;
}

test("Genuine distinct signed receipt is observed without turning Masters ON", () => {
  const fixture = signingFixture();
  const verified = verifyIndependentDatabaseProvenance(fixture);
  assert.equal(
    verified.status,
    "SIGNED_DATABASE_PROVENANCE_OBSERVED_SOURCE_ONLY",
  );
  assert.equal(verified.independentDatabaseProvenance, true);
  assert.equal(verified.signatureVerified, true);
  assert.match(verified.receiptDigestSha256, /^[a-f0-9]{64}$/u);
  assert.equal(verified.originalSourceHealthy, false);
  assert.equal(verified.masterConnected, false);
  assert.equal(verified.ownerProductionAcceptance, "HOLD");
});

test("Unsigned, stale, mismatched host, identity, or fake authority never pass", () => {
  const fixture = signingFixture();
  const deny = (changes) =>
    verifyIndependentDatabaseProvenance({
      ...fixture,
      ...changes,
    }).independentDatabaseProvenance;
  assert.equal(deny({ receipt: null }), false);
  assert.equal(deny({ reviewerEnrolled: false }), false);
  assert.equal(deny({ originalSourceEnrolled: false }), false);
  assert.equal(deny({ reviewerPin: fixture.originalSourcePin }), false);
  assert.equal(deny({ databaseHostname: "wrong.example.org" }), false);
  assert.equal(deny({ asOf: "2026-11-17T19:00:00.000Z" }), false);
  assert.equal(
    deny({
      receipt: {
        ...fixture.receipt,
        migrationManifestSha256: "f".repeat(64),
      },
    }),
    false,
  );
  assert.equal(
    deny({
      receipt: {
        ...fixture.receipt,
        signatureBase64: "AAAA",
      },
    }),
    false,
  );
  assert.equal(
    deny({
      reconciled: reconcileCanonicalMigrationChecksums({
        ...complete,
        records: [],
      }),
    }),
    false,
  );
});

test("Supervised remediation stays read-only; original Meadow remains intact", () => {
  const fixture = signingFixture();
  const report = superviseRemediationEvidence({
    checksum: fixture.reconciled,
    provenance: verifyIndependentDatabaseProvenance(fixture),
    prior: { database: { schemaVerified: true } },
  });
  assert.equal(report.productionMigrationApproved, false);
  assert.equal(report.masterConnected, false);
  assert.equal(report.ownerProductionAcceptance, "HOLD");
  assert.equal(report.tasks.length, 5);
  assert.ok(report.tasks.some((task) => task.id === "FORMAL_OWNER_DECISION"));

  const service = source("lib/release/build253-provenance-postgres.mjs");
  const page = source("app/sysop/provenance-review/page.tsx");
  assert.match(service, /begin read only/u);
  assert.match(service, /ICAMP_EXPECTED_PRODUCTION_DATABASE_HOST/u);
  assert.match(service, /ICAMP_DB_PROVENANCE_REVIEWER_ENROLLED/u);
  assert.doesNotMatch(service, /client\.query\("(?:insert|update|delete|alter|create)/iu);
  assert.match(page, /requireSysop\("\/sysop"\)/u);
  assert.match(page, /Owner acceptance: HOLD/u);
  assert.equal(STANDARD_THEME.style, "Meadow & evergreen");
  assert.ok(
    existsSync(
      new URL("../public/themes/standard/meadow-hero.webp", import.meta.url),
    ),
  );
});
