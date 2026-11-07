import assert from "node:assert/strict";
import { createHash, generateKeyPairSync } from "node:crypto";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { appendRegistrationEntry } from "../scripts/build214-owner-custody-register.mjs";
import { publicKeyFingerprint } from "../scripts/build212-owner-sla-receipt.mjs";
import {
  readActualArchiveBytes,
  prepareByteCustodyAttestation,
  signByteCustodyAttestation,
} from "../scripts/build220-byte-custody-closure.mjs";
import {
  prepareExternalReview,
  signExternalReview,
  verifyExternalReview,
  auditOwnerClosureEligibility,
  analyzeBuild221Ci,
} from "../scripts/build221-provenance-retention-audit.mjs";
import { verifyBuild221CIContract } from "../scripts/verify-build221-ci-contract.mjs";
import { readBuild206Inputs } from "../scripts/verify-build206-cache-contract.mjs";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const NOW = Date.parse("2026-11-07T14:00:00.000Z");
const iso = (ms) => new Date(ms).toISOString();
const digest = (bytes) =>
  `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
const ZIP = Buffer.from(
  "PK\x03\x04synthetic-fixture-does-not-prove-original-github-custody",
);

function signer(keyId, role, schema) {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const publicKeyPem = publicKey.export({ format: "pem", type: "spki" });
  return {
    keyId,
    privatePem: privateKey.export({ format: "pem", type: "pkcs8" }),
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

async function sample(t) {
  const dir = await mkdtemp(join(tmpdir(), "icamp221-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const zipPath = join(dir, "synthetic.zip");
  await writeFile(zipPath, ZIP);
  const ledger = [
    appendRegistrationEntry(
      [],
      {
        kind: "VERIFIED_ARCHIVE_COPY",
        sourceIdentity: {
          artifactId: 555,
          runId: 123,
          jobId: 456,
          commit: "a".repeat(40),
        },
        sourceDigest: digest(ZIP),
        evidencePacketDigest: digest("external-claimed-custody"),
        signerKeyId: "archive-reviewer-one",
        storageReference: "offline://archive-example",
        expiresAt: iso(NOW + 14 * 86_400_000),
        immutableStorageVerified: false,
        independentHumanIdentityEstablishedByScript: false,
      },
      { now: NOW },
    ),
  ];
  const observation = {
    schema: "icamp.build218.original-source-recheck.v1",
    artifactId: 555,
    runId: 123,
    jobId: 456,
    observedAt: iso(NOW),
    state: "GITHUB_METADATA_MATCHED_ARCHIVE_BYTES_NOT_VERIFIED",
    originalArtifactBytesDownloaded: false,
    originalRetentionRenewed: false,
  };
  const byteRecord = await readActualArchiveBytes({
    ledger,
    observation,
    archivePath: zipPath,
    now: NOW,
    confirmedReadOnly: true,
  });
  const custodian = signer(
    "custodian-test",
    "ICAMP_INDEPENDENT_ARCHIVE_BYTE_CUSTODIAN",
    "icamp.build220.independent-byte-custodian-pins.v1",
  );
  const custodianRequest = prepareByteCustodyAttestation(
    ledger,
    observation,
    byteRecord,
    {
      keyId: custodian.keyId,
      claimedOriginalDeviceId: "CUSTODIAN-TEST",
      now: NOW,
    },
  );
  const custodianReceipt = signByteCustodyAttestation(
    ledger,
    observation,
    byteRecord,
    custodianRequest,
    custodian.privatePem,
    NOW,
  );
  return {
    ledger,
    observation,
    byteRecord,
    custodianReceipt,
    custodianPins: custodian.pins,
  };
}

test("Build 221 verifies separately pinned source and archive review claims but never upgrades field proof", async (t) => {
  const bundle = await sample(t);
  const source = signer(
    "independent-source",
    "ICAMP_INDEPENDENT_ORIGINAL_SOURCE_REVIEWER",
    "icamp.build221.source-reviewer-pins.v1",
  );
  const retention = signer(
    "independent-retention",
    "ICAMP_INDEPENDENT_EXTERNAL_ARCHIVE_REVIEWER",
    "icamp.build221.retention-reviewer-pins.v1",
  );
  for (const [kind, authority] of [
    ["SOURCE", source],
    ["RETENTION", retention],
  ]) {
    const payload = prepareExternalReview(bundle, {
      kind,
      keyId: authority.keyId,
      reviewerDeviceClaim: `${kind}-ORIGINAL-DEVICE`,
      externalEvidenceDigest: digest(`separate-${kind}-evidence`),
      now: NOW,
      observedAt: iso(NOW),
    });
    const receipt = signExternalReview(payload, authority.privatePem);
    const result = verifyExternalReview(bundle, receipt, authority.pins, kind, {
      now: NOW + 1000,
    });
    assert.equal(result.signedClaimCryptographicallyVerified, true);
    assert.equal(result.originalGitHubIssuerIndependentlyAuthenticated, false);
    assert.equal(result.offsiteStoragePhysicalIndependenceVerified, false);
    assert.equal(result.retentionExceptionClosed, false);
    assert.equal(result.commsTestAuthorized, false);
    assert.throws(() =>
      verifyExternalReview(bundle, receipt, authority.pins, "UNKNOWN", {
        now: NOW + 1000,
      }),
    );
    assert.throws(() =>
      verifyExternalReview(
        bundle,
        {
          ...receipt,
          payload: { ...payload, tenantBoundary: "camp_rosevear" },
        },
        authority.pins,
        kind,
        { now: NOW + 1000 },
      ),
    );
    assert.throws(() =>
      verifyExternalReview(
        bundle,
        {
          ...receipt,
          payload: { ...payload, unrelated: "leak" },
        },
        authority.pins,
        kind,
        { now: NOW + 1000 },
      ),
    );
    assert.throws(() =>
      verifyExternalReview(bundle, receipt, authority.pins, kind, {
        now: NOW + 48 * 3_600_000,
      }),
    );
    assert.throws(() =>
      verifyExternalReview(
        bundle,
        receipt,
        {
          ...authority.pins,
          signers: [{ ...authority.pins.signers[0], enabled: false }],
        },
        kind,
        { now: NOW + 1000 },
      ),
    );
  }
});

test("Build 221 rejects mismatched ZIP/ledger lineage, invalid signer and fabricated owner closure bundle", async (t) => {
  const bundle = await sample(t);
  const source = signer(
    "source-review",
    "ICAMP_INDEPENDENT_ORIGINAL_SOURCE_REVIEWER",
    "icamp.build221.source-reviewer-pins.v1",
  );
  const payload = prepareExternalReview(bundle, {
    kind: "SOURCE",
    keyId: source.keyId,
    reviewerDeviceClaim: "ORIGINAL-SOURCE",
    externalEvidenceDigest: digest("external-reference"),
    now: NOW,
    observedAt: iso(NOW),
  });
  const receipt = signExternalReview(payload, source.privatePem);
  assert.throws(() =>
    verifyExternalReview(
      {
        ...bundle,
        byteRecord: {
          ...bundle.byteRecord,
          localByteDigest: digest("tampered"),
        },
      },
      receipt,
      source.pins,
      "SOURCE",
      { now: NOW + 1000 },
    ),
  );
  assert.throws(() =>
    verifyExternalReview(
      bundle,
      receipt,
      {
        ...source.pins,
        signers: [{ ...source.pins.signers[0], fingerprint: digest("wrong") }],
      },
      "SOURCE",
      { now: NOW + 1000 },
    ),
  );
  assert.throws(() =>
    auditOwnerClosureEligibility(bundle, {
      sourceReceipt: receipt,
      sourcePins: source.pins,
      retentionReceipt: receipt,
      retentionPins: source.pins,
      now: NOW + 1000,
    }),
  );
});

test("Build 221 preserves five protected release gates and forbids synthetic evidence promotion", () => {
  const history = JSON.parse(
    readFileSync(
      resolve(
        import.meta.dirname,
        "../fixtures/build210-reviewed-chromium-history.json",
      ),
      "utf8",
    ),
  );
  const result = verifyBuild221CIContract(readBuild206Inputs(), history);
  assert.equal(result.requiredChecks, 5);
  assert.equal(result.connectionState, "DISCONNECTED / HOLD");
  assert.deepEqual(
    analyzeBuild221Ci().externalOriginalEvidenceImportedToCI,
    false,
  );
  const manifest = JSON.parse(
    readFileSync(
      resolve(
        import.meta.dirname,
        "../public/.well-known/rosevear-integration-manifest.json",
      ),
      "utf8",
    ),
  );
  assert.match(manifest.source_revision, /^[a-f0-9]{40}$/);
  assert.equal(manifest.source_id, "icamp");
  assert.equal(manifest.repository, "RosevearCreations/iCamp");
  assert.equal(manifest.tenant_boundary, "platform_shell");
  assert.equal(manifest.signature.state, "AWAITING_INDEPENDENT_SOURCE_SIGNER");
  assert.equal(manifest.connection_state, "DISCONNECTED / HOLD");
});
