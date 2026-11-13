import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import {
  evaluateBuild250OwnerGate,
  sourceHealthyMessage,
  validateBuild250OwnerDecision,
  verifySourceHealthyCeremony,
} from "../lib/booking-charges/fulfillment-build250-core.mjs";
import { STANDARD_THEME } from "../lib/theme/standard.mjs";

const campgroundId = "11111111-2222-4333-8444-555555555555";
const snapshotId = "11111111-2222-4333-8444-666666666666";
const packetId = "11111111-2222-4333-8444-777777777777";
const witnessId = "11111111-2222-4333-8444-888888888888";
const dispatchId = "11111111-2222-4333-8444-999999999999";
const sourceRevision = "a".repeat(40);
const dossierDigestSha256 = "b".repeat(64);
const asOf = "2026-11-13T16:00:00.000Z";
const sha = (data) => createHash("sha256").update(data).digest("hex");
const read = (path) =>
  readFileSync(new URL("../" + path, import.meta.url), "utf8");

function sourceHealthFixture() {
  const keys = generateKeyPairSync("ed25519");
  const spki = keys.publicKey.export({ format: "der", type: "spki" });
  const trust = {
    keyId: "ICAMP-ORIGINAL-SOURCE-TEST",
    publicKeySpkiBase64: spki.toString("base64"),
    independentlyAuthenticatedSpkiFingerprint: sha(spki),
  };
  const original = {
    sourceId: "icamp",
    campgroundId,
    sourceRevision,
    dossierDigestSha256,
    keyId: trust.keyId,
    nonce: "SUPERVISED-SOURCE-TEST-NONCE-ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    issuedAt: asOf,
    decision: "SOURCE_HEALTHY_OBSERVED",
  };
  const receipt = {
    ...original,
    signatureBase64: sign(
      null,
      Buffer.from(sourceHealthyMessage(original)),
      keys.privateKey,
    ).toString("base64"),
  };
  return { trust, receipt };
}
test("original source HEALTHY requires custodian pin, Ed25519 and exact source", () => {
  const fixture = sourceHealthFixture();
  const params = {
    campgroundId,
    sourceRevision,
    dossierDigestSha256,
    ...fixture,
    custodianEnrolled: true,
    asOf,
  };
  const actual = verifySourceHealthyCeremony(params);
  assert.equal(actual.sourceHealthyVerified, true);
  assert.equal(actual.masterConnected, false);
  assert.equal(actual.ownerProductionAcceptance, "HOLD");
  assert.equal(
    verifySourceHealthyCeremony({
      ...params,
      custodianEnrolled: false,
    }).sourceHealthyVerified,
    false,
  );
  assert.equal(
    verifySourceHealthyCeremony({
      ...params,
      dossierDigestSha256: "c".repeat(64),
    }).status,
    "HOLD_SOURCE_HEALTH_RECEIPT_MISMATCH",
  );
  assert.equal(
    verifySourceHealthyCeremony({
      ...params,
      receipt: { ...params.receipt, signatureBase64: "a" },
    }).sourceHealthyVerified,
    false,
  );
  assert.equal(
    verifySourceHealthyCeremony({
      ...params,
      asOf: "2026-11-13T17:00:00.000Z",
    }).status,
    "HOLD_STALE_SOURCE_HEALTH_RECEIPT",
  );
});
test("three Master signatures alone never authorize owner review", () => {
  const input = {
    campgroundId,
    sourceRevision,
    dossierIntegrity: {
      status: "HISTORICAL_DIGESTS_REVALIDATED_UNSIGNED",
      currentSourceCountsMatch: true,
    },
    dossierSnapshots: [
      {
        id: snapshotId,
        campgroundId,
        sourceRevision,
        digestSha256: dossierDigestSha256,
      },
    ],
    signedSourceHealthy: { sourceHealthyVerified: true },
    crossMasterEvidence: {
      allIndependentlySigned: true,
      sourceRevision,
      connected: false,
      evidence: [
        { plane: "ai-data-platform", status: "SIGNED_RECEIPT_OBSERVED_NOT_OWNER_ACCEPTED" },
        { plane: "rosevear-comms-hub", status: "SIGNED_RECEIPT_OBSERVED_NOT_OWNER_ACCEPTED" },
        { plane: "rosevear-ai-hub", status: "SIGNED_RECEIPT_OBSERVED_NOT_OWNER_ACCEPTED" },
      ],
    },
    originalDeviceWitnesses: [
      {
        id: witnessId,
        dispatchId,
        originalReviewId: snapshotId,
        signatureVerificationId: packetId,
        decision: "source_observed_pending_external_authority",
        sourceRevision,
        admittedAt: asOf,
      },
    ],
    verifiedSourcePackets: [
      {
        id: packetId,
        dispatchId,
        originalReviewId: snapshotId,
        sourceRevision,
        decision: "signature_valid_source_bound",
      },
    ],
    asOf,
  };
  const ok = evaluateBuild250OwnerGate(input);
  assert.equal(ok.supervisedReviewEligible, true);
  assert.equal(ok.status, "SUPERVISED_SOURCE_REVIEW_ELIGIBLE_NOT_ACCEPTED");
  assert.equal(ok.masterConnected, false);
  assert.equal(ok.ownerProductionAcceptance, "HOLD");
  assert.equal(
    evaluateBuild250OwnerGate({
      ...input,
      signedSourceHealthy: { sourceHealthyVerified: false },
    }).supervisedReviewEligible,
    false,
  );
  assert.equal(
    evaluateBuild250OwnerGate({
      ...input,
      crossMasterEvidence: {
        ...input.crossMasterEvidence,
        allIndependentlySigned: false,
      },
    }).status,
    "HOLD_THREE_INDEPENDENT_MASTER_RECEIPTS",
  );
  assert.equal(
    evaluateBuild250OwnerGate({
      ...input,
      originalDeviceWitnesses: [
        { ...input.originalDeviceWitnesses[0], decision: "discrepancy_hold" },
      ],
    }).status,
    "HOLD_FRESH_INDEPENDENT_DEVICE_WITNESS",
  );
  assert.equal(
    evaluateBuild250OwnerGate({
      ...input,
      dossierIntegrity: { status: "HOLD_SOURCE_COUNTS_CHANGED" },
    }).supervisedReviewEligible,
    false,
  );
  assert.throws(() =>
    validateBuild250OwnerDecision({
      decision: "request_supervised_review",
      explanation: "Owner requests independently supervised review.",
      eligible: false,
    }),
  );
  assert.equal(
    validateBuild250OwnerDecision({
      decision: "request_supervised_review",
      explanation: "Owner requests independently supervised review.",
      eligible: true,
    }).operationalAcceptance,
    "HOLD",
  );
  assert.equal(
    validateBuild250OwnerDecision({
      decision: "reject",
      explanation: "Missing original independently verified source proof.",
      eligible: false,
    }).decision,
    "reject",
  );
});
test("Build 250 owner-only append ledger protects source and freshness", () => {
  const sql = read(
    "database/migrations/0233_build250_owner_supervised_ceremony.sql",
  );
  const verify = read(
    "database/verify/0233_build250_owner_supervised_ceremony.sql",
  );
  const service = read("lib/booking-charges/fulfillment-build250-postgres.mjs");
  const api = read(
    "app/api/management/fulfillment-supervisor/acceptance-evidence/route.ts",
  );
  assert.match(sql, /force row level security/u);
  assert.match(sql, /has_current_campground_owner_admin/u);
  assert.match(sql, /original_device_witness_admissions/u);
  assert.match(sql, /source_health_nonce_digest_sha256/u);
  assert.match(sql, /24 hours/u);
  assert.match(sql, /current_setting\('icamp.source_revision',true\)/u);
  assert.match(verify, /immutable owner review/u);
  assert.doesNotMatch(sql, /grant\s+(?:update|delete)/iu);
  assert.match(service, /set local role icamp_app/u);
  assert.match(service, /ICAMP_SOURCE_HEALTH_CUSTODIAN_ENROLLED/u);
  assert.match(service, /await appendAuditEvent/u);
  assert.match(api, /roleCodes\.includes\("owner_admin"\)/u);
  assert.match(api, /ownerSupervisedCeremony/u);
  assert.match(api, /private, no-store/u);
  assert.match(api, /ownerProductionAcceptance: "HOLD"/u);
});
test("Standard Meadow remains a platform theme with a real switch", () => {
  assert.equal(STANDARD_THEME.id, "standard");
  assert.equal(STANDARD_THEME.style, "Meadow & evergreen");
  assert.equal(STANDARD_THEME.background, "/themes/standard/meadow-hero.webp");
  assert.ok(
    existsSync(
      new URL("../public/themes/standard/meadow-hero.webp", import.meta.url),
    ),
  );
  const shell = read("components/app-shell.tsx");
  const selector = read("components/visual-theme-selector.tsx");
  const standard = read("app/standard-theme.css");
  const orbit = read("app/orbit-theme.css");
  assert.match(shell, /data-visual="standard"/u);
  assert.match(shell, /VisualThemeSelector/u);
  assert.match(selector, /icamp.visualTheme.v1/u);
  assert.match(selector, /window.localStorage.setItem/u);
  assert.match(selector, /Standard \/ Meadow/u);
  assert.match(selector, /Orbit Command/u);
  assert.match(standard, /meadow-hero\.webp/u);
  assert.match(orbit, /data-visual="orbit"/u);
});
