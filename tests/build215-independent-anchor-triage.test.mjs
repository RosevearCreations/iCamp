import assert from "node:assert/strict";
import { createHash, generateKeyPairSync } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { appendRegistrationEntry } from "../scripts/build214-owner-custody-register.mjs";
import { publicKeyFingerprint } from "../scripts/build212-owner-sla-receipt.mjs";
import {
  analyzeBuild215Ci,
  prepareAnchorClaims,
  signAnchorClaims,
  triageCustodianRenewals,
  triageOwnerSlaExpiry,
  verifyIndependentAnchor,
} from "../scripts/build215-independent-anchor-triage.mjs";
import { readBuild206Inputs } from "../scripts/verify-build206-cache-contract.mjs";
import { verifyBuild215CIContract } from "../scripts/verify-build215-ci-contract.mjs";

const NOW = Date.parse("2026-11-07T12:00:00.000Z");
const DAY = 86_400_000;
const iso = (ms) => new Date(ms).toISOString();
const sha = (text) =>
  `sha256:${createHash("sha256").update(text).digest("hex")}`;
const history = JSON.parse(
  readFileSync(
    resolve(
      import.meta.dirname,
      "../fixtures/build210-reviewed-chromium-history.json",
    ),
    "utf8",
  ),
);

function archive(
  suffix,
  {
    artifactId = 100,
    signer = `custodian-${suffix}`,
    digest = sha("original"),
    expiresInDays = 50,
    store = `offline://private/${suffix}`,
  } = {},
) {
  return {
    kind: "VERIFIED_ARCHIVE_COPY",
    sourceIdentity: {
      artifactId,
      runId: 200,
      jobId: 300,
      commit: "a".repeat(40),
    },
    sourceDigest: digest,
    evidencePacketDigest: sha(`signed-packet-${suffix}`),
    signerKeyId: signer,
    storageReference: store,
    expiresAt: iso(NOW + expiresInDays * DAY),
    immutableStorageVerified: false,
    independentHumanIdentityEstablishedByScript: false,
    cryptographicVerification: "PINNED_CUSTODIAN_SIGNATURE_AND_ORIGINAL_BYTES",
  };
}

function owner(
  suffix,
  {
    decision = "ACCEPT_MONITORING_SLA",
    digest = sha("original SLA"),
    expiresInDays = 50,
    commit = "b".repeat(40),
  } = {},
) {
  return {
    kind: "VERIFIED_OWNER_SLA_DECISION",
    sourceIdentity: {
      commit,
      nonce: `00000000-0000-4000-8000-${String(suffix).padStart(12, "0")}`,
    },
    sourceDigest: digest,
    evidencePacketDigest: sha(`owner-receipt-${suffix}`),
    signerKeyId: "owner-test-only",
    decision,
    expiresAt: iso(NOW + expiresInDays * DAY),
    independentHumanIdentityEstablishedByScript: false,
    cryptographicVerification: "PINNED_OWNER_SIGNATURE_FOR_EXACT_EVIDENCE",
    productionAuthorizationGranted: false,
    commsTestAuthorized: false,
  };
}

function ledgerOf(...registrations) {
  const entries = [];
  for (const registration of registrations)
    entries.push(appendRegistrationEntry(entries, registration, { now: NOW }));
  return entries;
}

function signedAnchor(ledger, { expiresInDays = 7 } = {}) {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const publicKeyPem = publicKey.export({ type: "spki", format: "pem" });
  const claims = prepareAnchorClaims(ledger, {
    keyId: "independent-reviewer",
    now: NOW,
    validDays: expiresInDays,
  });
  const attestation = signAnchorClaims({
    ledger,
    claims,
    privateKeyPem: privateKey.export({ type: "pkcs8", format: "pem" }),
    now: NOW + 1000,
  });
  const pins = {
    schema: "icamp.build215.independent-anchor-pins.v1",
    signers: [
      {
        keyId: claims.keyId,
        role: "ICAMP_INDEPENDENT_LEDGER_ANCHOR_REVIEWER",
        enabled: true,
        publicKeyPem,
        fingerprint: publicKeyFingerprint(publicKeyPem),
      },
    ],
  };
  return { claims, attestation, pins };
}

test("Build 215 protects existing five gates without importing private authority into CI", () => {
  const contract = verifyBuild215CIContract(readBuild206Inputs(), history);
  assert.equal(contract.protectedRequiredChecks, 5);
  assert.equal(contract.workflowCountUnchanged, true);
  const diagnostic = analyzeBuild215Ci({
    aging: { alerts: [{ artifactId: 1 }] },
  });
  assert.equal(diagnostic.originalArtifactAlerts, 1);
  assert.equal(diagnostic.ownerSignedAnchorVerifiedInCI, false);
  assert.equal(diagnostic.commsTestAuthorized, false);
});

test("Build 215 verifies an independently signed pinned ledger head and refuses tampering, unsigned future or reviewer alias", () => {
  const ledger = ledgerOf(archive("one"));
  const packet = signedAnchor(ledger);
  const verified = verifyIndependentAnchor({
    ledger,
    ...packet,
    now: NOW + 1000,
  });
  assert.equal(
    verified.state,
    "SIGNED_CURRENT_LEDGER_HEAD_VERIFIED_NOT_STORAGE_CERTIFIED",
  );
  assert.equal(verified.immutableStorageVerified, false);
  const consumedAnchorIds = new Set();
  verifyIndependentAnchor({
    ledger,
    ...packet,
    now: NOW + 1000,
    consumedAnchorIds,
  });
  assert.throws(
    () =>
      verifyIndependentAnchor({
        ledger,
        ...packet,
        now: NOW + 1000,
        consumedAnchorIds,
      }),
    /REPLAYED/,
  );
  assert.throws(
    () => verifyIndependentAnchor({ ledger, ...packet, now: NOW + 8 * DAY }),
    /EXPIRED/,
  );
  assert.throws(
    () =>
      verifyIndependentAnchor({
        ledger,
        ...packet,
        claims: { ...packet.claims, headHash: sha("forged") },
        now: NOW + 1000,
      }),
    /HEAD_MISMATCH/,
  );
  assert.throws(
    () =>
      verifyIndependentAnchor({
        ledger,
        ...packet,
        pins: {
          ...packet.pins,
          signers: [{ ...packet.pins.signers[0], enabled: false }],
        },
        now: NOW + 1000,
      }),
    /PIN_OR_ROLE/,
  );
  const more = ledgerOf(archive("one"), archive("two"));
  const previous = verifyIndependentAnchor({
    ledger: more,
    ...packet,
    now: NOW + 1000,
  });
  assert.equal(previous.unanchoredLaterEntries, 1);
  assert.equal(
    previous.state,
    "SIGNED_HISTORICAL_PREFIX_VERIFIED_NEW_ENTRIES_UNANCHORED",
  );
  assert.throws(
    () => prepareAnchorClaims([], { keyId: "reviewer", now: NOW }),
    /INVALID/,
  );
});

test("Build 215 quarantines custodian digest conflicts and same-custodian overlaps", () => {
  const good = triageCustodianRenewals(
    ledgerOf(archive("one"), archive("two")),
    NOW,
  );
  assert.equal(
    good.groups[0].state,
    "MULTI_CUSTODIAN_ATTESTATIONS_PRESENT_INDEPENDENCE_UNPROVEN",
  );
  assert.equal(good.actualIndependentStorageVerified, false);
  const conflict = triageCustodianRenewals(
    ledgerOf(
      archive("one"),
      archive("different", { digest: sha("conflicting-original") }),
    ),
    NOW,
  );
  assert.equal(
    conflict.groups[0].state,
    "CONFLICTING_ORIGINAL_IDENTITY_OR_DIGEST_QUARANTINED",
  );
  assert.equal(conflict.conflictsQuarantined, 1);
  const sameSigner = triageCustodianRenewals(
    ledgerOf(archive("one"), archive("two", { signer: "custodian-one" })),
    NOW,
  );
  assert.equal(
    sameSigner.groups[0].state,
    "OVERLAPPING_CUSTODIAN_RENEWALS_MANUAL_REVIEW",
  );
  const sharedStore = triageCustodianRenewals(
    ledgerOf(
      archive("one"),
      archive("two", { store: "offline://private/one" }),
    ),
    NOW,
  );
  assert.equal(
    sharedStore.groups[0].state,
    "SHARED_STORAGE_REFERENCE_INDEPENDENCE_REVIEW",
  );
  const due = triageCustodianRenewals(
    ledgerOf(archive("expiring", { expiresInDays: 3 })),
    NOW,
  );
  assert.equal(due.groups[0].state, "CUSTODY_EXPIRY_OR_RENEWAL_ESCALATION");
});

test("Build 215 escalates expired and contradictory owner SLA decisions without accepting or superseding them", () => {
  const simple = triageOwnerSlaExpiry(ledgerOf(owner(1)), NOW);
  assert.equal(
    simple.decisions[0].state,
    "SIGNED_DECISION_CURRENT_NOT_RELEASE_AUTHORITY",
  );
  const due = triageOwnerSlaExpiry(
    ledgerOf(owner(2, { expiresInDays: 3 })),
    NOW,
  );
  assert.equal(
    due.decisions[0].state,
    "OWNER_SLA_RECEIPT_EXPIRES_WITHIN_14_DAYS",
  );
  const expired = triageOwnerSlaExpiry(
    ledgerOf(owner(3, { expiresInDays: 1 })),
    NOW + 2 * DAY,
  );
  assert.equal(
    expired.decisions[0].state,
    "OWNER_SIGNED_RECEIPT_EXPIRED_RENEWAL_REQUIRED",
  );
  const conflict = triageOwnerSlaExpiry(
    ledgerOf(owner(1), owner(2, { decision: "REJECT_MONITORING_SLA" })),
    NOW,
  );
  assert.equal(
    conflict.decisions[0].state,
    "CONFLICTING_OR_REPLAYED_OWNER_DECISIONS_REVIEW_REQUIRED",
  );
  assert.equal(conflict.automaticSlaAcceptance, false);
  assert.equal(conflict.productionApprovalGranted, false);
});
