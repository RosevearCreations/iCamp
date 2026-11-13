import assert from "node:assert/strict";
import {
  createHash,
  generateKeyPairSync,
  sign,
} from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildDossierContinuity } from "../lib/booking-charges/fulfillment-verification-core.mjs";
import {
  validateOriginalDeviceWitness,
  revalidateOwnerDossierSource,
  masterReceiptMessage,
  reconcileCrossMasterAcceptance,
} from "../lib/booking-charges/fulfillment-build249-core.mjs";

const id = "11111111-2222-4333-8444-555555555555";
const id2 = "11111111-2222-4333-8444-666666666666";
const sourceRevision = "a".repeat(40);
const sha = (input) => createHash("sha256").update(input).digest("hex");
const read = (path) =>
  readFileSync(new URL("../" + path, import.meta.url), "utf8");
const evidence = {
  schema: "icamp.fulfillment.owner-acceptance-evidence.v1",
  campgroundId: id,
  sourceRevision,
  trust: "UNSIGNED_TENANT_SCOPED_SOURCE_EVIDENCE",
  witnessStatementCount: 1,
  originalDeviceReviews: [{ id: "private-source" }],
  forecastCalibration: [{ id: "private-forecast" }],
  ownerAuditDecisions: [],
  completeness: "SOURCE_SNAPSHOT_ONLY",
  masterConnection: "HOLD",
  ownerProductionAcceptance: "HOLD",
};
const root = buildDossierContinuity({
  campgroundId: id,
  sourceRevision,
  evidenceSummary: evidence,
  previousSnapshot: null,
});
const newest = buildDossierContinuity({
  campgroundId: id,
  sourceRevision,
  evidenceSummary: evidence,
  previousSnapshot: { id: id2, digestSha256: root.digestSha256 },
});
const row = (entry, snapshotId, time) => ({
  id: snapshotId,
  campgroundId: id,
  previousSnapshotId: entry.previousId,
  previousDigestSha256: entry.previousDigest,
  sourceRevision: entry.sourceRevision,
  digestSha256: entry.digestSha256,
  evidenceSchema: entry.evidenceSchema,
  completeness: entry.completeness,
  witnessCount: entry.witnessCount,
  deviceReviewCount: entry.deviceReviewCount,
  forecastCount: entry.forecastCount,
  auditedCount: entry.auditedCount,
  recordedAt: time,
});
const snapshots = [
  row(newest, id, "2026-11-13T13:01:00.000Z"),
  row(root, id2, "2026-11-13T13:00:00.000Z"),
];

test("witness validation admits only source observations, never owner acceptance", () => {
  const input = {
    verificationId: id,
    decision: "source_observed_pending_external_authority",
    explanation: "Original device was observed independently against source.",
  };
  assert.equal(validateOriginalDeviceWitness(input).verificationId, id);
  assert.throws(() =>
    validateOriginalDeviceWitness({ ...input, decision: "owner_accepted" }),
  );
  assert.throws(() =>
    validateOriginalDeviceWitness({ ...input, verificationId: "wrong" }),
  );
  assert.throws(() =>
    validateOriginalDeviceWitness({ ...input, explanation: "short" }),
  );
});

test("dossier digest recomputation detects real source changes and holds acceptance", () => {
  const input = {
    campgroundId: id,
    snapshots,
    currentRevision: sourceRevision,
    currentEvidence: evidence,
  };
  const result = revalidateOwnerDossierSource(input);
  assert.equal(result.status, "HISTORICAL_DIGESTS_REVALIDATED_UNSIGNED");
  assert.equal(result.historicalDigestsVerified, true);
  assert.equal(result.masterConnected, false);
  assert.equal(result.ownerProductionAcceptance, "HOLD");
  assert.equal(
    revalidateOwnerDossierSource({
      ...input,
      snapshots: [
        { ...snapshots[0], witnessCount: 99 },
        snapshots[1],
      ],
    }).status,
    "HOLD_DOSSIER_SOURCE_DIGEST_MISMATCH",
  );
  assert.equal(
    revalidateOwnerDossierSource({
      ...input,
      currentRevision: "b".repeat(40),
    }).status,
    "HOLD_DOSSIER_RECAPTURE_AFTER_DEPLOY",
  );
  assert.equal(
    revalidateOwnerDossierSource({
      ...input,
      currentEvidence: { ...evidence, witnessStatementCount: 2 },
    }).status,
    "HOLD_SOURCE_COUNTS_CHANGED",
  );
  assert.equal(
    revalidateOwnerDossierSource({
      ...input,
      windowTruncated: true,
    }).status,
    "HOLD_INCOMPLETE_DOSSIER_WINDOW",
  );
  assert.equal(
    revalidateOwnerDossierSource({
      ...input,
      snapshots: [{ ...snapshots[0], campgroundId: id2 }, snapshots[1]],
    }).status,
    "HOLD_MALFORMED_DOSSIER_RECORD",
  );
});

function signedMasters() {
  const now = "2026-11-13T13:00:00.000Z";
  const planes = ["ai-data-platform", "rosevear-comms-hub", "rosevear-ai-hub"];
  const pairs = planes.map(() => generateKeyPairSync("ed25519"));
  const pins = pairs.map((pair, index) => {
    const der = pair.publicKey.export({ type: "spki", format: "der" });
    return {
      plane: planes[index],
      keyId: "TEST-PLANE-KEY-" + index,
      publicKeySpkiBase64: der.toString("base64"),
      independentlyAuthenticatedSpkiFingerprint: sha(der),
    };
  });
  const receipts = pins.map((pin, index) => {
    const receipt = {
      plane: pin.plane,
      sourceId: "icamp",
      sourceRevision,
      issuedAt: now,
      nonce: "TEST-ORIGINAL-MASTER-NONCE-" + index + "-ABCDEFGHIJKLMNOPQRSTUVWXYZ",
      keyId: pin.keyId,
      decision: "SOURCE_HEALTHY_OBSERVED",
    };
    return {
      ...receipt,
      signatureBase64: sign(
        null,
        Buffer.from(masterReceiptMessage(receipt)),
        pairs[index].privateKey,
      ).toString("base64"),
    };
  });
  return { pins, receipts, now };
}

test("three independent Ed25519 Master receipts remain observation-only", () => {
  const proof = signedMasters();
  const input = {
    ...proof,
    sourceRevision,
    asOf: "2026-11-13T13:01:00.000Z",
    custodianEnrolled: true,
  };
  const result = reconcileCrossMasterAcceptance(input);
  assert.equal(result.allIndependentlySigned, true);
  assert.equal(result.connected, false);
  assert.equal(result.ownerAccepted, false);
  assert.equal(result.sourceSignerAccepted, false);
  assert.equal(result.evidence.length, 3);
  assert.equal(
    reconcileCrossMasterAcceptance({
      ...input,
      custodianEnrolled: false,
    }).allIndependentlySigned,
    false,
  );
  assert.equal(
    reconcileCrossMasterAcceptance({
      ...input,
      receipts: input.receipts.slice(0, 2),
    }).evidence[2].status,
    "HOLD_ORIGINAL_MASTER_RECEIPT_MISSING",
  );
  assert.equal(
    reconcileCrossMasterAcceptance({
      ...input,
      receipts: [
        { ...input.receipts[0], sourceRevision: "b".repeat(40) },
        ...input.receipts.slice(1),
      ],
    }).evidence[0].status,
    "HOLD_RECEIPT_SOURCE_OR_PIN_MISMATCH",
  );
  assert.equal(
    reconcileCrossMasterAcceptance({
      ...input,
      pins: [
        { ...input.pins[0], independentlyAuthenticatedSpkiFingerprint: sha("wrong") },
        ...input.pins.slice(1),
      ],
    }).evidence[0].status,
    "HOLD_MASTER_PIN_FINGERPRINT_MISMATCH",
  );
  assert.equal(
    reconcileCrossMasterAcceptance({
      ...input,
      asOf: "2026-11-13T14:00:00.000Z",
    }).allIndependentlySigned,
    false,
  );
});

test("Build 249 SQL and owner export enforce immutable source and HOLD", () => {
  const sql = read(
    "database/migrations/0232_build249_original_device_witness.sql",
  );
  const verify = read(
    "database/verify/0232_build249_original_device_witness.sql",
  );
  const service = read(
    "lib/booking-charges/fulfillment-build249-postgres.mjs",
  );
  const exportRoute = read(
    "app/api/management/fulfillment-supervisor/acceptance-evidence/route.ts",
  );
  assert.match(sql, /force row level security/u);
  assert.match(sql, /unique\(signature_verification_id\)/u);
  assert.match(sql, /verified_by_user_id/u);
  assert.match(sql, /current_setting\('icamp.source_revision',true\)/u);
  assert.match(sql, /source_observed_pending_external_authority/u);
  assert.doesNotMatch(sql, /grant\s+(update|delete)/iu);
  assert.match(verify, /immutable witness cannot be updated or deleted/u);
  assert.match(service, /set local role icamp_app/u);
  assert.match(service, /ICAMP_MASTER_RECEIPT_CUSTODIAN_ENROLLED/u);
  assert.match(service, /await appendAuditEvent/u);
  assert.match(exportRoute, /roleCodes\.includes\("owner_admin"\)/u);
  assert.match(exportRoute, /revalidateOwnerDossierSource/u);
  assert.match(exportRoute, /readCrossMasterProtectedEvidence/u);
  assert.match(exportRoute, /private, no-store/u);
  assert.match(exportRoute, /ownerProductionAcceptance: "HOLD"/u);
});
