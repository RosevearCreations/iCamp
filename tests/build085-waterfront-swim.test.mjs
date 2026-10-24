import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  normalizeWaterfrontZone,
  normalizeWaterfrontTraining,
  normalizeWaterfrontEvent,
} from "../lib/waterfront-swim/core.mjs";

const id = () => randomUUID();
const policy = () => ({
  id: id(),
  assetId: id(),
  zoneCode: "NORTH_SWIM",
  zoneName: "North beach swimming",
  boundaryDescription:
    "Marked buoys from the north dock to the posted shallow-water boundary.",
  operatingDays: ["1", "2", "6", "7"],
  openTime: "09:00",
  closeTime: "19:00",
  maximumSwimmers: "35",
  minimumUnaccompaniedAge: "12",
  minimumSupervisorAge: "18",
  maximumChildrenPerSupervisor: "2",
  ruleVersionId: id(),
  hazardInstructions:
    "Check current weather, water quality and rescue staffing before every admission.",
});
const training = () => ({
  id: id(),
  assetId: id(),
  staffUserId: id(),
  decision: "verify",
  trainingReference: "Certificate 0825-BEACH",
  expiresAt: "2099-01-01T00:00:00Z",
  note: "Independently verified with the original training record.",
});
const admission = () => ({
  id: id(),
  assetId: id(),
  zoneCode: "NORTH_SWIM",
  zoneVersionId: id(),
  kind: "entry_check",
  reservationId: id(),
  swimmerCount: "22",
  underageCount: "3",
  supervisorCount: "2",
  admitted: "yes",
  agesVerified: "yes",
  hazardLevel: "normal",
  note: "Observed safe conditions and checked guest rules and supervision on site.",
});

test("zone codes, local operating windows, swimming ages, ratios and rule version are validated", () => {
  const normal = normalizeWaterfrontZone(policy());
  assert.deepEqual(normal.operatingDays, [1, 2, 6, 7]);
  assert.equal(normal.maximumSwimmers, 35);
  assert.throws(
    () => normalizeWaterfrontZone({ ...policy(), zoneCode: "!" }),
    /Zone code/,
  );
  assert.throws(
    () => normalizeWaterfrontZone({ ...policy(), operatingDays: [] }),
    /operating day/,
  );
  assert.throws(
    () => normalizeWaterfrontZone({ ...policy(), operatingDays: ["8"] }),
    /Operating day/,
  );
  assert.throws(
    () => normalizeWaterfrontZone({ ...policy(), closeTime: "08:00" }),
    /later the same day/,
  );
  assert.throws(
    () =>
      normalizeWaterfrontZone({
        ...policy(),
        maximumChildrenPerSupervisor: "0",
      }),
    /Children per supervisor/,
  );
  assert.throws(
    () => normalizeWaterfrontZone({ ...policy(), ruleVersionId: "bad" }),
    /UUID/,
  );
  assert.throws(
    () =>
      normalizeWaterfrontZone({
        ...policy(),
        boundaryDescription: "too short",
      }),
    /Physical zone boundary/,
  );
});

test("independent staff training needs source evidence and future expiry", () => {
  assert.equal(normalizeWaterfrontTraining(training()).decision, "verify");
  assert.throws(
    () =>
      normalizeWaterfrontTraining({ ...training(), expiresAt: "2020-01-01" }),
    /future/,
  );
  assert.throws(
    () =>
      normalizeWaterfrontTraining({ ...training(), trainingReference: "?" }),
    /Training reference/,
  );
  assert.equal(
    normalizeWaterfrontTraining({
      ...training(),
      decision: "revoke",
      expiresAt: "",
    }).expiresAt,
    null,
  );
  assert.throws(
    () => normalizeWaterfrontTraining({ ...training(), decision: "other" }),
    /Invalid training/,
  );
});

test("admission cannot bypass guest identity, age attestation or current hazard classification", () => {
  const verified = normalizeWaterfrontEvent(admission());
  assert.equal(verified.admitted, true);
  assert.equal(verified.agesVerified, true);
  assert.throws(
    () => normalizeWaterfrontEvent({ ...admission(), reservationId: "" }),
    /Reservation/,
  );
  assert.throws(
    () => normalizeWaterfrontEvent({ ...admission(), hazardLevel: "unknown" }),
    /hazard level/,
  );
  assert.throws(
    () => normalizeWaterfrontEvent({ ...admission(), admitted: "maybe" }),
    /admission\/refusal/,
  );
  assert.throws(
    () => normalizeWaterfrontEvent({ ...admission(), underageCount: "23" }),
    /Underage swimmers/,
  );
});

test("incident, emergency closure and independently evidenced reopening stay distinct", () => {
  const original = admission();
  const closure = normalizeWaterfrontEvent({
    ...original,
    kind: "closure",
    reservationId: "",
    hazardType: "water_quality",
    note: "Staff closed swimming after a visibly unsafe water quality notice.",
  });
  assert.equal(closure.hazardType, "water_quality");
  assert.equal(closure.admitted, null);
  assert.equal(closure.reservationId, null);
  assert.throws(
    () =>
      normalizeWaterfrontEvent({
        ...original,
        kind: "incident",
        hazardType: "?",
      }),
    /hazard category/,
  );
  assert.throws(
    () =>
      normalizeWaterfrontEvent({
        ...original,
        kind: "reopen",
        evidenceReference: "",
      }),
    /source evidence reference/,
  );
  assert.equal(
    normalizeWaterfrontEvent({
      ...original,
      kind: "reopen",
      reservationId: "",
      evidenceReference: "Lab clearance record 142-A",
    }).kind,
    "reopen",
  );
  assert.equal(
    normalizeWaterfrontEvent({
      ...original,
      kind: "reopen_request",
      reservationId: "",
    }).kind,
    "reopen_request",
  );
});
