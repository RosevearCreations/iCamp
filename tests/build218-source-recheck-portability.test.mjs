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
import { publicKeyFingerprint } from "../scripts/build212-owner-sla-receipt.mjs";
import { summarizeRetentionDashboard } from "../scripts/build217-custody-retention-dashboard.mjs";
import {
  analyzeBuild218Ci,
  buildPortableEvidenceExport,
  createSourceRecheckSchedule,
  performReadOnlySourceRecheck,
  prepareExceptionAcknowledgement,
  signExceptionAcknowledgement,
  verifyExceptionAcknowledgement,
} from "../scripts/build218-source-recheck-portability.mjs";
import { readBuild206Inputs } from "../scripts/verify-build206-cache-contract.mjs";
import { verifyBuild218CIContract } from "../scripts/verify-build218-ci-contract.mjs";

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

function registration(keyId, packet, storage, expiresAt) {
  return {
    kind: "VERIFIED_ARCHIVE_COPY",
    sourceIdentity: {
      artifactId: 12345,
      runId: 6401,
      jobId: 7401,
      commit: "a".repeat(40),
    },
    sourceDigest: digest("original-12345"),
    evidencePacketDigest: digest(packet),
    signerKeyId: keyId,
    storageReference: storage,
    expiresAt,
    immutableStorageVerified: false,
    independentHumanIdentityEstablishedByScript: false,
  };
}

function fixture() {
  const ledger = [];
  for (const r of [
    registration(
      "custodian-alpha",
      "packet-alpha",
      "offline://vaults/alpha",
      iso(NOW + 5 * DAY),
    ),
    registration(
      "custodian-beta",
      "packet-beta",
      "offline://vaults/beta",
      iso(NOW + 20 * DAY),
    ),
  ])
    ledger.push(appendRegistrationEntry(ledger, r, { now: NOW }));
  const owner = signer("owner-renewal");
  const pins = {
    schema: "icamp.build216.owner-renewal-pins.v1",
    signers: [
      {
        keyId: owner.id,
        role: "ICAMP_CUSTODY_RENEWAL_OWNER",
        enabled: true,
        publicKeyPem: owner.publicPem,
        fingerprint: owner.fingerprint,
      },
    ],
  };
  const request = prepareOwnerRenewal(ledger, {
    sequence: 1,
    keyId: owner.id,
    choice: "REQUEST_EVIDENCE_RENEWAL",
    now: NOW,
  });
  const receipt = signOwnerRenewal(
    request,
    ledger,
    owner.privatePem,
    NOW + 1000,
  );
  const ciEvidence = {
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
            status: "EXPIRING_RENEWAL_REVIEW_REQUIRED",
          },
        ],
      },
    },
  };
  return {
    ledger,
    owner,
    pins,
    ownerPins: pins,
    ownerReceipts: [receipt],
    ciEvidence,
  };
}

test("Build 218 preserves five checks, no background cron, source proof and signatures absent from CI", () => {
  const contract = verifyBuild218CIContract(
    readBuild206Inputs(),
    reviewedHistory,
  );
  assert.equal(contract.requiredChecks, 5);
  assert.equal(contract.newWorkflowsOrCronSchedules, 0);
  assert.equal(contract.readOnlyRecheckRequiresOwnerApproval, true);
  assert.equal(analyzeBuild218Ci(null).remoteArtifactReadsInCi, false);
});

test("Build 218 schedules one owner-approved recheck across two custodians and rejects drift or cooldown", () => {
  const f = fixture();
  const schedule = createSourceRecheckSchedule({ ...f, now: NOW + 4000 });
  assert.equal(schedule.tasks.length, 1);
  assert.equal(schedule.tasks[0].custodianRegistrationsReviewed, 2);
  assert.equal(schedule.dueCount, 1);
  assert.equal(schedule.tasks[0].state, "OWNER_REQUESTED_READONLY_RECHECK_DUE");
  assert.equal(schedule.automaticNetworkCalls, false);
  const noOwner = createSourceRecheckSchedule({
    ...f,
    ownerReceipts: [],
    now: NOW + 4000,
  });
  assert.equal(noOwner.dueCount, 0);
  assert.equal(noOwner.tasks[0].state, "SIGNED_OWNER_REQUEST_REQUIRED_HOLD");
  const mismatched = structuredClone(f.ciEvidence);
  mismatched.build211.artifactReview.sources[0].pinnedOriginalDigest =
    digest("wrong-original");
  const conflict = createSourceRecheckSchedule({
    ...f,
    ciEvidence: mismatched,
    now: NOW + 4000,
  });
  assert.equal(
    conflict.tasks[0].state,
    "SOURCE_IDENTITY_OR_DIGEST_CONFLICT_HOLD",
  );
  const priorObservations = [
    {
      schema: "icamp.build218.original-source-recheck.v1",
      artifactId: 12345,
      taskKey: schedule.tasks[0].taskKey,
      observedAt: iso(NOW + 3000),
    },
  ];
  const cooldown = createSourceRecheckSchedule({
    ...f,
    priorObservations,
    now: NOW + 4000,
  });
  assert.equal(cooldown.tasks[0].state, "WAITING_FOR_RECHECK_DUE_WINDOW");
});

test("Build 218 reads only the fixed original GitHub metadata URL after signed owner authorization", async () => {
  const f = fixture();
  const now = NOW + 5000;
  let called = 0;
  const fetchImpl = async (url, options) => {
    called++;
    assert.equal(
      url,
      "https://api.github.com/repos/RosevearCreations/iCamp/actions/artifacts/12345",
    );
    assert.equal(options.method, "GET");
    assert.equal(options.redirect, "error");
    return {
      ok: true,
      json: async () => ({
        id: 12345,
        name: "build205-ci-runtime-evidence",
        created_at: iso(NOW - DAY),
        expires_at: iso(NOW + 2 * DAY),
        size_in_bytes: 940,
        expired: false,
        digest: digest("original-12345"),
        workflow_run: { id: 6401, head_sha: "a".repeat(40) },
      }),
    };
  };
  const receipt = await performReadOnlySourceRecheck({
    ...f,
    artifactId: 12345,
    now,
    token: "read-only-fixture-token",
    ownerConfirmed: true,
    fetchImpl,
  });
  assert.equal(called, 1);
  assert.equal(
    receipt.state,
    "GITHUB_METADATA_MATCHED_ARCHIVE_BYTES_NOT_VERIFIED",
  );
  assert.equal(receipt.originalArtifactBytesDownloaded, false);
  assert.equal(receipt.originalRetentionRenewed, false);
  await assert.rejects(
    performReadOnlySourceRecheck({
      ...f,
      artifactId: 12345,
      now,
      token: "read-only-fixture-token",
      ownerConfirmed: false,
      fetchImpl,
    }),
    /EXPLICIT_OWNER_READONLY_RECHECK_REQUIRED/,
  );
  await assert.rejects(
    performReadOnlySourceRecheck({
      ...f,
      ownerReceipts: [],
      artifactId: 12345,
      now,
      token: "read-only-fixture-token",
      ownerConfirmed: true,
      fetchImpl,
    }),
    /NOT_AUTHORIZED_OR_NOT_DUE/,
  );
  assert.equal(called, 1);
  const bad = await performReadOnlySourceRecheck({
    ...f,
    artifactId: 12345,
    now,
    token: "read-only-fixture-token",
    ownerConfirmed: true,
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({
        id: 12345,
        name: "wrong",
        created_at: iso(NOW - DAY),
        expires_at: iso(NOW + 2 * DAY),
        size_in_bytes: 940,
        expired: false,
        digest: digest("wrong"),
        workflow_run: { id: 6401, head_sha: "a".repeat(40) },
      }),
    }),
  });
  assert.equal(bad.state, "GITHUB_SOURCE_IDENTITY_OR_DIGEST_CONFLICT_HOLD");
});

test("Build 218 owner exception acknowledgement is scoped, signed, expires, and refuses replay or tampering", () => {
  const f = fixture();
  const request = prepareExceptionAcknowledgement(f.ledger, {
    sequence: 1,
    exceptionCode: "SLA_RECHECK_OVERDUE",
    keyId: f.owner.id,
    now: NOW,
  });
  const receipt = signExceptionAcknowledgement(
    f.ledger,
    request,
    f.owner.privatePem,
    NOW + 1000,
  );
  const used = new Set();
  const verified = verifyExceptionAcknowledgement(f.ledger, receipt, f.pins, {
    now: NOW + 2000,
    consumedNonces: used,
  });
  assert.equal(
    verified.state,
    "SIGNED_EXCEPTION_REVIEW_ONLY_NOT_POLICY_WAIVER",
  );
  assert.equal(verified.releaseApprovalGranted, false);
  assert.throws(
    () =>
      verifyExceptionAcknowledgement(f.ledger, receipt, f.pins, {
        now: NOW + 2000,
        consumedNonces: used,
      }),
    /DUPLICATE_OWNER_EXCEPTION_ACK_NONCE/,
  );
  assert.throws(
    () =>
      verifyExceptionAcknowledgement(
        f.ledger,
        { ...receipt, signatureBase64: "A".repeat(86) + "==" },
        f.pins,
        { now: NOW + 2000 },
      ),
    /INVALID_OWNER_EXCEPTION_ACK_SIGNATURE/,
  );
  assert.throws(
    () =>
      verifyExceptionAcknowledgement(f.ledger, receipt, f.pins, {
        now: NOW + 5 * DAY,
      }),
    /SCOPE_OR_EXPIRY_INVALID/,
  );
});

test("Build 218 exports portable redacted counts without keys, source digests, archive URLs or waivers", async () => {
  const f = fixture();
  const now = NOW + 5000;
  const schedule = createSourceRecheckSchedule({ ...f, now });
  const observation = await performReadOnlySourceRecheck({
    ...f,
    artifactId: 12345,
    now,
    token: "read-only-fixture-token",
    ownerConfirmed: true,
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({
        id: 12345,
        name: "build205-ci-runtime-evidence",
        created_at: iso(NOW - DAY),
        expires_at: iso(NOW + 2 * DAY),
        size_in_bytes: 940,
        expired: false,
        digest: digest("original-12345"),
        workflow_run: { id: 6401, head_sha: "a".repeat(40) },
      }),
    }),
  });
  const ackRequest = prepareExceptionAcknowledgement(f.ledger, {
    sequence: 1,
    exceptionCode: "INDEPENDENT_CUSTODY_NOT_PROVEN",
    keyId: f.owner.id,
    now: NOW,
  });
  const ack = signExceptionAcknowledgement(
    f.ledger,
    ackRequest,
    f.owner.privatePem,
    now,
  );
  const dashboard = summarizeRetentionDashboard({
    ledger: f.ledger,
    rotations: [],
    anchorPins: { signers: [] },
    expectedTail: "GENESIS",
    ownerReceipts: f.ownerReceipts,
    ownerPins: f.pins,
    ciEvidence: f.ciEvidence,
    now,
  });
  const portable = buildPortableEvidenceExport({
    ledger: f.ledger,
    dashboard,
    schedule,
    sourceRechecks: [observation],
    exceptionReceipts: [ack],
    ownerPins: f.pins,
    now,
  });
  assert.equal(portable.privateEvidenceIncluded, false);
  assert.equal(portable.sourceRechecks.length, 1);
  assert.equal(portable.sourceRechecks[0].archiveBytesVerified, false);
  assert.equal(portable.ownerExceptionAcknowledgements.length, 1);
  assert.match(portable.exportDigest, /^sha256:[a-f0-9]{64}$/);
  const json = JSON.stringify(portable);
  assert.doesNotMatch(
    json,
    /offline:\/\/vaults|BEGIN PRIVATE KEY|signatureBase64/,
  );
  assert.doesNotMatch(json, new RegExp(f.ledger[0].sourceDigest));
  assert.equal(portable.dashboard.counts.secretNote, undefined);
  const withInjectedMetric = {
    ...dashboard,
    counts: { ...dashboard.counts, secretNote: "PRIVATE_NOT_FOR_EXPORT" },
  };
  const scrubbed = buildPortableEvidenceExport({
    ledger: f.ledger,
    dashboard: withInjectedMetric,
    schedule,
    sourceRechecks: [observation],
    exceptionReceipts: [ack],
    ownerPins: f.pins,
    now,
  });
  assert.doesNotMatch(JSON.stringify(scrubbed), /PRIVATE_NOT_FOR_EXPORT/);
  assert.throws(
    () =>
      buildPortableEvidenceExport({
        ledger: f.ledger,
        dashboard,
        schedule,
        sourceRechecks: [{ ...observation, originalRetentionRenewed: true }],
        exceptionReceipts: [ack],
        ownerPins: f.pins,
        now,
      }),
    /UNVERIFIED_OR_CROSS_SOURCE_PORTABILITY_RECHECK/,
  );
});
