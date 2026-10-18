import assert from "node:assert/strict";
import test from "node:test";

import {
  effectiveCredentialStatus,
  fingerprintCredentialSecret,
  generateCredentialSecret,
  maskCredentialHint,
  normalizeAccessCredentialInput,
  normalizeCredentialRevocationReason,
} from "../lib/access-credentials/core.mjs";

test("Build 056 normalizes provider-neutral physical credentials", () => {
  const value = normalizeAccessCredentialInput({
    credentialType: "key_card",
    subjectKind: "reservation",
    subjectReferenceId: "res-1",
    subjectLabel: "Reservation R-100",
    providerCode: "salto",
    providerCredentialReference: "card-8844",
    validFrom: "2026-10-18T12:00:00Z",
    validUntil: "2026-10-20T12:00:00Z",
  });

  assert.equal(value.credentialType, "key_card");
  assert.equal(value.providerCode, "salto");
  assert.equal(value.secretFingerprint, null);
});

test("Build 056 fingerprints digital secrets without retaining raw values", () => {
  const secret = "739184";
  const value = normalizeAccessCredentialInput({
    credentialType: "keypad_pin",
    subjectKind: "visitor",
    subjectLabel: "Visitor",
    rawSecret: secret,
  });

  assert.equal(value.secretFingerprint, fingerprintCredentialSecret(secret));
  assert.notEqual(value.secretFingerprint, secret);
  assert.equal(value.displayHint, maskCredentialHint(secret));
});

test("Build 056 rejects missing digital secrets and split provider references", () => {
  assert.throws(
    () =>
      normalizeAccessCredentialInput({
        credentialType: "qr_pass",
        subjectKind: "guest",
        subjectLabel: "Guest",
      }),
    /require credential secret material/u,
  );

  assert.throws(
    () =>
      normalizeAccessCredentialInput({
        credentialType: "fob",
        subjectKind: "guest",
        subjectLabel: "Guest",
        providerCode: "vendor",
      }),
    /supplied together/u,
  );
});

test("Build 056 reports scheduled, active, expired and revoked states", () => {
  const now = new Date("2026-10-18T12:00:00Z");
  assert.equal(
    effectiveCredentialStatus({
      status: "active",
      validFrom: "2026-10-19T00:00:00Z",
      validUntil: null,
      now,
    }),
    "scheduled",
  );
  assert.equal(
    effectiveCredentialStatus({
      status: "active",
      validFrom: "2026-10-18T00:00:00Z",
      validUntil: "2026-10-19T00:00:00Z",
      now,
    }),
    "active",
  );
  assert.equal(
    effectiveCredentialStatus({
      status: "active",
      validFrom: "2026-10-17T00:00:00Z",
      validUntil: "2026-10-18T00:00:00Z",
      now,
    }),
    "expired",
  );
  assert.equal(
    effectiveCredentialStatus({
      status: "revoked",
      validFrom: "2026-10-17T00:00:00Z",
      validUntil: null,
      now,
    }),
    "revoked",
  );
});

test("Build 056 helper output is bounded", () => {
  assert.ok(generateCredentialSecret().length >= 22);
  assert.equal(\n    normalizeCredentialRevocationReason("lost wristband"),\n    "lost wristband",\n  );
});
