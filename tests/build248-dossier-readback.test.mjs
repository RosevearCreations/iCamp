import assert from "node:assert/strict";
import { createHash, generateKeyPairSync } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  assessDeviceVerifierPin,
  auditOwnerDossierLineage,
} from "../lib/booking-charges/fulfillment-dossier-readback-core.mjs";

const id = "11111111-2222-4333-8444-555555555555";
const oldId = "11111111-2222-4333-8444-666666666666";
const sha = (text) => createHash("sha256").update(text).digest("hex");
const read = (path) =>
  readFileSync(new URL("../" + path, import.meta.url), "utf8");
const pin = () => {
  const { publicKey } = generateKeyPairSync("ed25519");
  const der = publicKey.export({ format: "der", type: "spki" });
  return {
    keyId: "ICAMP-ORIGINAL-DEVICE-PIN",
    publicKeySpkiBase64: der.toString("base64"),
    independentlyAuthenticatedSpkiFingerprint: sha(der),
  };
};
const root = {
  id: oldId,
  campgroundId: id,
  previousSnapshotId: null,
  previousDigestSha256: null,
  sourceRevision: "a".repeat(40),
  digestSha256: sha("historical dossier"),
  completeness: "PARTIAL_HOLD",
  witnessCount: 2,
  deviceReviewCount: 1,
  forecastCount: 0,
  auditedCount: 1,
  recordedAt: "2026-11-12T20:00:00.000Z",
};
const head = {
  ...root,
  id,
  previousSnapshotId: oldId,
  previousDigestSha256: root.digestSha256,
  digestSha256: sha("newer dossier"),
  recordedAt: "2026-11-12T21:00:00.000Z",
};

test("pin readback requires independent enrollment, valid Ed25519 and exact digest", () => {
  const trust = pin();
  assert.equal(
    assessDeviceVerifierPin({ trust, custodianEnrolled: false }).configured,
    false,
  );
  assert.equal(
    assessDeviceVerifierPin({ trust, custodianEnrolled: true }).status,
    "PIN_CONFIGURED_REQUIRES_INDEPENDENT_SOURCE_WITNESS",
  );
  assert.equal(
    assessDeviceVerifierPin({
      trust: { ...trust, independentlyAuthenticatedSpkiFingerprint: sha("wrong") },
      custodianEnrolled: true,
    }).status,
    "HOLD_PIN_FINGERPRINT_MISMATCH",
  );
  assert.equal(
    assessDeviceVerifierPin({
      trust: { ...trust, publicKeySpkiBase64: "not-base64" },
      custodianEnrolled: true,
    }).configured,
    false,
  );
  const rsa = generateKeyPairSync("rsa", { modulusLength: 2048 });
  assert.equal(
    assessDeviceVerifierPin({
      trust: {
        ...trust,
        publicKeySpkiBase64: rsa.publicKey.export({ format: "der", type: "spki" }).toString("base64"),
        independentlyAuthenticatedSpkiFingerprint: sha(
          rsa.publicKey.export({ format: "der", type: "spki" }),
        ),
      },
      custodianEnrolled: true,
    }).status,
    "HOLD_WRONG_PIN_ALGORITHM",
  );
});

test("owner dossier pointer chain is inspected but never labeled signed or accepted", () => {
  const ok = auditOwnerDossierLineage({
    campgroundId: id,
    snapshots: [head, root],
  });
  assert.equal(
    ok.status,
    "POINTER_CHAIN_CONSISTENT_UNSIGNED_NOT_CONTENT_VERIFIED",
  );
  assert.equal(ok.reviewedSnapshotCount, 2);
  assert.equal(ok.independentSignatureVerified, false);
  assert.equal(ok.contentDigestRecomputed, false);
  assert.equal(ok.ownerProductionAcceptance, "HOLD");
  assert.equal(ok.masterConnection, "HOLD");
});
test("owner dossier readback fails closed on cross-tenant, broken, incomplete and malformed history", () => {
  const check = (snapshots, windowTruncated = false) =>
    auditOwnerDossierLineage({ campgroundId: id, snapshots, windowTruncated }).status;
  assert.equal(check([]), "HOLD_NO_DOSSIER_SNAPSHOTS");
  assert.equal(check([head, root], true), "HOLD_INCOMPLETE_DOSSIER_WINDOW");
  assert.equal(check([head]), "HOLD_INCOMPLETE_DOSSIER_WINDOW");
  assert.equal(
    check([{ ...head, previousDigestSha256: sha("changed") }, root]),
    "HOLD_BROKEN_DOSSIER_POINTER",
  );
  assert.equal(
    check([{ ...head, campgroundId: oldId }, root]),
    "HOLD_MALFORMED_DOSSIER_RECORD",
  );
  assert.equal(
    check([{ ...head, witnessCount: -1 }, root]),
    "HOLD_MALFORMED_DOSSIER_RECORD",
  );
  assert.equal(
    check([root, head]),
    "HOLD_BROKEN_DOSSIER_POINTER",
  );
  assert.equal(
    check([{ ...root, previousDigestSha256: sha("bad") }]),
    "HOLD_BROKEN_DOSSIER_ROOT",
  );
});
test("Build 248 readback remains tenant private with no acceptance shortcut", () => {
  const pg = read("lib/booking-charges/fulfillment-verification-postgres.mjs");
  const api = read("app/api/management/fulfillment-supervisor/acceptance-evidence/route.ts");
  assert.match(pg, /assessDeviceVerifierPin/u);
  assert.match(pg, /dossierWindowTruncated/u);
  assert.match(pg, /where campground_id=\$1/u);
  assert.match(pg, /set local role icamp_app/u);
  assert.match(api, /roleCodes\.includes\("owner_admin"\)/u);
  assert.match(api, /auditOwnerDossierLineage/u);
  assert.match(api, /private, no-store/u);
  assert.match(api, /independentDeviceAcceptance: "HOLD"/u);
  assert.match(api, /ownerProductionAcceptance: "HOLD"/u);
});
