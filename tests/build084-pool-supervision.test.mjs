import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  normalizePoolPolicy,
  normalizePoolQualification,
  normalizePoolEvent,
} from "../lib/pool-supervision/core.mjs";

const id = () => randomUUID();
test("policy requires exact rule version, bounded local counts and safety instructions", () => {
  const input = {
    id: id(),
    assetId: id(),
    ruleVersionId: id(),
    maximumBathers: "42",
    minimumUnaccompaniedAge: "12",
    minimumSupervisorAge: "18",
    maximumChildrenPerSupervisor: "2",
    minimumLifeguards: "2",
    safetyInstructions:
      "Management-approved local pool operating and emergency guidance.",
  };
  assert.equal(normalizePoolPolicy(input).maximumBathers, 42);
  assert.throws(
    () => normalizePoolPolicy({ ...input, maximumBathers: "0" }),
    /Maximum bathers/,
  );
  assert.throws(
    () => normalizePoolPolicy({ ...input, safetyInstructions: "too short" }),
    /Safety instructions/,
  );
  assert.throws(
    () => normalizePoolPolicy({ ...input, ruleVersionId: "missing" }),
    /UUID/,
  );
});
test("qualification demands independent credential event and future verified expiry", () => {
  const input = {
    id: id(),
    assetId: id(),
    staffUserId: id(),
    decision: "verify",
    credentialReference: "Certificate AB012345",
    expiresAt: "2099-01-01T00:00:00Z",
    decisionNote: "Independently checked credential record.",
  };
  assert.equal(normalizePoolQualification(input).decision, "verify");
  assert.throws(
    () => normalizePoolQualification({ ...input, expiresAt: "2020-01-01" }),
    /future/,
  );
  assert.equal(
    normalizePoolQualification({ ...input, decision: "revoke", expiresAt: "" })
      .expiresAt,
    null,
  );
});
test("admission requires a choice, valid age attestation data and nonnegative bounded counts", () => {
  const input = {
    id: id(),
    assetId: id(),
    policyId: id(),
    kind: "admission_check",
    reservationId: id(),
    batherCount: "22",
    underageCount: "2",
    supervisorCount: "1",
    lifeguardCount: "2",
    supervisionAgesVerified: "yes",
    admitted: "yes",
    reason: "Observed staffing and age verification on site.",
  };
  assert.equal(normalizePoolEvent(input).supervisionAgesVerified, true);
  assert.throws(
    () => normalizePoolEvent({ ...input, underageCount: "24" }),
    /Minors cannot exceed/,
  );
  assert.throws(
    () => normalizePoolEvent({ ...input, admitted: "maybe" }),
    /admission or refusal/,
  );
  assert.throws(
    () =>
      normalizePoolEvent({ ...input, kind: "release", policyId: "missing" }),
    /UUID/,
  );
  const hold = normalizePoolEvent({
    ...input,
    kind: "hold",
    reservationId: "",
    admitted: "",
  });
  assert.equal(hold.reservationId, null);
  assert.equal(hold.admitted, null);
});
