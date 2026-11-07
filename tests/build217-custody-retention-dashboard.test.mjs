import assert from "node:assert/strict";
import { createHash, generateKeyPairSync } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import { appendRegistrationEntry } from "../scripts/build214-owner-custody-register.mjs";
import {
  prepareAnchorClaims,
  signAnchorClaims,
} from "../scripts/build215-independent-anchor-triage.mjs";
import { publicKeyFingerprint } from "../scripts/build212-owner-sla-receipt.mjs";
import {
  appendRotationCheckpoint,
  prepareOwnerRenewal,
  signOwnerRenewal,
} from "../scripts/build216-checkpoint-renewal-timeline.mjs";
import {
  analyzeAnchorDiversity,
  analyzeBuild217Ci,
  reconcileOwnerRenewalOutcomes,
  renderOfflineDashboard,
  summarizeRetentionDashboard,
} from "../scripts/build217-custody-retention-dashboard.mjs";
import { readBuild206Inputs } from "../scripts/verify-build206-cache-contract.mjs";
import { verifyBuild217CIContract } from "../scripts/verify-build217-ci-contract.mjs";

const NOW = Date.parse("2026-11-07T12:00:00.000Z");
const DAY = 86_400_000;
const iso = (at) => new Date(at).toISOString();
const digest = (value) =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;
const reviewedHistory = JSON.parse(
  readFileSync(
    resolve(
      import.meta.dirname,
      "../fixtures/build210-reviewed-chromium-history.json",
    ),
    "utf8",
  ),
);

function signer(id) {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const publicPem = publicKey.export({ type: "spki", format: "pem" });
  return {
    id,
    privatePem: privateKey.export({ type: "pkcs8", format: "pem" }),
    publicPem,
    fingerprint: publicKeyFingerprint(publicPem),
  };
}

function entry({ keyId, storage, packet, days = 20 }) {
  return {
    kind: "VERIFIED_ARCHIVE_COPY",
    sourceIdentity: {
      artifactId: 71,
      runId: 7001,
      jobId: 9001,
      commit: "a".repeat(40),
    },
    sourceDigest: digest("original-artifact-71"),
    evidencePacketDigest: digest(packet),
    signerKeyId: keyId,
    storageReference: storage,
    expiresAt: iso(NOW + days * DAY),
    immutableStorageVerified: false,
    independentHumanIdentityEstablishedByScript: false,
  };
}

function ledgerOf(...items) {
  const ledger = [];
  for (const item of items)
    ledger.push(appendRegistrationEntry(ledger, item, { now: NOW }));
  return ledger;
}

const archiveLedger = () =>
  ledgerOf(
    entry({
      keyId: "custodian-alpha",
      storage: "offline://vaults/alpha",
      packet: "alpha",
      days: 3,
    }),
    entry({
      keyId: "custodian-beta",
      storage: "offline://vaults/beta",
      packet: "beta",
      days: 12,
    }),
  );

function anchorFixture(ledger, sharedReviewerKey = false) {
  const reviewerA = signer("reviewer-alpha");
  const reviewerB = sharedReviewerKey
    ? { ...reviewerA, id: "reviewer-beta" }
    : signer("reviewer-beta");
  const pins = {
    schema: "icamp.build215.independent-anchor-pins.v1",
    signers: [reviewerA, reviewerB].map((reviewer) => ({
      keyId: reviewer.id,
      enabled: true,
      role: "ICAMP_INDEPENDENT_LEDGER_ANCHOR_REVIEWER",
      publicKeyPem: reviewer.publicPem,
      fingerprint: reviewer.fingerprint,
    })),
  };
  const records = [];
  for (const [index, signerKey] of [reviewerA, reviewerB].entries()) {
    const at = NOW + index * 5000;
    const claims = prepareAnchorClaims(ledger, {
      keyId: signerKey.id,
      now: at,
    });
    const attestation = signAnchorClaims({
      ledger,
      claims,
      privateKeyPem: signerKey.privatePem,
      now: at + 1000,
    });
    records.push(
      appendRotationCheckpoint({
        ledger,
        records: [...records],
        claims,
        attestation,
        pins,
        expectedTail: records.at(-1)?.recordHash ?? "GENESIS",
        now: at + 2000,
      }),
    );
  }
  return { records, pins, expectedTail: records.at(-1).recordHash };
}

function receiptFixture(ledger, choices = ["DEFER_RENEWAL_REVIEW"]) {
  const owners = choices.map((_, index) => signer(`renewal-owner-${index}`));
  const pins = {
    schema: "icamp.build216.owner-renewal-pins.v1",
    signers: owners.map((owner) => ({
      keyId: owner.id,
      role: "ICAMP_CUSTODY_RENEWAL_OWNER",
      enabled: true,
      publicKeyPem: owner.publicPem,
      fingerprint: owner.fingerprint,
    })),
  };
  const receipts = owners.map((owner, index) => {
    const request = prepareOwnerRenewal(ledger, {
      sequence: 1,
      choice: choices[index],
      keyId: owner.id,
      now: NOW + index * 1000,
    });
    return signOwnerRenewal(
      request,
      ledger,
      owner.privatePem,
      NOW + index * 1000 + 1,
    );
  });
  return { receipts, pins };
}

test("Build 217 preserves five protected release checks and keeps all private custody proof out of CI", () => {
  const result = verifyBuild217CIContract(
    readBuild206Inputs(),
    reviewedHistory,
  );
  assert.equal(result.requiredChecks, 5);
  assert.equal(result.additionalWorkflows, 0);
  assert.equal(result.noPrivateDataInCI, true);
  assert.equal(analyzeBuild217Ci(null).fakeOwnerDecisionsGenerated, false);
  const page = readFileSync(
    resolve(
      import.meta.dirname,
      "../app/workspaces/it-analysis/custody-retention/page.tsx",
    ),
    "utf8",
  );
  assert.match(page, /requireAnyCampgroundPermission/);
  assert.match(page, /not uploaded to iCamp/);
});

test("Build 217 verifies two signed current head keys and catches false signer diversity and pinned tail tampering", () => {
  const ledger = archiveLedger();
  const { records, pins, expectedTail } = anchorFixture(ledger);
  const review = analyzeAnchorDiversity({
    ledger,
    rotations: records,
    pins,
    expectedTail,
    now: NOW + 20_000,
  });
  assert.equal(review.distinctCurrentReviewerPublicKeys, 2);
  assert.equal(
    review.state,
    "DISTINCT_REVIEWER_KEYS_HUMAN_INDEPENDENCE_UNPROVEN",
  );
  assert.equal(review.independentlyAuthenticatedHumansVerified, false);
  const reused = anchorFixture(ledger, true);
  const bad = analyzeAnchorDiversity({
    ledger,
    rotations: reused.records,
    pins: reused.pins,
    expectedTail: reused.expectedTail,
    now: NOW + 20_000,
  });
  assert.equal(bad.state, "CROSS_CUSTODIAN_REVIEWER_KEY_REUSE_CONFLICT");
  assert.throws(
    () =>
      analyzeAnchorDiversity({
        ledger,
        rotations: records,
        pins,
        expectedTail: "sha256:" + "0".repeat(64),
        now: NOW + 20_000,
      }),
    /TAIL_MISMATCH/,
  );
  assert.throws(
    () =>
      analyzeAnchorDiversity({
        ledger,
        rotations: records,
        pins: { ...pins, signers: [] },
        expectedTail,
        now: NOW + 20_000,
      }),
    /PIN_MISSING/,
  );
});

test("Build 217 reconciles real owner choice receipts, quarantines contradictions and refuses replay", () => {
  const ledger = archiveLedger();
  const { receipts, pins } = receiptFixture(ledger, [
    "REQUEST_EVIDENCE_RENEWAL",
    "REJECT_RENEWAL",
  ]);
  const conflicting = reconcileOwnerRenewalOutcomes({
    ledger,
    receipts,
    pins,
    now: NOW + 10_000,
  });
  assert.equal(conflicting.state, "OWNER_DECISION_CONFLICTS_QUARANTINED");
  assert.equal(conflicting.conflictingTargets, 1);
  assert.equal(conflicting.actualSourceRetentionRenewed, false);
  assert.throws(
    () =>
      reconcileOwnerRenewalOutcomes({
        ledger,
        receipts: [receipts[0], receipts[0]],
        pins,
        now: NOW + 10_000,
      }),
    /REPLAYED_OWNER_RENEWAL_NONCE/,
  );
  const historical = reconcileOwnerRenewalOutcomes({
    ledger,
    receipts: [receipts[0]],
    pins,
    now: NOW + 9 * DAY,
  });
  assert.equal(
    historical.outcomes[0].state,
    "ALL_SIGNED_OWNER_CHOICES_EXPIRED_REVIEW",
  );
  assert.throws(
    () =>
      reconcileOwnerRenewalOutcomes({
        ledger,
        receipts: [receipts[0]],
        pins: { ...pins, signers: [] },
        now: NOW + 10_000,
      }),
    /PIN_MISSING/,
  );
});

test("Build 217 renders only redacted offline SLA counts, due windows and explicit external holds", () => {
  const ledger = archiveLedger();
  const { records, pins, expectedTail } = anchorFixture(ledger);
  const owners = receiptFixture(ledger);
  const ciEvidence = {
    build211: {
      artifactReview: {
        schema: "icamp.build211.artifact-expiry-renewal.v1",
        sources: [
          {
            artifactId: 71,
            runId: 7001,
            jobId: 9001,
            pinnedOriginalDigest: digest("original-artifact-71"),
            expiresAt: iso(NOW + 6 * DAY),
            status: "ORIGINAL_ARTIFACT_AVAILABLE",
          },
        ],
      },
    },
  };
  const report = summarizeRetentionDashboard({
    ledger,
    rotations: records,
    anchorPins: pins,
    expectedTail,
    ownerReceipts: owners.receipts,
    ownerPins: owners.pins,
    ciEvidence,
    now: NOW + 20_000,
  });
  assert.equal(report.counts.due7Days, 4);
  assert.equal(report.counts.due14Days, 1);
  assert.equal(report.counts.distinctReviewerKeys, 2);
  assert.equal(report.includesPrivateSignedReceipts, false);
  assert.equal(report.externalHumanAndStorageTrustProven, false);
  const html = renderOfflineDashboard(report);
  assert.match(html, /Evidence retention SLA/);
  assert.match(html, /content="default-src 'none'/);
  assert.doesNotMatch(
    html,
    /original-artifact-71|offline:\/\/vaults|BEGIN PRIVATE KEY|signatureBase64/,
  );
  assert.doesNotMatch(html, /sha256:[a-f0-9]{64}/);
  assert.throws(
    () =>
      renderOfflineDashboard({
        ...report,
        includesPrivateSignedReceipts: true,
      }),
    /UNSAFE_OR_UNVERIFIED/,
  );
  const unknown = summarizeRetentionDashboard({
    ledger: [],
    rotations: [],
    anchorPins: { signers: [] },
    expectedTail: "GENESIS",
    ownerReceipts: [],
    ownerPins: { signers: [] },
    ciEvidence: null,
    now: NOW,
  });
  assert.equal(unknown.state, "OWNER_REVIEW_OR_EXTERNAL_EVIDENCE_HOLD");
});
