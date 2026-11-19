import test from "node:test";
import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { readFileSync } from "node:fs";

import {
  SAFETY_TEXT265,
  SAFETY_VERSION265,
  normalizedGuestAcknowledgment265,
  normalizedCustody265,
  normalizedSupervision265,
  normalizedSupport265,
  classifyCampgroundSupport265,
} from "../lib/campground-support265/core.mjs";
import {
  ROSEVEAR_PEER_APPS265,
  verifyOriginalReceiverAck265,
  readReceiverMatrix265,
} from "../lib/integration-v1/receiver-ack265.mjs";

const A = "7e03df97-97c2-4b15-9717-8bb81ec79051";
test("Build265 guest safety statement is stable and explicit; no waiver or payment", () => {
  assert.equal(
    SAFETY_VERSION265,
    createHash("sha256").update(SAFETY_TEXT265).digest("hex"),
  );
  assert.equal(
    normalizedGuestAcknowledgment265({
      allocationId: A,
      safetyConfirmed: true,
      termsConfirmed: true,
    }).waiverCertified,
    false,
  );
  assert.throws(() =>
    normalizedGuestAcknowledgment265({
      allocationId: A,
      safetyConfirmed: true,
      termsConfirmed: false,
    }),
  );
  assert.throws(() =>
    normalizedGuestAcknowledgment265({
      allocationId: "another",
      safetyConfirmed: true,
      termsConfirmed: true,
    }),
  );
});
test("Build265 original custody and independent supervised witness are safely limited", () => {
  const pickup = normalizedCustody265({
    allocationId: A,
    eventKind: "staff_observed_pickup",
    evidenceReference: "original-local-check-001",
    conditionNote:
      "Actual observed registered item and staff condition review with physical return checks.",
  });
  assert.equal(pickup.bankPaid, false);
  assert.equal(pickup.physicalThirdPartyVerified, false);
  assert.throws(() =>
    normalizedCustody265({
      allocationId: A,
      eventKind: "horse_self_service",
      evidenceReference: "original-local-check-001",
      conditionNote:
        "Actual observed registered item and staff condition review with physical return checks.",
    }),
  );
  const witness = normalizedSupervision265({
    pilotReviewId: A,
    siteReference: "site-evidence-1",
    supervisionReference: "staff-instructor-evidence-1",
    safetyRestrictions:
      "Original on-site staff observed supervision, safety conditions and participant limits.",
  });
  assert.equal(witness.livePublicPilotAuthorized, false);
  assert.equal(witness.insuranceVerifiedExternally, false);
});
test("Build265 scopes complaint, outage, traffic and site change categories and counts original cases", () => {
  const ticket = normalizedSupport265({
    category: "software_locked",
    severity: "critical",
    title: "Property system unresponsive",
    description:
      "Campground staff report a nonresponsive workspace with a verified timestamp.",
  });
  assert.equal(ticket.status, "open");
  assert.throws(() =>
    normalizedSupport265({
      category: "password",
      severity: "critical",
      title: "Access",
      description: "too short",
    }),
  );
  const x = classifyCampgroundSupport265([
    { status: "open", severity: "critical", category: "software_locked" },
    { status: "triaged", severity: "priority", category: "performance" },
    { status: "resolved", severity: "routine", category: "guest_complaint" },
  ]);
  assert.deepEqual(
    [x.observed, x.criticalOpen, x.lockedOpen, x.performanceOpen],
    [3, 1, 1, 1],
  );
});
test("Build265 original receiver ACK validates actual separate signer and exact source pins, not live 7/7", () => {
  const k = generateKeyPairSync("ed25519");
  const fp = createHash("sha256")
    .update(k.publicKey.export({ format: "der", type: "spki" }))
    .digest("hex");
  const issued = "2026-11-19T14:00:00.000Z",
    expires = "2026-11-19T14:00:45.000Z";
  const params = {
    appId: "rosevear-ai-hub",
    publicKeyPem: k.publicKey.export({ format: "pem", type: "spki" }),
    expectedSourceSha: "a".repeat(40),
    expectedReceiverSha: "b".repeat(40),
    independentlyEnrolled: true,
    now: new Date("2026-11-19T14:00:20.000Z"),
  };
  const payload = {
    schema: "rosevear.peer.receiver-ack.v1",
    appId: params.appId,
    status: "ACK",
    sourceSha: params.expectedSourceSha,
    receiverSha: params.expectedReceiverSha,
    originalReceiptReference: "original-peer-ack-001",
    nonce: "c".repeat(32),
    sourceAggregateDigestSha256: "d".repeat(64),
    receiverFingerprintSha256: fp,
    authorizesAction: false,
    issuedAt: issued,
    expiresAt: expires,
  };
  const body = Buffer.from(JSON.stringify(payload));
  const envelopeJson = JSON.stringify({
    payload,
    receiverSignatureBase64: sign(null, body, k.privateKey).toString("base64"),
  });
  const result = verifyOriginalReceiverAck265({ ...params, envelopeJson });
  assert.equal(result.remoteLiveTransportProven, false);
  assert.equal(result.permitsRemoteReboot, false);
  assert.throws(
    () =>
      verifyOriginalReceiverAck265({
        ...params,
        envelopeJson,
        expectedSourceSha: "c".repeat(40),
      }),
    /HOLD/,
  );
  assert.throws(
    () =>
      verifyOriginalReceiverAck265({
        ...params,
        envelopeJson,
        independentlyEnrolled: false,
      }),
    /HOLD/,
  );
  assert.throws(
    () =>
      verifyOriginalReceiverAck265({
        ...params,
        envelopeJson,
        now: new Date("2026-11-19T14:02:00.000Z"),
      }),
    /HOLD/,
  );
  const matrix = readReceiverMatrix265(
    {},
    new Date("2026-11-19T14:00:20.000Z"),
  );
  assert.equal(matrix.records.length, 7);
  assert.equal(ROSEVEAR_PEER_APPS265.length, 7);
  assert.equal(matrix.verifiedOriginalAckCount, 0);
  assert.equal(matrix.independentlyConnected, false);
});
test("Build265 source SQL enforces append-only, tenant guards and no direct client role grants", () => {
  const m = readFileSync(
    new URL(
      "../database/migrations/0241_build265_custody_support.sql",
      import.meta.url,
    ),
    "utf8",
  );
  const checks = [
    "guard_rental_safety265",
    "guard_rental_custody265",
    "guard_rental_cancellation265",
    "guard_rental_supervision265",
    "guard_campground_support265",
    "rental_safety_ack265",
    "rental_custody_events265",
    "rental_supervision_witness265",
    "campground_support265",
    "force row level security",
    "to icamp_app using(false)",
    "Only original eligible guest",
    "Pickup requires current source item",
    "reconcile custody first",
  ];
  for (const fragment of checks)
    assert.ok(m.includes(fragment), "Missing " + fragment);
  const action = readFileSync(
    new URL(
      "../app/workspaces/management/campgrounds/operations-centre265/actions.ts",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(action, /requireCampgroundPermission/);
  const guest = readFileSync(
    new URL("../app/guest/rentals/actions.ts", import.meta.url),
    "utf8",
  );
  assert.match(guest, /recordGuestSafetyAcknowledgement265/);
});
test("Build265 local tenant and separate platform Sysop UIs preserve distinct scopes", () => {
  const local = readFileSync(
    new URL(
      "../app/workspaces/management/campgrounds/operations-centre265/page.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const platform = readFileSync(
    new URL("../app/sysop/support265/page.tsx", import.meta.url),
    "utf8",
  );
  assert.match(local, /listLocalSupport265/);
  assert.match(local, /campground.operations.manage/);
  assert.match(local, /Local I.T. diagnostics/);
  assert.match(platform, /requireSysop/);
  assert.match(platform, /listPlatformSupportAggregates265/);
  assert.match(platform, /readReceiverMatrix265/);
  assert.match(platform, /UNKNOWN/);
});
