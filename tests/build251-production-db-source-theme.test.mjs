import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import {
  BUILD251_TABLES,
  assessCrossDeviceThemeAcceptance,
  classifyProductionDatabase,
  custodyAttestationMessage,
  inspectOriginalSignerEnrollment,
} from "../lib/release/build251-readiness-core.mjs";
import { STANDARD_THEME } from "../lib/theme/standard.mjs";

const sha = (input) => createHash("sha256").update(input).digest("hex");
const sourceRevision = "a".repeat(40);
const date = "2026-11-13T18:00:00.000Z";
const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const secureTable = (name) => ({
  name,
  present: true,
  rowLevelSecurity: true,
  forceRowLevelSecurity: true,
  policyCount: 2,
  appendOnly: true,
  hasGuardTrigger: true,
});
const healthy = {
  sourceRevision,
  databaseConfigured: true,
  expectedHost: "pinned-db.example.net",
  runtimeHost: "pinned-db.example.net",
  querySucceeded: true,
  tables: BUILD251_TABLES.map(secureTable),
};

test("runtime migration readback requires actual DATABASE_URL target pin and three guarded tables", () => {
  const complete = classifyProductionDatabase(healthy);
  assert.equal(complete.schemaVerified, true);
  assert.equal(complete.independentlyApprovedProductionDatabase, false);
  assert.equal(complete.masterConnected, false);
  assert.equal(complete.checklist.length, 3);
  assert.equal(
    classifyProductionDatabase({
      ...healthy,
      expectedHost: null,
    }).status,
    "HOLD_INDEPENDENT_DATABASE_TARGET_NOT_PINNED",
  );
  assert.equal(
    classifyProductionDatabase({
      ...healthy,
      runtimeHost: "other-db.example.net",
    }).status,
    "HOLD_DATABASE_TARGET_PIN_MISMATCH",
  );
  assert.equal(
    classifyProductionDatabase({
      ...healthy,
      tables: healthy.tables.filter(
        (row) => row.name !== BUILD251_TABLES[2],
      ),
    }).status,
    "HOLD_REQUIRED_MIGRATIONS_NOT_VERIFIED",
  );
  assert.equal(
    classifyProductionDatabase({
      ...healthy,
      tables: [
        { ...secureTable(BUILD251_TABLES[0]), appendOnly: false },
        ...healthy.tables.slice(1),
      ],
    }).schemaVerified,
    false,
  );
  assert.equal(
    classifyProductionDatabase({
      ...healthy,
      querySucceeded: false,
    }).status,
    "HOLD_DATABASE_READBACK_FAILED",
  );
});

function signedCustodyFixture() {
  const original = generateKeyPairSync("ed25519");
  const reviewer = generateKeyPairSync("ed25519");
  const format = (pair, keyId) => {
    const spki = pair.publicKey.export({ type: "spki", format: "der" });
    return {
      keyId,
      publicKeySpkiBase64: spki.toString("base64"),
      independentlyAuthenticatedSpkiFingerprint: sha(spki),
    };
  };
  const originalPin = format(original, "ORIGINAL-SOURCE-PIN");
  const reviewerPin = format(reviewer, "INDEPENDENT-REVIEWER");
  const source = {
    sourceId: "icamp",
    sourceRevision,
    originalSignerFingerprintSha256:
      originalPin.independentlyAuthenticatedSpkiFingerprint,
    reviewerKeyId: reviewerPin.keyId,
    observedAt: date,
    nonce: "INDEPENDENT-SOURCE-CUSTODY-2026-ABCDEF",
    decision: "ORIGINAL_SOURCE_KEY_CUSTODY_OBSERVED",
  };
  const reviewerReceipt = {
    ...source,
    signatureBase64: sign(
      null,
      Buffer.from(custodyAttestationMessage(source)),
      reviewer.privateKey,
    ).toString("base64"),
  };
  return { originalPin, reviewerPin, reviewerReceipt };
}
test("distinct Ed25519 source custody witness verifies without approving source HEALTHY", () => {
  const fixture = signedCustodyFixture();
  const input = {
    ...fixture,
    sourceRevision,
    originalCustodianEnrolled: true,
    asOf: date,
  };
  const ok = inspectOriginalSignerEnrollment(input);
  assert.equal(ok.status, "ORIGINAL_SIGNER_CUSTODY_WITNESSED_SOURCE_ONLY");
  assert.equal(ok.independentReviewerAttested, true);
  assert.equal(ok.operationalSourceHealthy, false);
  assert.equal(ok.ownerProductionAcceptance, "HOLD");
  assert.equal(ok.masterConnected, false);
  assert.equal(
    inspectOriginalSignerEnrollment({
      ...input,
      originalCustodianEnrolled: false,
    }).independentReviewerAttested,
    false,
  );
  assert.equal(
    inspectOriginalSignerEnrollment({
      ...input,
      reviewerPin: input.originalPin,
    }).independentReviewerAttested,
    false,
  );
  assert.equal(
    inspectOriginalSignerEnrollment({
      ...input,
      reviewerReceipt: {
        ...input.reviewerReceipt,
        signatureBase64: "AAAA",
      },
    }).independentReviewerAttested,
    false,
  );
  assert.equal(
    inspectOriginalSignerEnrollment({
      ...input,
      asOf: "2026-11-16T18:00:00.000Z",
    }).independentReviewerAttested,
    false,
  );
});

const devices = [
  ["desktop", "11111111-2222-4333-8444-555555555555"],
  ["tablet", "11111111-2222-4333-8444-666666666666"],
  ["mobile", "11111111-2222-4333-8444-777777777777"],
];
const records = devices.flatMap(([formFactor, deviceId]) =>
  ["standard", "orbit"].map((visual) => ({
    schema: "icamp.theme.manual-acceptance.v1",
    formFactor,
    visual,
    deviceId,
    sourceRevision,
    recordedAt: date,
    checks: {
      heroVisible: true,
      navigationUsable: true,
      textReadable: true,
      noHorizontalOverflow: true,
    },
  })),
);

test("six Meadow/Orbit reports are self-reported only and cannot grant production acceptance", () => {
  const input = { records, sourceRevision, asOf: date };
  const result = assessCrossDeviceThemeAcceptance(input);
  assert.equal(result.manualChecksComplete, true);
  assert.equal(result.completed.length, 6);
  assert.equal(result.independentAcceptance, false);
  assert.equal(result.authorizationGranted, false);
  assert.equal(
    assessCrossDeviceThemeAcceptance({
      ...input,
      records: records.slice(0, 4),
    }).status,
    "HOLD_MISSING_CROSS_DEVICE_THEME_REVIEWS",
  );
  assert.equal(
    assessCrossDeviceThemeAcceptance({
      ...input,
      records: [...records.slice(0, 5), records[0]],
    }).status,
    "HOLD_DUPLICATE_THEME_REPORT",
  );
  assert.equal(
    assessCrossDeviceThemeAcceptance({
      ...input,
      records: [
        { ...records[0], sourceRevision: "b".repeat(40) },
        ...records.slice(1),
      ],
    }).status,
    "HOLD_UNVERIFIED_DEVICE_CHECKLIST",
  );
  assert.equal(
    assessCrossDeviceThemeAcceptance({
      ...input,
      records: [
        { ...records[0], checks: { ...records[0].checks, heroVisible: false } },
        ...records.slice(1),
      ],
    }).status,
    "HOLD_UNVERIFIED_DEVICE_CHECKLIST",
  );
  assert.equal(
    assessCrossDeviceThemeAcceptance({
      ...input,
      records: records.map((r) => ({
        ...r,
        deviceId: devices[0][1],
      })),
    }).status,
    "HOLD_DISTINCT_DEVICE_EVIDENCE_REQUIRED",
  );
});

test("Build 251 runtime audit is Sysop-private and does not expose database or signing material", () => {
  const service = read("lib/release/build251-runtime-postgres.mjs");
  const sysop = read("app/sysop/readiness/page.tsx");
  const report = read("app/settings/themes/cross-device/page.tsx");
  const client = read("components/build251-cross-device-theme-review.tsx");
  const selector = read("components/visual-theme-selector.tsx");
  const shell = read("components/sysop-shell.tsx");
  assert.match(service, /begin read only/u);
  assert.match(service, /ICAMP_EXPECTED_PRODUCTION_DATABASE_HOST/u);
  assert.match(service, /ICAMP_SOURCE_CUSTODY_ATTESTATION_JSON/u);
  assert.doesNotMatch(service, /select \* from public/u);
  assert.match(sysop, /requireSysop\("\/sysop"\)/u);
  assert.match(sysop, /inspectBuild251Runtime/u);
  assert.match(report, /requireAnyCampgroundPermission/u);
  assert.match(client, /icamp.themeAcceptance.manual.v1/u);
  assert.match(client, /window.localStorage.setItem/u);
  assert.match(client, /independent owner acceptance: HOLD/iu);
  assert.match(selector, /defaultTheme/u);
  assert.match(shell, /defaultTheme="orbit"/u);
  assert.match(shell, /data-visual="orbit"/u);
  assert.equal(STANDARD_THEME.style, "Meadow & evergreen");
  assert.ok(
    existsSync(new URL("../public/themes/standard/meadow-hero.webp", import.meta.url)),
  );
});
