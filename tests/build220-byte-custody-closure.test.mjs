import assert from "node:assert/strict";
import { createHash, generateKeyPairSync } from "node:crypto";
import { readFileSync } from "node:fs";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
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
  preparePortabilityManifest,
  prepareRunnerAttestation,
  signPortabilityManifest,
  signRunnerAttestation,
} from "../scripts/build219-runner-manifest-closure.mjs";
import {
  analyzeBuild220Ci,
  readActualArchiveBytes,
  prepareByteCustodyAttestation,
  signByteCustodyAttestation,
  verifyByteCustodyAttestation,
  prepareOwnerClosureDecision,
  signOwnerClosureDecision,
  reconcileCrossDeviceAuditReceipts,
} from "../scripts/build220-byte-custody-closure.mjs";
import { readBuild206Inputs } from "../scripts/verify-build206-cache-contract.mjs";
import { verifyBuild220CIContract } from "../scripts/verify-build220-ci-contract.mjs";

const NOW = Date.parse("2026-11-07T12:00:00.000Z");
const DAY = 86_400_000;
const iso = (v) => new Date(v).toISOString();
const digest = (v) => `sha256:${createHash("sha256").update(v).digest("hex")}`;
const ZIP = Buffer.concat([
  Buffer.from([0x50, 0x4b, 0x03, 0x04]),
  Buffer.from("synthetic-fixture-not-original-github-artifact"),
]);
const reviewedHistory = JSON.parse(
  readFileSync(
    resolve(
      import.meta.dirname,
      "../fixtures/build210-reviewed-chromium-history.json",
    ),
    "utf8",
  ),
);
function signer(id, role, schema) {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const publicKeyPem = publicKey.export({ format: "pem", type: "spki" });
  return {
    keyId: id,
    privatePem: privateKey.export({ format: "pem", type: "pkcs8" }),
    pins: {
      schema,
      signers: [
        {
          keyId: id,
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
        sourceDigest: digest(ZIP),
        evidencePacketDigest: digest("custody-alpha"),
        signerKeyId: "source-custodian",
        storageReference: "offline://vault-alpha",
        expiresAt: iso(NOW + 20 * DAY),
        immutableStorageVerified: false,
        independentHumanIdentityEstablishedByScript: false,
      },
      { now: NOW },
    ),
  );
  const owner = signer(
    "owner-jack",
    "ICAMP_CUSTODY_RENEWAL_OWNER",
    "icamp.build216.owner-renewal-pins.v1",
  );
  const runner = signer(
    "runner-ree",
    "ICAMP_INDEPENDENT_READONLY_RUNNER",
    "icamp.build219.independent-runner-pins.v1",
  );
  const custodian = signer(
    "custodian-third",
    "ICAMP_INDEPENDENT_ARCHIVE_BYTE_CUSTODIAN",
    "icamp.build220.independent-byte-custodian-pins.v1",
  );
  const manifestSigner = signer(
    "manifest-fourth",
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
    ownerReceipts: [ownerReceipt],
    ownerPins: owner.pins,
    now: NOW + 2000,
    ciEvidence: {
      build211: {
        artifactReview: {
          schema: "icamp.build211.artifact-expiry-renewal.v1",
          sources: [
            {
              artifactId: 12345,
              runId: 6401,
              jobId: 7401,
              pinnedOriginalDigest: digest(ZIP),
              expiresAt: iso(NOW + 2 * DAY),
            },
          ],
        },
      },
    },
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
  const now = NOW + 5000;
  const runnerReq = prepareRunnerAttestation(schedule, observation, {
    keyId: runner.keyId,
    now,
  });
  const runnerReceipt = signRunnerAttestation(
    schedule,
    observation,
    runnerReq,
    runner.privatePem,
    now,
  );
  const manifestReq = preparePortabilityManifest(report, {
    keyId: manifestSigner.keyId,
    now,
  });
  const manifestReceipt = signPortabilityManifest(
    report,
    manifestReq,
    manifestSigner.privatePem,
    now,
  );
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
  return {
    ledger,
    owner,
    runner,
    custodian,
    manifestSigner,
    schedule,
    observation,
    report,
    runnerReceipt,
    manifestReceipt,
    exceptionReceipt,
    now,
  };
}
async function fixtureWithBytes(t) {
  const f = fixture();
  const dir = await fs.mkdtemp(join(tmpdir(), "icamp220-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const archivePath = join(dir, "original-fixture.zip");
  await fs.writeFile(archivePath, ZIP);
  const byteRecord = await readActualArchiveBytes({
    ledger: f.ledger,
    observation: f.observation,
    archivePath,
    now: f.now,
    confirmedReadOnly: true,
  });
  const custodyReq = prepareByteCustodyAttestation(
    f.ledger,
    f.observation,
    byteRecord,
    {
      keyId: f.custodian.keyId,
      claimedOriginalDeviceId: "REE-ORIGINAL-SERVER",
      now: f.now,
    },
  );
  const custodianReceipt = signByteCustodyAttestation(
    f.ledger,
    f.observation,
    byteRecord,
    custodyReq,
    f.custodian.privatePem,
    f.now,
  );
  return { ...f, byteRecord, custodianReceipt, archivePath };
}

test("Build 220 preserves five required CI gates with external signer and archive proof held", () => {
  assert.equal(
    verifyBuild220CIContract(readBuild206Inputs(), reviewedHistory)
      .requiredChecks,
    5,
  );
  assert.equal(analyzeBuild220Ci(null).originalArtifactBytesInCi, false);
});

test("Build 220 hashes actual locally held ZIP bytes, rejects no approval, wrong digest and unsafe path", async (t) => {
  const f = await fixtureWithBytes(t);
  assert.equal(f.byteRecord.localByteDigest, digest(ZIP));
  assert.equal(f.byteRecord.localDigestMatchedPinnedSource, true);
  assert.equal(
    f.byteRecord.originalGitHubDownloadProvenanceAuthenticated,
    false,
  );
  assert.equal(f.byteRecord.retentionExceptionClosed, false);
  await assert.rejects(
    readActualArchiveBytes({
      ledger: f.ledger,
      observation: f.observation,
      archivePath: f.archivePath,
      now: f.now,
    }),
    /EXPLICIT_OWNER/,
  );
  await assert.rejects(
    readActualArchiveBytes({
      ledger: f.ledger,
      observation: f.observation,
      archivePath: resolve(
        import.meta.dirname,
        "build220-byte-custody-closure.test.mjs",
      ),
      now: f.now,
      confirmedReadOnly: true,
    }),
    /PRIVATE_PATH/,
  );
  const path = join(dirname(f.archivePath), "wrong-content.zip");
  await fs.writeFile(
    path,
    Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x03, 0x04]),
      Buffer.from("wrong"),
    ]),
  );
  const mismatch = await readActualArchiveBytes({
    ledger: f.ledger,
    observation: f.observation,
    archivePath: path,
    now: f.now,
    confirmedReadOnly: true,
  });
  assert.equal(mismatch.state, "LOCAL_ZIP_DIGEST_CONFLICT_QUARANTINED_HOLD");
  assert.throws(
    () =>
      prepareByteCustodyAttestation(f.ledger, f.observation, mismatch, {
        keyId: f.custodian.keyId,
        claimedOriginalDeviceId: "REE-ORIGINAL-SERVER",
        now: f.now,
      }),
    /ORIGINAL_BYTES_MATCH/,
  );
});

test("Build 220 requires independently pinned byte custodian signature with drift, replay and expiry rejection", async (t) => {
  const f = await fixtureWithBytes(t);
  const seen = new Set();
  const valid = verifyByteCustodyAttestation(
    f.ledger,
    f.observation,
    f.byteRecord,
    f.custodianReceipt,
    f.custodian.pins,
    { now: f.now, consumedNonces: seen },
  );
  assert.equal(valid.matchingLocalBytesSigned, true);
  assert.equal(valid.originalSourceDownloadIndependentlyVerified, false);
  assert.throws(
    () =>
      verifyByteCustodyAttestation(
        f.ledger,
        f.observation,
        f.byteRecord,
        f.custodianReceipt,
        f.custodian.pins,
        { now: f.now, consumedNonces: seen },
      ),
    /REPLAYED/,
  );
  assert.throws(
    () =>
      verifyByteCustodyAttestation(
        f.ledger,
        f.observation,
        { ...f.byteRecord, byteCount: 999 },
        f.custodianReceipt,
        f.custodian.pins,
        { now: f.now },
      ),
    /DRIFT|CLAIM/,
  );
  assert.throws(
    () =>
      verifyByteCustodyAttestation(
        f.ledger,
        f.observation,
        f.byteRecord,
        f.custodianReceipt,
        { ...f.custodian.pins, signers: [] },
        { now: f.now },
      ),
    /PIN/,
  );
  assert.throws(
    () =>
      verifyByteCustodyAttestation(
        f.ledger,
        f.observation,
        f.byteRecord,
        f.custodianReceipt,
        f.custodian.pins,
        { now: f.now + 49 * 3_600_000 },
      ),
    /SCOPE_OR_TIME|DRIFT/,
  );
});

test("Build 220 reconciles distinct four-signature cross-device review and never auto-closes exception", async (t) => {
  const f = await fixtureWithBytes(t);
  const base = {
    ledger: f.ledger,
    exceptionReceipt: f.exceptionReceipt,
    ownerPins: f.owner.pins,
    schedule: f.schedule,
    observation: f.observation,
    runnerReceipt: f.runnerReceipt,
    runnerPins: f.runner.pins,
    report: f.report,
    manifestReceipt: f.manifestReceipt,
    manifestPins: f.manifestSigner.pins,
    byteRecord: f.byteRecord,
    custodianReceipt: f.custodianReceipt,
    custodianPins: f.custodian.pins,
    now: f.now,
  };
  const req = prepareOwnerClosureDecision({
    ...base,
    decision: "APPROVE_CLOSURE_REVIEW",
    ownerKeyId: f.owner.keyId,
    claimedOwnerDeviceId: "JACK-MASTER-LAPTOP",
  });
  const ownerClosureReceipt = signOwnerClosureDecision(
    req,
    f.owner.privatePem,
    f.now,
  );
  const status = reconcileCrossDeviceAuditReceipts({
    ...base,
    ownerClosureReceipt,
  });
  assert.equal(status.verifiedOwnerClosureReviewSignature, true);
  assert.equal(status.distinctCryptographicSignerKeys, true);
  assert.equal(status.localOriginalByteDigestMatched, true);
  assert.equal(status.retentionExceptionClosed, false);
  assert.equal(status.commsTestAuthorized, false);
  assert.throws(
    () =>
      reconcileCrossDeviceAuditReceipts({
        ...base,
        byteRecord: { ...f.byteRecord, artifactId: 999 },
        ownerClosureReceipt,
      }),
    /DRIFT|REGISTRATION/,
  );
  assert.throws(
    () =>
      reconcileCrossDeviceAuditReceipts({
        ...base,
        ownerClosureReceipt: {
          ...ownerClosureReceipt,
          request: { ...req, decision: "REJECT_CLOSURE_REVIEW" },
        },
      }),
    /SIGNATURE_INVALID/,
  );
  const deviceReq = prepareOwnerClosureDecision({
    ...base,
    decision: "APPROVE_CLOSURE_REVIEW",
    ownerKeyId: f.owner.keyId,
    claimedOwnerDeviceId: "REE-ORIGINAL-SERVER",
  });
  assert.throws(
    () =>
      reconcileCrossDeviceAuditReceipts({
        ...base,
        ownerClosureReceipt: signOwnerClosureDecision(
          deviceReq,
          f.owner.privatePem,
          f.now,
        ),
      }),
    /CROSS_DEVICE/,
  );
});
