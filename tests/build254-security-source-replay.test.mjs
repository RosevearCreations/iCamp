import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import test from "node:test";

import {
  DECISIONS,
  MASTER_PLANES,
  SECURITY_TIERS,
  assessTieredSecurity,
  evaluateThreeMasterFreshness,
  prepareSignedReceiptClaim,
  sha256,
  validateRemediationDecision,
} from "../lib/release/build254-security-core.mjs";
import { STANDARD_THEME } from "../lib/theme/standard.mjs";

const source = (path) =>
  readFileSync(new URL("../" + path, import.meta.url), "utf8");
const revision = "a".repeat(40);
const now = "2026-11-14T23:35:00.000Z";
const receiptTime = "2026-11-14T23:33:00.000Z";
const receipts = MASTER_PLANES.map((plane) => ({
  plane,
  sourceRevision: revision,
  issuedAt: receiptTime,
}));
const evidence = {
  sourceRevision: revision,
  evidence: MASTER_PLANES.map((plane) => ({
    plane,
    status: "SIGNED_RECEIPT_OBSERVED_NOT_OWNER_ACCEPTED",
  })),
};
const valid = {
  sourceRevision: revision,
  receiptType: "database_provenance",
  masterPlane: null,
  nonce: "real-original-nonce-not-a-test-production-key",
  receiptDigestSha256: "b".repeat(64),
  signerFingerprintSha256: "c".repeat(64),
  issuedAt: receiptTime,
  cryptographicallyVerified: true,
  asOf: now,
};

test("Three independently verified signed Masters are source-only, never CONNECTED", () => {
  const r = evaluateThreeMasterFreshness({
    sourceRevision: revision,
    evidence,
    receipts,
    asOf: now,
  });
  assert.deepEqual(
    r.results.map((x) => x.plane),
    MASTER_PLANES,
  );
  assert.equal(r.allCurrent, true);
  assert.equal(r.allThreeReceiversConnected, false);
  assert.equal(r.ownerProductionAcceptance, "HOLD");
  assert.equal(
    r.results.every((x) => x.status === "SIGNED_SOURCE_FRESH_OBSERVED"),
    true,
  );
});

test("Forged, unsigned, stale, missing, duplicate or wrong revision Masters fail closed", () => {
  const base = { sourceRevision: revision, evidence, receipts, asOf: now };
  assert.equal(
    evaluateThreeMasterFreshness({ ...base, evidence: null }).allCurrent,
    false,
  );
  assert.equal(
    evaluateThreeMasterFreshness({
      ...base,
      evidence: {
        ...evidence,
        evidence: evidence.evidence.map((r, i) =>
          i === 1 ? { ...r, status: "HOLD_INVALID_MASTER_SIGNATURE" } : r,
        ),
      },
    }).allCurrent,
    false,
  );
  assert.equal(
    evaluateThreeMasterFreshness({
      ...base,
      receipts: receipts.slice(0, 2),
    }).allCurrent,
    false,
  );
  assert.equal(
    evaluateThreeMasterFreshness({
      ...base,
      receipts: [...receipts, receipts[0]],
    }).allCurrent,
    false,
  );
  assert.equal(
    evaluateThreeMasterFreshness({
      ...base,
      receipts: receipts.map((r) => ({
        ...r,
        issuedAt: "2026-11-14T23:00:00.000Z",
      })),
    }).allCurrent,
    false,
  );
  assert.equal(
    evaluateThreeMasterFreshness({
      ...base,
      sourceRevision: "b".repeat(40),
    }).allCurrent,
    false,
  );
});

test("Master expiry requires renewal before signed authority ages out", () => {
  const result = evaluateThreeMasterFreshness({
    sourceRevision: revision,
    evidence,
    receipts: receipts.map((r) => ({
      ...r,
      issuedAt: "2026-11-14T23:24:00.000Z",
    })),
    asOf: now,
  });
  assert.equal(result.allCurrent, true);
  assert.equal(result.needsRenewal, true);
  assert.equal(result.results[0].status, "SIGNED_SOURCE_RENEWAL_DUE");
  assert.equal(result.allThreeReceiversConnected, false);
});

test("Signed original admission creates source-only digest, never owner authority", () => {
  const claim = prepareSignedReceiptClaim(valid);
  assert.equal(claim.nonceDigestSha256, sha256(valid.nonce));
  assert.notEqual(claim.nonceDigestSha256, valid.nonce);
  assert.equal(claim.decision, "signed_source_observed_hold");
  assert.equal(claim.masterConnected, false);
  assert.equal(claim.ownerAcceptance, "HOLD");
  assert.throws(() =>
    prepareSignedReceiptClaim({ ...valid, cryptographicallyVerified: false }),
  );
  assert.throws(() =>
    prepareSignedReceiptClaim({ ...valid, masterPlane: "ai-data-platform" }),
  );
  assert.throws(() =>
    prepareSignedReceiptClaim({
      ...valid,
      receiptType: "master_source",
      masterPlane: "unknown-master",
    }),
  );
  assert.throws(() =>
    prepareSignedReceiptClaim({
      ...valid,
      issuedAt: "2026-11-12T23:35:00.000Z",
    }),
  );
});

test("Independent remediation is restricted to hold/request/reject", () => {
  const id = "11111111-2222-4333-8444-555555555555";
  const ok = validateRemediationDecision({
    claimId: id,
    decision: "request_fresh_originals",
    explanation: "Revalidate source identity before proceeding.",
  });
  assert.equal(ok.decision, "request_fresh_originals");
  assert.equal(DECISIONS.includes("accept"), false);
  assert.throws(() =>
    validateRemediationDecision({
      ...ok,
      decision: "connected",
    }),
  );
  assert.throws(() =>
    validateRemediationDecision({
      ...ok,
      explanation: "short",
    }),
  );
});

test("Cross-app six-tier governance never makes runtime CONNECTED", () => {
  const summary = assessTieredSecurity({
    sourceChecksumsMatch: true,
    independentlySignedDatabase: true,
    masterFreshness: { allCurrent: true },
    tenantAuthenticated: true,
    independentDisposition: true,
    runtimeConnected: true,
  });
  assert.deepEqual(
    summary.tiers.map((x) => x.tier),
    SECURITY_TIERS,
  );
  assert.equal(summary.threeMasterEvidenceCurrent, true);
  assert.equal(summary.externalRuntimeConnected, false);
  assert.equal(summary.ownerProductionAcceptance, "HOLD");
});

test("Migration 0234 guarantees unique original nonce, private RLS and independent reviewer", () => {
  const sql = source(
    "database/migrations/0234_build254_receipt_replay_remediation.sql",
  );
  const verify = source(
    "database/verify/0234_build254_receipt_replay_remediation.sql",
  );
  assert.match(sql, /unique \(nonce_digest_sha256\)/u);
  assert.match(sql, /unique \(receipt_digest_sha256\)/u);
  assert.match(sql, /unique \(source_receipt_claim_id\)/u);
  assert.match(sql, /prior.claimed_by_user_id = new.reviewed_by_user_id/u);
  assert.match(sql, /current_setting\('icamp.source_revision',true\)/u);
  assert.match(sql, /force row level security/iu);
  assert.match(sql, /grant select,insert/u);
  assert.doesNotMatch(sql, /grant (?:update|delete) on/iu);
  assert.match(verify, /Build254 nonce and receipt replay indexes missing/u);
});

test("Private actions verify original signatures and enforce MFA + scoped tenant", () => {
  const server = source("lib/release/build254-security-postgres.mjs");
  const actions = source(
    "app/workspaces/management/campgrounds/independent-review/actions.ts",
  );
  const page = source(
    "app/workspaces/management/campgrounds/independent-review/page.tsx",
  );
  const sysop = source("app/sysop/security-governance/page.tsx");
  assert.match(server, /readCrossMasterProtectedEvidence/u);
  assert.match(server, /inspectBuild253SupervisedReview/u);
  assert.match(server, /set local role icamp_app/u);
  assert.match(server, /appendAuditEvent/u);
  assert.match(server, /nonceDigestSha256/u);
  assert.match(server, /protectedJSON\("ICAMP_DB_PROVENANCE_RECEIPT_JSON"\)/u);
  assert.match(server, /originalSourceEnrolled|independentDatabaseProvenance/u);
  assert.match(actions, /assuranceLevel !== "aal2"/u);
  assert.match(page, /owner_admin/u);
  assert.match(page, /staff.manage/u);
  assert.match(sysop, /requireSysop\("\/sysop"\)/u);
  assert.match(sysop, /Master CONNECTED: HOLD/u);
});

test("Standard Meadow and signed seven-app handoff retain original boundary", () => {
  assert.equal(STANDARD_THEME.style, "Meadow & evergreen");
  assert.ok(
    existsSync(
      new URL("../public/themes/standard/meadow-hero.webp", import.meta.url),
    ),
  );
  const handoff = source("docs/integration/BUILD254_SEVEN_APP_HANDOFF.md");
  const terms = [
    "ai-data-platform",
    "rosevear-ai-hub",
    "rosevear-comms-hub",
    "iCamp",
    "YW",
    "devilndove",
    "rosiedazzlers",
  ];
  let index = -1;
  for (const app of terms) {
    const at = handoff.indexOf("**" + app + "**");
    assert.ok(at > index);
    index = at;
  }
  assert.match(handoff, /runtime CONNECTED remains HOLD/u);
});
