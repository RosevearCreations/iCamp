import test from "node:test";
import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { readFileSync } from "node:fs";

import {
  inventoryReadiness263,
  normalizeRentalSession263,
  sessionLocalClock263,
} from "../lib/rental-planner/sessions263.mjs";
import {
  financialCloseReadiness263,
  verifyIndependentFinancialEvidence263,
} from "../lib/finance-assurance263/core.mjs";

const realOffer = "7e03df97-97c2-4b15-9717-8bb81ec79051";
const issuer = generateKeyPairSync("ed25519");
const reviewer = generateKeyPairSync("ed25519");
const pub = (key) => key.export({ type: "spki", format: "pem" });
const finger = (key) =>
  createHash("sha256")
    .update(key.export({ type: "spki", format: "der" }))
    .digest("hex");
const baseline = {
  envelopeJson: "",
  provider: "external_provider",
  statementId: "statement-20261118-001",
  statementDigestSha256: "a".repeat(64),
  sourceRevision: "b".repeat(40),
  issuerPublicKeyPem: pub(issuer.publicKey),
  reviewerPublicKeyPem: pub(reviewer.publicKey),
  issuerIndependentlyEnrolled: true,
  reviewerIndependentlyEnrolled: true,
  now: new Date("2026-11-18T16:00:00.000Z"),
};
function packet(overrides = {}) {
  const payload = {
    schema: "icamp.external-financial-evidence.v1",
    provider: baseline.provider,
    statementId: baseline.statementId,
    statementDigestSha256: baseline.statementDigestSha256,
    sourceRevision: baseline.sourceRevision,
    issuerFingerprintSha256: finger(issuer.publicKey),
    reviewerFingerprintSha256: finger(reviewer.publicKey),
    externalReference: "bank-packet-source-001",
    currencyCode: "CAD",
    netAmountCents: 152500,
    issuedAt: "2026-11-18T14:00:00.000Z",
    expiresAt: "2026-11-20T14:00:00.000Z",
    ...overrides,
  };
  const body = Buffer.from(JSON.stringify(payload));
  return JSON.stringify({
    payload,
    issuerSignatureBase64: sign(null, body, issuer.privateKey).toString(
      "base64",
    ),
    reviewerSignatureBase64: sign(null, body, reviewer.privateKey).toString(
      "base64",
    ),
  });
}

test("Build263 staff sessions require true date/time, safety and real offer IDs", () => {
  const record = normalizeRentalSession263({
    offerId: realOffer,
    plannedDay: "2026-11-19",
    start: "10:00",
    end: "12:00",
    participantLimit: 8,
    activityKind: "guided_horse",
    safetyBrief:
      "Qualified instructor, helmets, animal welfare and weather checks.",
  });
  assert.equal(record.startMinute, 600);
  assert.equal(record.endMinute, 720);
  assert.equal(record.guestBookingsCreated, false);
  assert.equal(sessionLocalClock263(600), "10:00");
  for (const changed of [
    { end: "10:00" },
    { start: "11:02" },
    { plannedDay: "2026-02-30" },
    { activityKind: "unsupervised_horse" },
    { participantLimit: 3000 },
    { safetyBrief: "ok" },
    { offerId: "synthetic" },
  ]) {
    assert.throws(() =>
      normalizeRentalSession263({
        offerId: realOffer,
        plannedDay: "2026-11-19",
        start: "10:00",
        end: "12:00",
        participantLimit: 8,
        activityKind: "guided_horse",
        safetyBrief:
          "Qualified instructor, helmets, animal welfare and weather checks.",
        ...changed,
      }),
    );
  }
});

test("Build263 inventory reports evidence coverage not fabricated counts", () => {
  const result = inventoryReadiness263(
    [
      { id: "a", operatingState: "operational", lifecycleState: "active" },
      { id: "b", operatingState: "offline", lifecycleState: "active" },
    ],
    [{ assetId: "a", isPublished: true }],
  );
  assert.equal(result.registeredEligibleAssetsObserved, 2);
  assert.equal(result.operationalCandidatesObserved, 1);
  assert.equal(result.notYetListedCandidatesObserved, 1);
  assert.equal(result.originalInventoryVerifiedComplete, false);
  assert.equal(result.rentalReservationsConfirmed, 0);
});

test("Build263 schema enforces property-bound sessions and overlapping slot rejection", () => {
  const migration = readFileSync(
    new URL(
      "../database/migrations/0239_build263_supervised_rental_sessions.sql",
      import.meta.url,
    ),
    "utf8",
  );
  for (const fragment of [
    "force row level security",
    "has_campground_permission",
    "for update of o",
    "s.start_minute<new.end_minute",
    "s.end_minute>new.start_minute",
    "rental_sessions263_offer_scope_fk",
    "no_direct_client",
  ]) {
    assert.ok(migration.includes(fragment), "Missing " + fragment);
  }
  const action = readFileSync(
    new URL(
      "../app/workspaces/management/campgrounds/rental-sessions263/actions.ts",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(action, /requireCampgroundPermission/);
});

test("Build263 financial proof validates independent signatures but never activates payments", () => {
  const accepted = verifyIndependentFinancialEvidence263({
    ...baseline,
    envelopeJson: packet(),
  });
  assert.equal(accepted.externallyConfirmedBankDeposit, false);
  assert.equal(accepted.liveSettlementAuthority, false);
  for (const changed of [
    { reviewerIndependentlyEnrolled: false },
    { reviewerPublicKeyPem: baseline.issuerPublicKeyPem },
    { sourceRevision: "c".repeat(40) },
    { envelopeJson: packet({ netAmountCents: -1 }) },
    { envelopeJson: packet({ expiresAt: "2026-11-18T14:10:00.000Z" }) },
    {
      envelopeJson: packet().replace(
        "bank-packet-source-001",
        "bank-packet-source-002",
      ),
    },
  ]) {
    assert.throws(() =>
      verifyIndependentFinancialEvidence263({
        ...baseline,
        envelopeJson: packet(),
        ...changed,
      }),
    );
  }
  const readiness = financialCloseReadiness263({
    originalMigrationMatched: true,
    originalDbCustody: true,
    signedFinancialEvidence: true,
    originalBankApiReadback: false,
  });
  assert.equal(readiness.livePaymentActivation, false);
  assert.equal(readiness.actualBankSettlementConfirmed, false);
});

test("Build263 theme contrast refinements remain regional and opt-in", () => {
  const css = readFileSync(
    new URL("../app/regional-themes262.css", import.meta.url),
    "utf8",
  );
  assert.match(css, /Build 263/u);
  assert.match(css, /prefers-reduced-motion/u);
  assert.match(css, /focus-visible/u);
});
