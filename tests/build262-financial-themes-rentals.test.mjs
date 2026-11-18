import test from "node:test";
import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { readFileSync } from "node:fs";

import {
  assessFinancialActivation262,
  sha256Custody262,
  verifyDbCustody262,
} from "../lib/finance-assurance262/core.mjs";
import {
  RENTAL_CATEGORIES262,
  findRentalTemplate262,
  rentalTemplates262,
} from "../lib/rental-planner/catalog262.mjs";

const db = generateKeyPairSync("ed25519");
const witness = generateKeyPairSync("ed25519");
const pem = (key) => key.export({ format: "pem", type: "spki" });
const fp = (key) =>
  createHash("sha256")
    .update(key.export({ format: "der", type: "spki" }))
    .digest("hex");

const revision = "a".repeat(40);
const host = "original-db.example.invalid";
const now = new Date("2026-11-17T19:00:00.000Z");
const opts = {
  envelopeJson: "",
  actualDatabaseHost: host,
  expectedDatabaseHost: host,
  sourceRevision: revision,
  custodianPublicKeyPem: pem(db.publicKey),
  reviewerPublicKeyPem: pem(witness.publicKey),
  custodianIndependentlyEnrolled: true,
  reviewerIndependentlyEnrolled: true,
  now,
};
function signed(overrides = {}) {
  const payload = {
    schema: "icamp.production-db-custody.v1",
    sourceRevision: revision,
    databaseHostnameSha256: sha256Custody262(host),
    migrationVersion: "0238",
    migrationChecksumSha256:
      "7cec224311959280b6199fa3ed373bc86c2a08678807e4a6d2795ae11280def3",
    custodianFingerprintSha256: fp(db.publicKey),
    reviewerFingerprintSha256: fp(witness.publicKey),
    originalHostReviewReference: "original-database-custodian-2026",
    issuedAt: "2026-11-17T17:00:00.000Z",
    expiresAt: "2026-11-19T17:00:00.000Z",
    ...overrides,
  };
  const bytes = Buffer.from(JSON.stringify(payload));
  return JSON.stringify({
    payload,
    custodianSignatureBase64: sign(null, bytes, db.privateKey).toString(
      "base64",
    ),
    reviewerSignatureBase64: sign(null, bytes, witness.privateKey).toString(
      "base64",
    ),
  });
}

test("Build 262 verifies signed original database custody but not legal identity", () => {
  const result = verifyDbCustody262({ ...opts, envelopeJson: signed() });
  assert.equal(result.status, "DUAL_SIGNED_ORIGINAL_DB_CUSTODY_OBSERVED");
  assert.equal(result.independentlyVerifiedLegalIdentity, false);
  assert.equal(result.bankSettlementCertified, false);
});

test("Build 262 rejects fake, expired, replayed or cross-host database custody", () => {
  for (const override of [
    { expectedDatabaseHost: "different-db.invalid" },
    { sourceRevision: "b".repeat(40) },
    { custodianIndependentlyEnrolled: false },
    { reviewerPublicKeyPem: opts.custodianPublicKeyPem },
    { envelopeJson: signed({ expiresAt: "2026-11-17T18:00:00.000Z" }) },
    { envelopeJson: signed({ databaseHostnameSha256: "f".repeat(64) }) },
    {
      envelopeJson: signed().replace(
        "original-database-custodian-2026",
        "original-database-custodian-2025",
      ),
    },
  ]) {
    assert.throws(
      () =>
        verifyDbCustody262({ ...opts, envelopeJson: signed(), ...override }),
      /HOLD/iu,
    );
  }
});

test("Build 262 never promotes technical evidence to money or bank clearing", () => {
  const migration = { verifiedOnProductionDatabase: true };
  const custody = verifyDbCustody262({ ...opts, envelopeJson: signed() });
  const result = assessFinancialActivation262({
    migration,
    providerEnrollment: "DUAL_SIGNED_ENROLLMENT_OBSERVED",
    dbCustody: custody,
    paymentAdapterReady: false,
    refundAdapterReady: false,
  });
  assert.equal(result.ownerEvidenceEligible, true);
  assert.equal(result.settlementActivationEligible, false);
  assert.equal(result.bankSettled, false);
  assert.equal(result.actualPaymentCaptured, false);
  assert.equal(
    assessFinancialActivation262({
      migration: { verifiedOnProductionDatabase: false },
      providerEnrollment: "HOLD",
      dbCustody: null,
      paymentAdapterReady: false,
      refundAdapterReady: false,
    }).ownerEvidenceEligible,
    false,
  );
});

test("Build 262 rental templates include paddle boats, horses, kites and other categories without creating inventory", () => {
  assert.ok(RENTAL_CATEGORIES262.length >= 14);
  assert.equal(findRentalTemplate262("pedal-boats")?.assetType, "watercraft");
  assert.equal(findRentalTemplate262("kites-games")?.assetType, "other");
  assert.equal(findRentalTemplate262("equestrian")?.kind, "facility");
  assert.match(
    findRentalTemplate262("equestrian")?.guidance ?? "",
    /supervised|staff/iu,
  );
  assert.equal(
    rentalTemplates262("equipment", "watercraft").some(
      (item) => item.id === "pedal-boats",
    ),
    true,
  );
  const managed = readFileSync(
    new URL(
      "../app/workspaces/management/campgrounds/rentals/page.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(managed, /RentalTemplatePicker262/);
  assert.match(managed, /RENTAL_CATEGORIES262/);
  const source = readFileSync(
    new URL("../lib/rental-planner/postgres.mjs", import.meta.url),
    "utf8",
  );
  assert.match(source, /operational_assets/);
  assert.match(source, /rental_planning_offers/);
  assert.match(source, /source_ready/);
});

test("Build 262 adds four themes while preserving the existing two", () => {
  const selector = readFileSync(
    new URL("../components/visual-theme-selector.tsx", import.meta.url),
    "utf8",
  );
  const css = readFileSync(
    new URL("../app/regional-themes262.css", import.meta.url),
    "utf8",
  );
  for (const item of [
    "standard",
    "orbit",
    "niagara",
    "nova-scotia",
    "bc-mountains",
    "saskatchewan",
  ]) {
    assert.ok(selector.includes('id: "' + item + '"'));
  }
  for (const theme of [
    "niagara",
    "nova-scotia",
    "bc-mountains",
    "saskatchewan",
  ]) {
    assert.ok(css.includes('[data-visual="' + theme + '"]'));
  }
  const actions = readFileSync(
    new URL(
      "../app/workspaces/management/command/finance-close260/actions.ts",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(actions, /inspectFinancialAssurance262/);
  assert.match(actions, /ownerEvidenceEligible/);
});
