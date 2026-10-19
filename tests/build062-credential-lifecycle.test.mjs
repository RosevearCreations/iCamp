import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  classifyCredentialValidityChange,
  credentialNeedsGeneratedSecret,
  normalizeCredentialLifecycleReason,
  normalizeReservationCredentialProvisionInput,
} from "../lib/access-credential-lifecycle/core.mjs";

test("Build 062 normalizes reservation credential provisioning", () => {
  const value = normalizeReservationCredentialProvisionInput({
    credentialType: "wristband",
    subjectLabel: "Site 14 wristband",
  });

  assert.equal(value.credentialType, "wristband");
  assert.equal(value.syncWithStay, true);
  assert.equal(value.providerCode, null);
});

test("Build 062 isolates provider references from local credentials", () => {
  assert.throws(
    () =>
      normalizeReservationCredentialProvisionInput({
        credentialType: "key_card",
        subjectLabel: "Cabin key card",
        providerCode: "gate_vendor",
        providerCredentialReference: "abc",
      }),
    /only allowed for provider-reference/u,
  );

  const provider = normalizeReservationCredentialProvisionInput({
    credentialType: "provider_reference",
    subjectLabel: "Vendor credential",
    providerCode: "gate_vendor",
    providerCredentialReference: "credential-123",
  });

  assert.equal(provider.providerCode, "gate_vendor");
});

test("Build 062 classifies stay-synchronized validity changes", () => {
  assert.equal(
    classifyCredentialValidityChange(
      "2026-10-20T15:00:00Z",
      "2026-10-21T15:00:00Z",
    ),
    "validity_extended",
  );
  assert.equal(
    classifyCredentialValidityChange(
      "2026-10-21T15:00:00Z",
      "2026-10-20T15:00:00Z",
    ),
    "validity_shortened",
  );
  assert.equal(
    classifyCredentialValidityChange(
      "2026-10-20T15:00:00Z",
      "2026-10-20T15:00:00Z",
    ),
    "unchanged",
  );
});

test("Build 062 identifies credential types that need generated bearer secrets", () => {
  assert.equal(credentialNeedsGeneratedSecret("qr_pass"), true);
  assert.equal(credentialNeedsGeneratedSecret("keypad_pin"), true);
  assert.equal(credentialNeedsGeneratedSecret("key_card"), false);
});

test("Build 062 requires meaningful lifecycle reasons", () => {
  assert.equal(
    normalizeCredentialLifecycleReason("Guest reported wristband lost"),
    "Guest reported wristband lost",
  );
  assert.throws(() => normalizeCredentialLifecycleReason("x"), /at least 3/u);
});

test("Build 062 schema and service preserve canonical lifecycle boundaries", () => {
  const sql = fs.readFileSync(
    new URL(
      "../database/migrations/0081_credential_lifecycle_checkin_checkout.sql",
      import.meta.url,
    ),
    "utf8",
  );
  const service = fs.readFileSync(
    new URL("../lib/access-credential-lifecycle/postgres.mjs", import.meta.url),
    "utf8",
  );

  assert.match(
    sql,
    /create table public\.reservation_access_credential_assignments/u,
  );
  assert.match(sql, /campground_credential_lifecycle_policies/u);
  assert.match(sql, /validity_extended/u);
  assert.match(sql, /validity_shortened/u);
  assert.match(service, /provisionReservationCredential/u);
  assert.match(service, /syncReservationCredentialValidityWithClient/u);
  assert.match(service, /revokeReservationCredentialsWithClient/u);
  assert.match(service, /replaceLostReservationCredential/u);
  assert.match(service, /generatedSecretStored:\s*false/u);
});


test("Build 062 hooks canonical reservation workflows", () => {
  const checkIn = fs.readFileSync(
    new URL("../lib/front-desk-check-in/postgres.mjs", import.meta.url),
    "utf8",
  );
  const checkOut = fs.readFileSync(
    new URL("../lib/front-desk-check-out/postgres.mjs", import.meta.url),
    "utf8",
  );
  const management = fs.readFileSync(
    new URL("../lib/reservation-management/postgres.mjs", import.meta.url),
    "utf8",
  );

  assert.match(checkIn, /provisionCheckedInReservationCredential/u);
  assert.match(checkOut, /revokeReservationCredentialsWithClient/u);
  assert.match(checkOut, /credentialLifecycleRevokedCount/u);
  assert.match(management, /syncReservationCredentialValidityWithClient/u);
  assert.match(management, /credentialLifecycleExtended/u);
  assert.match(management, /credentialLifecycleShortened/u);
  assert.match(management, /credentialLifecycleRevokedCount/u);
});
