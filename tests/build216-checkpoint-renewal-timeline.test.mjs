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
  analyzeBuild216Ci,
  appendRotationCheckpoint,
  buildExpiryTimeline,
  prepareOwnerRenewal,
  signOwnerRenewal,
  verifyOwnerRenewal,
  verifyRotationHistory,
} from "../scripts/build216-checkpoint-renewal-timeline.mjs";
import { readBuild206Inputs } from "../scripts/verify-build206-cache-contract.mjs";
import { verifyBuild216CIContract } from "../scripts/verify-build216-ci-contract.mjs";

const NOW = Date.parse("2026-11-07T12:00:00.000Z");
const DAY = 86_400_000;
const iso = (at) => new Date(at).toISOString();
const digest = (value) =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;
const history = JSON.parse(
  readFileSync(
    resolve(
      import.meta.dirname,
      "../fixtures/build210-reviewed-chromium-history.json",
    ),
    "utf8",
  ),
);

function archive(suffix, expiry = 20) {
  return {
    kind: "VERIFIED_ARCHIVE_COPY",
    sourceIdentity: {
      artifactId: 7 + Number(suffix),
      runId: 700 + Number(suffix),
      jobId: 900 + Number(suffix),
      commit: "a".repeat(40),
    },
    sourceDigest: digest(`original-${suffix}`),
    evidencePacketDigest: digest(`packet-${suffix}`),
    signerKeyId: `custodian-${suffix}`,
    storageReference: `offline://vaults/archive-${suffix}`,
    expiresAt: iso(NOW + expiry * DAY),
    immutableStorageVerified: false,
    independentHumanIdentityEstablishedByScript: false,
  };
}

function ledgerOf(...values) {
  const ledger = [];
  for (const value of values)
    ledger.push(appendRegistrationEntry(ledger, value, { now: NOW }));
  return ledger;
}

function signer() {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const pem = publicKey.export({ type: "spki", format: "pem" });
  return {
    privatePem: privateKey.export({ type: "pkcs8", format: "pem" }),
    publicPem: pem,
    fingerprint: publicKeyFingerprint(pem),
  };
}

function anchored(ledger, identity, time = NOW) {
  const claims = prepareAnchorClaims(ledger, {
    keyId: identity.keyId,
    now: time,
  });
  const attestation = signAnchorClaims({
    ledger,
    claims,
    privateKeyPem: identity.privatePem,
    now: time + 1000,
  });
  return { claims, attestation };
}

test("Build 216 retains five protected checks and reports private state missing in CI", () => {
  const result = verifyBuild216CIContract(readBuild206Inputs(), history);
  assert.equal(result.requiredChecks, 5);
  assert.equal(result.noPrivateOwnerRenewalReceiptInCI, true);
  const diagnostic = analyzeBuild216Ci({ originalArtifactAlerts: 2 });
  assert.equal(diagnostic.publicOriginalArtifactAlerts, 2);
  assert.equal(diagnostic.independentRotationVerifiedInCI, false);
  assert.equal(diagnostic.releaseApprovalGranted, false);
});

test("Build 216 verifies monotonic signed head rotations, historical prefixes and external tail pins", () => {
  const ownerKey = signer();
  const identity = { ...ownerKey, keyId: "independent-reviewer" };
  const pins = {
    schema: "icamp.build215.independent-anchor-pins.v1",
    signers: [
      {
        keyId: identity.keyId,
        enabled: true,
        role: "ICAMP_INDEPENDENT_LEDGER_ANCHOR_REVIEWER",
        publicKeyPem: identity.publicPem,
        fingerprint: identity.fingerprint,
      },
    ],
  };
  const firstLedger = ledgerOf(archive("1"));
  const first = anchored(firstLedger, identity);
  const head1 = appendRotationCheckpoint({
    ledger: firstLedger,
    records: [],
    pins,
    ...first,
    expectedTail: "GENESIS",
    now: NOW + 2000,
  });
  const secondLedger = ledgerOf(archive("1"), archive("2"));
  const stale = verifyRotationHistory({
    ledger: secondLedger,
    records: [head1],
    pins,
    now: NOW + 3000,
  });
  assert.equal(stale.state, "NEW_LEDGER_ENTRIES_NOT_YET_ANCHORED");
  const second = anchored(secondLedger, identity, NOW + 5000);
  const head2 = appendRotationCheckpoint({
    ledger: secondLedger,
    records: [head1],
    pins,
    ...second,
    expectedTail: head1.recordHash,
    now: NOW + 7000,
  });
  const historyReview = verifyRotationHistory({
    ledger: secondLedger,
    records: [head1, head2],
    pins,
    expectedTail: head2.recordHash,
    now: NOW + 8000,
  });
  assert.equal(
    historyReview.state,
    "CURRENT_SIGNED_PREFIX_VERIFIED_STORAGE_UNPROVEN",
  );
  assert.equal(historyReview.externallyPinnedTailMatched, true);
  assert.throws(
    () =>
      verifyRotationHistory({
        ledger: secondLedger,
        records: [head1],
        pins,
        expectedTail: head2.recordHash,
        now: NOW + 8000,
      }),
    /TAIL_MISMATCH/,
  );
  assert.throws(
    () =>
      verifyRotationHistory({
        ledger: secondLedger,
        records: [{ ...head1, previousHash: "tampered" }],
        pins,
        now: NOW + 8000,
      }),
    /INVALID_OR_REORDERED/,
  );
  assert.throws(
    () =>
      appendRotationCheckpoint({
        ledger: secondLedger,
        records: [head1],
        pins,
        ...first,
        expectedTail: head1.recordHash,
        now: NOW + 8000,
      }),
    /ROTATION_REWIND_REFUSED/,
  );
  assert.throws(
    () =>
      appendRotationCheckpoint({
        ledger: secondLedger,
        records: [head1],
        pins,
        ...second,
        expectedTail: "GENESIS",
        now: NOW + 8000,
      }),
    /PREVIOUS_ROTATION_TAIL_REQUIRED/,
  );
  const expired = verifyRotationHistory({
    ledger: secondLedger,
    records: [head1, head2],
    pins,
    now: NOW + 9 * DAY,
  });
  assert.equal(expired.state, "LATEST_SIGNED_ANCHOR_EXPIRED_REVIEW_REQUIRED");
  assert.equal(expired.independentlyDurableStorageVerified, false);
});

test("Build 216 verifies signed owner renewal intent while preventing source mutation, receipt replay and ledger drift", () => {
  const ledger = ledgerOf(archive("1"));
  const key = signer();
  const request = prepareOwnerRenewal(ledger, {
    sequence: 1,
    choice: "REQUEST_EVIDENCE_RENEWAL",
    keyId: "owner-renewal",
    now: NOW,
  });
  const receipt = signOwnerRenewal(request, ledger, key.privatePem, NOW + 2000);
  const pins = {
    schema: "icamp.build216.owner-renewal-pins.v1",
    signers: [
      {
        keyId: "owner-renewal",
        role: "ICAMP_CUSTODY_RENEWAL_OWNER",
        enabled: true,
        publicKeyPem: key.publicPem,
        fingerprint: key.fingerprint,
      },
    ],
  };
  const result = verifyOwnerRenewal(receipt, ledger, pins, { now: NOW + 3000 });
  assert.equal(result.choice, "REQUEST_EVIDENCE_RENEWAL");
  assert.equal(result.physicalSourceRenewed, false);
  const used = new Set();
  verifyOwnerRenewal(receipt, ledger, pins, {
    now: NOW + 3000,
    consumedNonces: used,
  });
  assert.throws(
    () =>
      verifyOwnerRenewal(receipt, ledger, pins, {
        now: NOW + 3000,
        consumedNonces: used,
      }),
    /REPLAYED/,
  );
  assert.throws(
    () =>
      verifyOwnerRenewal(receipt, ledgerOf(archive("1"), archive("2")), pins, {
        now: NOW + 3000,
      }),
    /LEDGER_DRIFT/,
  );
  assert.throws(
    () =>
      verifyOwnerRenewal(
        { ...receipt, signatureBase64: "A".repeat(86) + "==" },
        ledger,
        pins,
        { now: NOW + 3000 },
      ),
    /SIGNATURE/,
  );
  assert.throws(
    () =>
      prepareOwnerRenewal(ledger, {
        sequence: 1,
        choice: "AUTO_RENEW",
        keyId: "owner-renewal",
        now: NOW,
      }),
    /INVALID/,
  );
});

test("Build 216 expiry timeline links source digest, deadlines and private custody without false live verification", () => {
  const ledger = ledgerOf(archive("1", 3));
  const ciEvidence = {
    build211: {
      artifactReview: {
        schema: "icamp.build211.artifact-expiry-renewal.v1",
        sources: [
          {
            artifactId: 8,
            runId: 701,
            jobId: 901,
            pinnedOriginalDigest: digest("original-1"),
            expiresAt: iso(NOW + 4 * DAY),
            status: "ORIGINAL_ARTIFACT_AVAILABLE",
          },
        ],
      },
    },
  };
  const timeline = buildExpiryTimeline({ ledger, ciEvidence, now: NOW });
  assert.equal(timeline.historicalSourceSnapshotAvailable, true);
  assert.equal(timeline.liveOriginalSourceRecheckedByTool, false);
  assert.equal(timeline.events.length, 2);
  assert.equal(
    timeline.events.find((item) => item.kind === "VERIFIED_ARCHIVE_COPY")
      .sourceMatch,
    true,
  );
  assert.equal(timeline.ownerActionCount, 2);
  const conflicted = structuredClone(ciEvidence);
  conflicted.build211.artifactReview.sources[0].pinnedOriginalDigest =
    digest("changed");
  const quarantine = buildExpiryTimeline({
    ledger,
    ciEvidence: conflicted,
    now: NOW,
  });
  assert.equal(
    quarantine.events.find((item) => item.kind === "VERIFIED_ARCHIVE_COPY")
      .state,
    "SOURCE_IDENTITY_CONFLICT_QUARANTINED",
  );
  assert.equal(quarantine.releaseApprovalGranted, false);
  assert.equal(
    buildExpiryTimeline({ ledger, ciEvidence: null, now: NOW }).state,
    "ORIGINAL_SOURCE_SNAPSHOT_UNAVAILABLE_HOLD",
  );
});
