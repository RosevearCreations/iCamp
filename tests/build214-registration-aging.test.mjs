import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  analyzeBuild214Aging,
  appendRegistrationEntry,
  makeArchiveRegistration,
  makeOwnerRegistration,
  verifyRegistrationLedger,
} from "../scripts/build214-owner-custody-register.mjs";
import { verifyIndependentArchiveCustody } from "../scripts/build213-cohort-custody-reconciliation.mjs";
import {
  canonicalJson,
  publicKeyFingerprint,
} from "../scripts/build212-owner-sla-receipt.mjs";
import { readBuild206Inputs } from "../scripts/verify-build206-cache-contract.mjs";
import { verifyBuild214CIContract } from "../scripts/verify-build214-ci-contract.mjs";

const history = JSON.parse(
  readFileSync(
    resolve(
      import.meta.dirname,
      "../fixtures/build210-reviewed-chromium-history.json",
    ),
    "utf8",
  ),
);
const NOW = Date.parse("2026-11-07T12:00:00.000Z");
const iso = (timestamp) => new Date(timestamp).toISOString();
const sha = (bytes) =>
  `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

function syntheticVerifiedArchive() {
  const archive = Buffer.from("synthetic only: no real custody claim");
  const digest = sha(archive);
  const reviewedHistory = structuredClone(history);
  reviewedHistory.observations[0].artifactDigest = digest;
  const source = reviewedHistory.observations[0];
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const publicKeyPem = publicKey.export({ type: "spki", format: "pem" });
  const claims = {
    schema: "icamp.build213.archive-custody-claims.v1",
    repository: "RosevearCreations/iCamp",
    sourceArtifactId: source.artifactId,
    sourceRunId: source.runId,
    sourceJobId: source.jobId,
    sourceHeadSha: source.headSha,
    sourceDigest: digest,
    copiedArchiveDigest: digest,
    storageReference: "offline://test-only/not-independent",
    custodianKeyId: "test-custodian",
    signedAt: iso(NOW),
    expiresAt: iso(NOW + 15 * 86_400_000),
  };
  const attestation = {
    signatureBase64: sign(
      null,
      Buffer.from(
        canonicalJson({
          schema: "icamp.build213.archive-custody-attestation.v1",
          claims,
        }),
      ),
      privateKey,
    ).toString("base64"),
  };
  const verification = verifyIndependentArchiveCustody({
    archive,
    claims,
    signatureBase64: attestation.signatureBase64,
    history: reviewedHistory,
    now: NOW + 1000,
    custodianPins: {
      schema: "icamp.build213.archive-custodian-pins.v1",
      signers: [
        {
          keyId: claims.custodianKeyId,
          role: "ICAMP_CI_ARCHIVE_CUSTODIAN",
          enabled: true,
          publicKeyPem,
          fingerprint: publicKeyFingerprint(publicKeyPem),
        },
      ],
    },
  });
  return { claims, attestation, verification };
}

test("Build 214 preserves five protected checks and never imports private registry evidence into CI", () => {
  const contract = verifyBuild214CIContract(readBuild206Inputs(), history);
  assert.equal(contract.protectedRequiredChecks, 5);
  assert.equal(contract.noAutomaticOwnerSlaAcceptance, true);
  assert.equal(
    analyzeBuild214Aging(null).state,
    "ORIGINAL_ARTIFACT_SOURCE_UNAVAILABLE_REVIEW_REQUIRED",
  );
});

test("Build 214 warns on original expiry and conflicts without asserting independent copy renewal", () => {
  const report = analyzeBuild214Aging(
    {
      schema: "icamp.build211.artifact-expiry-renewal.v1",
      sources: [
        { artifactId: 1, runId: 2, status: "ORIGINAL_ARTIFACT_AVAILABLE" },
        {
          artifactId: 3,
          runId: 4,
          status: "EXPIRING_RENEWAL_REVIEW_REQUIRED",
          daysRemaining: 3,
          expiresAt: iso(NOW + 3 * 86_400_000),
        },
        { artifactId: 5, runId: 6, status: "DIGEST_CONFLICT_QUARANTINED" },
      ],
    },
    NOW,
  );
  assert.equal(report.alerts.length, 2);
  assert.equal(report.state, "SOURCE_AGING_OR_CONFLICT_OWNER_REVIEW_REQUIRED");
  assert.equal(report.independentlyRetainedOriginalsVerifiedInCI, 0);
  assert.equal(report.automatedApproval, false);
  assert.equal(report.commsTestAuthorized, false);
});

test("Build 214 only registers verified matching source bytes and detects modified chain and externally pinned truncation", () => {
  const packet = syntheticVerifiedArchive();
  const registration = makeArchiveRegistration(packet);
  assert.equal(registration.immutableStorageVerified, false);
  assert.throws(
    () =>
      makeArchiveRegistration({
        ...packet,
        verification: {
          ...packet.verification,
          copiedArchiveDigest: sha("different"),
        },
      }),
    /UNVERIFIED/,
  );
  const first = appendRegistrationEntry([], registration, { now: NOW + 2000 });
  const valid = verifyRegistrationLedger([first], { now: NOW + 3000 });
  assert.equal(
    valid.entries[0].state,
    "SIGNED_EVIDENCE_CURRENT_NOT_PERMANENT_CUSTODY",
  );
  assert.equal(valid.productionApprovalGranted, false);
  assert.throws(
    () => appendRegistrationEntry([first], registration, { now: NOW + 3000 }),
    /DUPLICATE/,
  );
  assert.throws(
    () =>
      verifyRegistrationLedger([{ ...first, sourceDigest: sha("altered") }]),
    /HASH_CHAIN_MISMATCH/,
  );
  assert.throws(
    () => verifyRegistrationLedger([], { expectedHead: first.entryHash }),
    /HEAD_MISMATCH/,
  );
  const aging = verifyRegistrationLedger([first], {
    now: NOW + 3 * 86_400_000,
  });
  assert.equal(
    aging.entries[0].state,
    "REGISTRATION_RENEWAL_DUE_WITHIN_14_DAYS",
  );
  const expired = verifyRegistrationLedger([first], {
    now: NOW + 17 * 86_400_000,
  });
  assert.equal(
    expired.entries[0].state,
    "REGISTRATION_ATTESTATION_EXPIRED_REVIEW_REQUIRED",
  );
});

test("Build 214 registers only a previously reconciled signed SLA decision; never grants release authority", () => {
  const receipt = {
    request: {
      commit: "a".repeat(40),
      nonce: "00000000-0000-4000-8000-000000000001",
      evidenceDigest: sha("reviewed evidence"),
      keyId: "owner-test-only",
      decision: "DEFER_MONITORING_SLA",
      expiresAt: iso(NOW + 4 * 86_400_000),
    },
  };
  const verification = {
    schema: "icamp.build213.reconciled-sla-receipt.v1",
    signedReceipt: {
      ownerSignatureCryptographicallyVerified: true,
      evidenceDigest: receipt.request.evidenceDigest,
    },
  };
  assert.throws(
    () =>
      makeOwnerRegistration({
        receipt,
        verification: {
          ...verification,
          signedReceipt: { ownerSignatureCryptographicallyVerified: false },
        },
      }),
    /UNVERIFIED/,
  );
  const registration = makeOwnerRegistration({ receipt, verification });
  const ledger = [appendRegistrationEntry([], registration, { now: NOW })];
  assert.equal(
    verifyRegistrationLedger(ledger).productionApprovalGranted,
    false,
  );
  assert.equal(registration.commsTestAuthorized, false);
});
