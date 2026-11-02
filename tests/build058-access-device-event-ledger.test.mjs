import assert from "node:assert/strict";
import test from "node:test";

import {
  latestDeviceState,
  normalizeAccessEventInput,
  normalizeDeviceEventInput,
  summarizeAccessOutcome,
} from "../lib/access-events/core.mjs";

test("normalizes state observations without issuing commands", () => {
  const event = normalizeDeviceEventInput({
    deviceId: "device-1",
    eventKind: "state_observed",
    gateState: "open",
    occurredAt: "2026-10-18T04:20:00Z",
    sourceKind: "provider",
    providerEventReference: "evt-100",
  });

  assert.equal(event.gateState, "open");
  assert.equal(event.sourceKind, "provider");
  assert.equal(event.providerEventReference, "evt-100");
});

test("state and health observation events require their observed values", () => {
  assert.throws(
    () =>
      normalizeDeviceEventInput({
        deviceId: "device-1",
        eventKind: "state_observed",
        occurredAt: "2026-10-18T04:20:00Z",
      }),
    /requires gateState/,
  );

  assert.throws(
    () =>
      normalizeDeviceEventInput({
        deviceId: "device-1",
        eventKind: "health_observed",
        occurredAt: "2026-10-18T04:20:00Z",
      }),
    /requires healthState/,
  );
});

test("denied access requires a reason and supports canonical associations", () => {
  const event = normalizeAccessEventInput({
    deviceId: "device-1",
    credentialId: "credential-1",
    guestProfileId: "guest-1",
    roadVehicleRegistrationId: "vehicle-1",
    outcome: "denied",
    deniedReason: "credential expired",
    direction: "entry",
    occurredAt: "2026-10-18T04:21:00Z",
    sourceKind: "provider",
  });

  assert.equal(event.outcome, "denied");
  assert.equal(event.deniedReason, "credential expired");
  assert.equal(event.roadVehicleRegistrationId, "vehicle-1");

  assert.throws(
    () =>
      normalizeAccessEventInput({
        deviceId: "device-1",
        outcome: "denied",
        occurredAt: "2026-10-18T04:21:00Z",
      }),
    /require deniedReason/,
  );
});

test("staff-sourced events require a recorder", () => {
  assert.throws(
    () =>
      normalizeAccessEventInput({
        deviceId: "device-1",
        outcome: "unknown",
        occurredAt: "2026-10-18T04:21:00Z",
        sourceKind: "staff",
      }),
    /require a staff recorder/,
  );
});

test("latestDeviceState derives current state from append-only history", () => {
  const latest = latestDeviceState([
    {
      eventKind: "state_observed",
      gateState: "closed",
      occurredAt: "2026-10-18T04:20:00Z",
    },
    {
      eventKind: "heartbeat",
      occurredAt: "2026-10-18T04:21:00Z",
    },
    {
      eventKind: "state_observed",
      gateState: "open",
      occurredAt: "2026-10-18T04:22:00Z",
    },
  ]);

  assert.equal(latest.gateState, "open");
});

test("summarizeAccessOutcome counts canonical outcomes only", () => {
  assert.deepEqual(
    summarizeAccessOutcome([
      { outcome: "granted" },
      { outcome: "denied" },
      { outcome: "denied" },
      { outcome: "error" },
    ]),
    { granted: 1, denied: 2, error: 1, unknown: 0 },
  );
});
