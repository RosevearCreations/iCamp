import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  credentialSubjectKindForLink,
  credentialTypeForPresentation,
  effectivePassValidationStatus,
  fingerprintPassValidationToken,
  formatQrPassPayload,
  generatePassValidationToken,
  maskPassValidationHint,
  normalizeAccessPassInput,
  parsePassValidationPresentation,
} from "../lib/access-passes/core.mjs";

test("Build 061 generates non-guessable bearer tokens and never needs raw storage", () => {
  const values = new Set(
    Array.from({ length: 32 }, () => generatePassValidationToken()),
  );

  assert.equal(values.size, 32);
  for (const value of values) {
    assert.match(value, /^[A-Za-z0-9_-]{22,128}$/u);
    assert.equal(fingerprintPassValidationToken(value).length, 64);
    assert.notEqual(maskPassValidationHint(value), value);
  }
});

test("Build 061 QR payload round-trips to the same fingerprint", () => {
  const token = generatePassValidationToken();
  const payload = formatQrPassPayload(token);

  assert.equal(parsePassValidationPresentation(payload), token);
  assert.equal(
    fingerprintPassValidationToken(payload),
    fingerprintPassValidationToken(token),
  );
});

test("Build 061 maps presentation and linkage into Build 056 credential types", () => {
  assert.equal(credentialTypeForPresentation("qr_code"), "qr_pass");
  assert.equal(credentialTypeForPresentation("printed_pass"), "printed_pass");
  assert.equal(credentialTypeForPresentation("wristband"), "wristband");
  assert.equal(credentialSubjectKindForLink("visitor"), "visitor");
  assert.equal(credentialSubjectKindForLink("vehicle_pass"), "vehicle");
  assert.equal(credentialSubjectKindForLink("event"), "other");
});

test("Build 061 requires exactly one canonical linkage reference", () => {
  const input = normalizeAccessPassInput({
    presentationKind: "wristband",
    linkKind: "visitor",
    visitorRegistrationId: "00000000-0000-0000-0000-000000000001",
    subjectLabel: "Visitor wristband",
    validFrom: "2026-10-18T12:00:00Z",
    validUntil: "2026-10-18T18:00:00Z",
  });

  assert.equal(input.linkKind, "visitor");
  assert.equal(input.eventReference, null);

  assert.throws(
    () =>
      normalizeAccessPassInput({
        presentationKind: "qr_code",
        linkKind: "event",
        visitorRegistrationId: "00000000-0000-0000-0000-000000000001",
        eventReference: "fall-fair",
        subjectLabel: "Event pass",
        validFrom: "2026-10-18T12:00:00Z",
        validUntil: "2026-10-18T18:00:00Z",
      }),
    /Exactly one pass linkage reference/u,
  );
});

test("Build 061 validation fails closed across time, revocation and source state", () => {
  const base = {
    credentialStatus: "active",
    validFrom: "2026-10-18T12:00:00Z",
    validUntil: "2026-10-18T18:00:00Z",
    now: "2026-10-18T14:00:00Z",
  };

  assert.equal(effectivePassValidationStatus(base), "valid");
  assert.equal(
    effectivePassValidationStatus({ ...base, credentialStatus: "revoked" }),
    "revoked",
  );
  assert.equal(
    effectivePassValidationStatus({
      ...base,
      now: "2026-10-18T11:00:00Z",
    }),
    "not_yet_valid",
  );
  assert.equal(
    effectivePassValidationStatus({
      ...base,
      now: "2026-10-18T19:00:00Z",
    }),
    "expired",
  );
  assert.equal(
    effectivePassValidationStatus({ ...base, sourceActive: false }),
    "source_inactive",
  );
});

test("Build 061 schema stores fingerprints rather than raw validation tokens", () => {
  const sql = fs.readFileSync(
    new URL(
      "../database/migrations/0080_access_passes_wristbands_qr.sql",
      import.meta.url,
    ),
    "utf8",
  );
  const postgres = fs.readFileSync(
    new URL("../lib/access-passes/postgres.mjs", import.meta.url),
    "utf8",
  );

  assert.match(sql, /create table public\.access_passes/u);
  assert.match(sql, /validation_fingerprint/u);
  assert.match(sql, /access_passes_validate_insert/u);
  assert.match(sql, /visitor_registrations_read/u);
  assert.match(sql, /vehicle_passes_read/u);
  assert.match(postgres, /rawValidationTokenStored:\s*false/u);
  assert.match(postgres, /validationTokenReturnedOnce:\s*true/u);
  assert.doesNotMatch(sql, /raw_validation_token|validation_token text/iu);
});
