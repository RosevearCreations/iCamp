import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildDeviceSigningMessage,
  verifyOriginalDevicePacket,
  validateCalibrationClosure,
  buildDossierContinuity,
} from "../lib/booking-charges/fulfillment-verification-core.mjs";

const id = "11111111-2222-4333-8444-555555555555";
const id2 = "11111111-2222-4333-8444-666666666666";
const id3 = "11111111-2222-4333-8444-777777777777";
const revision = "a".repeat(40);
const hash = (x) => createHash("sha256").update(x).digest("hex");
const read = (path) =>
  readFileSync(new URL("../" + path, import.meta.url), "utf8");
const issuedAt = "2026-11-12T20:00:00.000Z";
const expected = {
  campgroundId: id,
  dispatchId: id2,
  fieldReportId: id3,
  originalReviewId: id,
  sourceRevision: revision,
  evidenceDigestSha256: "b".repeat(64),
};
function signedFixture() {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const spki = publicKey.export({ format: "der", type: "spki" });
  const trust = {
    keyId: "INDEPENDENT-DEVICE-TEST-KEY",
    publicKeySpkiBase64: spki.toString("base64"),
    independentlyAuthenticatedSpkiFingerprint: hash(spki),
  };
  const packet = {
    ...expected,
    keyId: trust.keyId,
    nonce: "AbCdEfGhIjKlMnOpQrStUvWxYz_123",
    issuedAt,
  };
  packet.signatureBase64 = sign(
    null,
    Buffer.from(buildDeviceSigningMessage(packet)),
    privateKey,
  ).toString("base64");
  return { trust, packet };
}
test("independently pinned Ed25519 signature verifies exact source binding", () => {
  const { trust, packet } = signedFixture();
  const result = verifyOriginalDevicePacket({
    packet,
    expected,
    trust,
    asOf: "2026-11-12T20:00:40.000Z",
  });
  assert.equal(result.status, "SIGNATURE_VALID_SOURCE_BOUND");
  assert.equal(result.accepted, true);
  assert.equal(
    result.fingerprint,
    trust.independentlyAuthenticatedSpkiFingerprint,
  );
  assert.equal(result.sourceRevision, revision);
  assert.equal(result.masterConnection, "HOLD");
  assert.match(result.nonceDigestSha256, /^[0-9a-f]{64}$/u);
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE KEY|signatureBase64/u);
});
test("device verifier rejects no pin, stale signature, altered source and wrong key", () => {
  const { trust, packet } = signedFixture();
  assert.equal(
    verifyOriginalDevicePacket({
      packet,
      expected,
      trust: null,
      asOf: issuedAt,
    }).accepted,
    false,
  );
  assert.equal(
    verifyOriginalDevicePacket({
      packet: { ...packet, campgroundId: id2 },
      expected,
      trust,
      asOf: issuedAt,
    }).status,
    "HOLD_SOURCE_MISMATCH",
  );
  assert.equal(
    verifyOriginalDevicePacket({
      packet: { ...packet, evidenceDigestSha256: "c".repeat(64) },
      expected,
      trust,
      asOf: issuedAt,
    }).status,
    "HOLD_SOURCE_MISMATCH",
  );
  assert.equal(
    verifyOriginalDevicePacket({
      packet: { ...packet, nonce: "ChangedDeviceNonce1234567890123" },
      expected,
      trust,
      asOf: issuedAt,
    }).accepted,
    false,
  );
  assert.equal(
    verifyOriginalDevicePacket({
      packet,
      expected,
      trust: {
        ...trust,
        independentlyAuthenticatedSpkiFingerprint: "d".repeat(64),
      },
      asOf: issuedAt,
    }).status,
    "HOLD_PIN_FINGERPRINT_MISMATCH",
  );
  assert.equal(
    verifyOriginalDevicePacket({
      packet,
      expected,
      trust,
      asOf: "2026-11-12T20:08:00.000Z",
    }).status,
    "HOLD_STALE_CHALLENGE",
  );
});
test("calibration closure rejects owner acceptance and malformed source", () => {
  const basic = {
    checkpointId: id,
    followupId: id2,
    decision: "source_reconciled_unverified",
    explanation:
      "The owner checked source mitigation against original evidence.",
  };
  assert.equal(validateCalibrationClosure(basic).previousClosureId, null);
  assert.equal(
    validateCalibrationClosure({ ...basic, previousClosureId: id3 })
      .previousClosureId,
    id3,
  );
  for (const change of [
    { decision: "owner_accepted" },
    { checkpointId: "bad" },
    { previousClosureId: "bad" },
    { explanation: "short" },
  ])
    assert.throws(() => validateCalibrationClosure({ ...basic, ...change }));
});
test("owner dossier chain persists only source counts and digests", () => {
  const evidenceSummary = {
    campgroundId: id,
    ownerProductionAcceptance: "HOLD",
    masterConnection: "HOLD",
    schema: "icamp.fulfillment.owner-acceptance-evidence.v1",
    trust: "UNSIGNED_TENANT_SCOPED_SOURCE_EVIDENCE",
    witnessStatementCount: 3,
    originalDeviceReviews: [{ privateNote: "KEEP_PRIVATE" }],
    forecastCalibration: [{ privateEmail: "KEEP_PRIVATE" }],
    ownerAuditDecisions: [],
    completeness: "PARTIAL_HOLD",
  };
  const initial = buildDossierContinuity({
    campgroundId: id,
    sourceRevision: revision,
    evidenceSummary,
    previousSnapshot: null,
  });
  assert.equal(initial.previousDigest, null);
  assert.match(initial.digestSha256, /^[0-9a-f]{64}$/u);
  assert.doesNotMatch(
    JSON.stringify(initial),
    /KEEP_PRIVATE|privateNote|privateEmail/u,
  );
  const next = buildDossierContinuity({
    campgroundId: id,
    sourceRevision: revision,
    evidenceSummary,
    previousSnapshot: { id: id2, digestSha256: initial.digestSha256 },
  });
  assert.equal(next.previousDigest, initial.digestSha256);
  assert.notEqual(next.digestSha256, initial.digestSha256);
  assert.equal(next.ownerAcceptance, "HOLD");
  assert.throws(() =>
    buildDossierContinuity({
      campgroundId: id,
      sourceRevision: revision,
      evidenceSummary: {
        ...evidenceSummary,
        ownerProductionAcceptance: "ACCEPTED",
      },
      previousSnapshot: null,
    }),
  );
});
test("Build 247 SQL RLS guards audit, replay and source revision", () => {
  const sql = read(
    "database/migrations/0231_build247_device_calibration_dossier_continuity.sql",
  );
  const verify = read(
    "database/verify/0231_build247_device_calibration_dossier_continuity.sql",
  );
  const db = read("lib/booking-charges/fulfillment-verification-postgres.mjs");
  assert.match(sql, /force row level security/u);
  assert.match(sql, /unique\(signer_key_id,nonce_digest_sha256\)/u);
  assert.match(sql, /icamp_private\.has_current_campground_owner_admin/u);
  assert.match(sql, /current_setting\('icamp.source_revision',true\)/u);
  assert.match(sql, /dossier_digest_sha256/u);
  assert.doesNotMatch(sql, /grant\s+(update|delete)/iu);
  assert.match(verify, /immutable ledger cannot allow updates or deletes/u);
  assert.match(db, /ICAMP_DEVICE_VERIFIER_CUSTODIAN_ENROLLED/u);
  assert.match(db, /VERCEL_GIT_COMMIT_SHA/u);
  assert.match(db, /await appendAuditEvent/u);
});
test("Orbit Command CSS and technical Sysop shell preserve tenant boundaries", () => {
  const css = read("app/orbit-theme.css");
  const layout = read("app/layout.tsx");
  const app = read("components/app-shell.tsx");
  const sysop = read("components/sysop-shell.tsx");
  assert.match(css, /\.app-shell\[data-visual="orbit"\]/u);
  assert.match(css, /\[data-shell="sysop"\]/u);
  assert.match(css, /@media \(max-width: 60rem\)/u);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/u);
  assert.match(css, /data-icamp-contrast="high"/u);
  assert.match(layout, /orbit-theme\.css/u);
  assert.match(app, /data-visual="orbit"/u);
  assert.match(sysop, /data-shell="sysop"/u);
  assert.doesNotMatch(
    sysop,
    /href="\/booking\/map"|href="\/workspaces\/guest"/u,
  );
  const manifest = JSON.parse(
    read("public/.well-known/rosevear-integration-manifest.json"),
  );
  assert.equal(manifest.tenant_boundary, "platform_shell");
  assert.equal(manifest.signature.key_id, null);
  assert.equal(manifest.connection_state, "DISCONNECTED / HOLD");
});
test("private owner export keeps role guards and hold labels", () => {
  const route = read(
    "app/api/management/fulfillment-supervisor/acceptance-evidence/route.ts",
  );
  const actions = read(
    "app/workspaces/management/campgrounds/fulfillment-priority/actions.ts",
  );
  assert.match(route, /accountType !== "staff"/u);
  assert.match(route, /roleCodes\.includes\("owner_admin"\)/u);
  assert.match(route, /private, no-store/u);
  assert.match(route, /listVerificationContinuityEvidence/u);
  assert.match(actions, /captureOwnerDossierSnapshotAction/u);
  assert.match(actions, /recordIndependentDeviceSignatureAction/u);
  assert.match(actions, /recordOwnerCalibrationClosureAction/u);
});
