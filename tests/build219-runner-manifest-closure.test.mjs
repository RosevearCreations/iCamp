import assert from "node:assert/strict";
import { createHash, generateKeyPairSync } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { appendRegistrationEntry } from "../scripts/build214-owner-custody-register.mjs";
import {
  prepareOwnerRenewal,
  signOwnerRenewal,
} from "../scripts/build216-checkpoint-renewal-timeline.mjs";
import {
  canonicalJson,
  publicKeyFingerprint,
} from "../scripts/build212-owner-sla-receipt.mjs";
import {
  createSourceRecheckSchedule,
  prepareExceptionAcknowledgement,
  signExceptionAcknowledgement,
} from "../scripts/build218-source-recheck-portability.mjs";
import {
  analyzeBuild219Ci,
  prepareRunnerAttestation,
  signRunnerAttestation,
  verifyRunnerAttestation,
  preparePortabilityManifest,
  signPortabilityManifest,
  verifyPortabilityManifest,
  reviewRetentionExceptionClosure,
} from "../scripts/build219-runner-manifest-closure.mjs";
import { readBuild206Inputs } from "../scripts/verify-build206-cache-contract.mjs";
import { verifyBuild219CIContract } from "../scripts/verify-build219-ci-contract.mjs";

const NOW = Date.parse("2026-11-07T12:00:00.000Z");
const DAY = 86_400_000;
const iso = (ms) => new Date(ms).toISOString();
const digest = (s) => `sha256:${createHash("sha256").update(s).digest("hex")}`;
const reviewedHistory = JSON.parse(
  readFileSync(
    resolve(
      import.meta.dirname,
      "../fixtures/build210-reviewed-chromium-history.json",
    ),
    "utf8",
  ),
);
function signer(keyId, role, schema) {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const publicKeyPem = publicKey.export({ type: "spki", format: "pem" });
  return {
    keyId,
    privatePem: privateKey.export({ type: "pkcs8", format: "pem" }),
    pins: {
      schema,
      signers: [
        {
          keyId,
          role,
          enabled: true,
          publicKeyPem,
          fingerprint: publicKeyFingerprint(publicKeyPem),
        },
      ],
    },
  };
}
function fixture() {
  const ledger = [];
  ledger.push(
    appendRegistrationEntry(
      ledger,
      {
        kind: "VERIFIED_ARCHIVE_COPY",
        sourceIdentity: {
          artifactId: 12345,
          runId: 6401,
          jobId: 7401,
          commit: "a".repeat(40),
        },
        sourceDigest: digest("original-12345"),
        evidencePacketDigest: digest("custodian-packet"),
        signerKeyId: "custodian-alpha",
        storageReference: "offline://independent-vault",
        expiresAt: iso(NOW + 5 * DAY),
        immutableStorageVerified: false,
        independentHumanIdentityEstablishedByScript: false,
      },
      { now: NOW },
    ),
  );
  const owner = signer(
    "owner-identity",
    "ICAMP_CUSTODY_RENEWAL_OWNER",
    "icamp.build216.owner-renewal-pins.v1",
  );
  const runner = signer(
    "runner-identity",
    "ICAMP_INDEPENDENT_READONLY_RUNNER",
    "icamp.build219.independent-runner-pins.v1",
  );
  const custodian = signer(
    "portable-custodian",
    "ICAMP_INDEPENDENT_PORTABILITY_CUSTODIAN",
    "icamp.build219.independent-portability-pins.v1",
  );
  const ownerRequest = prepareOwnerRenewal(ledger, {
    sequence: 1,
    keyId: owner.keyId,
    choice: "REQUEST_EVIDENCE_RENEWAL",
    now: NOW,
  });
  const ownerReceipt = signOwnerRenewal(
    ownerRequest,
    ledger,
    owner.privatePem,
    NOW + 1000,
  );
  const schedule = createSourceRecheckSchedule({
    ledger,
    ciEvidence: {
      build211: {
        artifactReview: {
          schema: "icamp.build211.artifact-expiry-renewal.v1",
          sources: [
            {
              artifactId: 12345,
              runId: 6401,
              jobId: 7401,
              pinnedOriginalDigest: digest("original-12345"),
              expiresAt: iso(NOW + 2 * DAY),
            },
          ],
        },
      },
    },
    ownerReceipts: [ownerReceipt],
    ownerPins: owner.pins,
    now: NOW + 2000,
  });
  const observation = {
    schema: "icamp.build218.original-source-recheck.v1",
    taskKey: schedule.tasks[0].taskKey,
    artifactId: 12345,
    runId: 6401,
    jobId: 7401,
    observedAt: iso(NOW + 2000),
    state: "GITHUB_METADATA_MATCHED_ARCHIVE_BYTES_NOT_VERIFIED",
    metadataExpiresAt: iso(NOW + 2 * DAY),
    originalDigestMatchedMetadata: true,
    githubRunAndCommitMatched: true,
    originalArtifactBytesDownloaded: false,
    originalJobAssociationIndependentlyVerified: false,
    durableArchiveStorageVerified: false,
    originalRetentionRenewed: false,
    ownerProductionApprovalGranted: false,
    commsTestAuthorized: false,
  };
  const payload = {
    schema: "icamp.build218.cross-custodian-redacted-portability.v1",
    repository: "RosevearCreations/iCamp",
    scope: "PLATFORM_RELEASE_CUSTODY_ONLY_NO_CAMPGROUND_TENANT_DATA",
    createdAt: iso(NOW + 2000),
    dashboard: {
      state: "OWNER_REVIEW_REQUIRED",
      counts: {
        overdue: 0,
        due7Days: 0,
        due14Days: 0,
        later: 0,
        unknown: 0,
        sourceConflicts: 0,
        ownerChoiceConflicts: 0,
        distinctReviewerKeys: 0,
        signedOwnerChoices: 1,
      },
      anchorState: "INDEPENDENT_REVIEW_HOLD",
      ownerDecisionState: "SIGNED_OWNER_CHOICE_REVIEW_ONLY",
      sourceState: "ORIGINAL_SOURCE_REVIEW_HOLD",
    },
    recheckSchedule: {
      state: schedule.state,
      dueCount: schedule.dueCount,
      ownerAuthorizedCount: schedule.ownerAuthorizedCount,
      unattendedNetworkExecution: false,
    },
    sourceRechecks: [
      {
        artifactId: 12345,
        reportedObservationStateUntrustedWithoutOriginalReadback:
          observation.state,
        observedAt: observation.observedAt,
        archiveBytesVerified: false,
      },
    ],
    sourceObservationProvenance:
      "REDACTED_LOCAL_RECEIPTS_NOT_INDEPENDENT_PROVIDER_ATTESTATION",
    ownerExceptionAcknowledgements: [],
    privateEvidenceIncluded: false,
    originalDigestsOrStorageLocationsIncluded: false,
    campgroundTenantDataIncluded: false,
    externallyDurableArchiveVerified: false,
    automaticSlaWaiverOrRenewal: false,
    productionApprovalGranted: false,
    commsTestAuthorized: false,
  };
  const report = { ...payload, exportDigest: digest(canonicalJson(payload)) };
  const ackRequest = prepareExceptionAcknowledgement(ledger, {
    sequence: 1,
    exceptionCode: "SLA_RECHECK_OVERDUE",
    keyId: owner.keyId,
    now: NOW,
  });
  const exceptionReceipt = signExceptionAcknowledgement(
    ledger,
    ackRequest,
    owner.privatePem,
    NOW + 1000,
  );
  const now = NOW + 3000;
  return {
    ledger,
    owner,
    runner,
    custodian,
    schedule,
    observation,
    report,
    exceptionReceipt,
    now,
  };
}

test("Build 219 preserves five protected checks and imports no private authority", () => {
  const status = verifyBuild219CIContract(
    readBuild206Inputs(),
    reviewedHistory,
  );
  assert.equal(status.requiredChecks, 5);
  assert.equal(status.newWorkflowsOrCronSchedules, 0);
  assert.equal(analyzeBuild219Ci(null).externalSourceReadsInCi, false);
});

test("Build 219 pinned runner attests only owner-scoped local readback; tampering, replay, missing authority, and expiry fail closed", () => {
  const f = fixture();
  const request = prepareRunnerAttestation(f.schedule, f.observation, {
    keyId: f.runner.keyId,
    now: f.now,
  });
  const receipt = signRunnerAttestation(
    f.schedule,
    f.observation,
    request,
    f.runner.privatePem,
    f.now,
  );
  const used = new Set();
  const checked = verifyRunnerAttestation(
    f.schedule,
    f.observation,
    receipt,
    f.runner.pins,
    { now: f.now, consumedNonces: used },
  );
  assert.equal(checked.signatureAndPinVerified, true);
  assert.equal(checked.originalArchiveBytesVerified, false);
  assert.throws(
    () =>
      verifyRunnerAttestation(
        f.schedule,
        f.observation,
        receipt,
        f.runner.pins,
        { now: f.now, consumedNonces: used },
      ),
    /REPLAYED/,
  );
  assert.throws(
    () =>
      verifyRunnerAttestation(
        f.schedule,
        { ...f.observation, state: "SOURCE_UNAVAILABLE_REVIEW_HOLD" },
        receipt,
        f.runner.pins,
        { now: f.now },
      ),
    /DRIFT/,
  );
  assert.throws(
    () =>
      verifyRunnerAttestation(
        f.schedule,
        f.observation,
        { ...receipt, signatureBase64: "A".repeat(86) + "==" },
        f.runner.pins,
        { now: f.now },
      ),
    /SIGNATURE/,
  );
  assert.throws(
    () =>
      verifyRunnerAttestation(
        f.schedule,
        f.observation,
        receipt,
        { ...f.runner.pins, signers: [] },
        { now: f.now },
      ),
    /PIN/,
  );
  assert.throws(
    () =>
      prepareRunnerAttestation(
        {
          ...f.schedule,
          tasks: [{ ...f.schedule.tasks[0], ownerSignedRequestPresent: false }],
        },
        f.observation,
        { keyId: f.runner.keyId, now: f.now },
      ),
    /OWNER_APPROVED/,
  );
  assert.throws(
    () =>
      verifyRunnerAttestation(
        f.schedule,
        f.observation,
        receipt,
        f.runner.pins,
        { now: f.now + 49 * 3_600_000 },
      ),
    /EXPIRED/,
  );
});

test("Build 219 portable manifest is pinned to the redacted digest and independent signer", () => {
  const f = fixture();
  const request = preparePortabilityManifest(f.report, {
    keyId: f.custodian.keyId,
    now: f.now,
  });
  const receipt = signPortabilityManifest(
    f.report,
    request,
    f.custodian.privatePem,
    f.now,
  );
  const checked = verifyPortabilityManifest(
    f.report,
    receipt,
    f.custodian.pins,
    {
      now: f.now,
      ownerPins: f.owner.pins,
      runnerPins: f.runner.pins,
    },
  );
  assert.equal(checked.signatureAndPinVerified, true);
  assert.equal(checked.signerSeparateFromSuppliedOwnerAndRunnerPins, true);
  assert.equal(checked.archiveStorageOrSourceBytesVerified, false);
  assert.throws(
    () =>
      verifyPortabilityManifest(
        { ...f.report, dashboard: { state: "TAMPERED" } },
        receipt,
        f.custodian.pins,
        { now: f.now },
      ),
    /HASH|UNSAFE/,
  );
  assert.throws(
    () =>
      preparePortabilityManifest(
        { ...f.report, leakedPrivateKey: "sensitive" },
        { keyId: f.custodian.keyId, now: f.now },
      ),
    /UNSAFE/,
  );
  assert.throws(
    () =>
      verifyPortabilityManifest(f.report, receipt, f.custodian.pins, {
        now: f.now,
        runnerPins: f.custodian.pins,
      }),
    /NOT_SEPARATE/,
  );
  assert.throws(
    () =>
      verifyPortabilityManifest(f.report, receipt, f.custodian.pins, {
        now: f.now + 49 * 3_600_000,
      }),
    /EXPIRED/,
  );
});

test("Build 219 closure review requires matching artifact and preserves archive, custody, owner and Comms HOLD", () => {
  const f = fixture();
  const runnerReq = prepareRunnerAttestation(f.schedule, f.observation, {
    keyId: f.runner.keyId,
    now: f.now,
  });
  const manifestReq = preparePortabilityManifest(f.report, {
    keyId: f.custodian.keyId,
    now: f.now,
  });
  const data = {
    ledger: f.ledger,
    exceptionReceipt: f.exceptionReceipt,
    ownerPins: f.owner.pins,
    schedule: f.schedule,
    observation: f.observation,
    runnerReceipt: signRunnerAttestation(
      f.schedule,
      f.observation,
      runnerReq,
      f.runner.privatePem,
      f.now,
    ),
    runnerPins: f.runner.pins,
    report: f.report,
    manifestReceipt: signPortabilityManifest(
      f.report,
      manifestReq,
      f.custodian.privatePem,
      f.now,
    ),
    manifestPins: f.custodian.pins,
    now: f.now,
  };
  const review = reviewRetentionExceptionClosure(data);
  assert.match(review.state, /HOLD/);
  assert.equal(review.verifiedRunnerSignature, true);
  assert.equal(review.verifiedIndependentManifestSignature, true);
  assert.equal(review.retentionExceptionClosed, false);
  assert.equal(review.commsTestAuthorized, false);
  assert.throws(
    () =>
      reviewRetentionExceptionClosure({
        ...data,
        report: { ...f.report, sourceRechecks: [] },
      }),
    /HASH/,
  );
  const different = {
    ...f.report,
    sourceRechecks: [{ ...f.report.sourceRechecks[0], artifactId: 999 }],
  };
  const payload = { ...different };
  delete payload.exportDigest;
  const differentReport = {
    ...payload,
    exportDigest: digest(canonicalJson(payload)),
  };
  const differentReq = preparePortabilityManifest(differentReport, {
    keyId: f.custodian.keyId,
    now: f.now,
  });
  const differentReceipt = signPortabilityManifest(
    differentReport,
    differentReq,
    f.custodian.privatePem,
    f.now,
  );
  assert.throws(
    () =>
      reviewRetentionExceptionClosure({
        ...data,
        report: differentReport,
        manifestReceipt: differentReceipt,
      }),
    /CROSS_ARTIFACT/,
  );
});
