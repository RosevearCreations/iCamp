import assert from "node:assert/strict";
import test from "node:test";

import {
  accessDeviceSupports,
  normalizeAccessDeviceInput,
  summarizeAccessDeviceHealth,
} from "../lib/access-devices/core.mjs";

test("normalizes a local gate without provider secrets", () => {
  const device = normalizeAccessDeviceInput({
    deviceCode: "ad-main01",
    displayName: " Main entrance ",
    deviceType: "gate",
    capabilities: ["state_report", "credential_read", "state_report"],
  });

  assert.equal(device.deviceCode, "AD-MAIN01");
  assert.equal(device.integrationMode, "local");
  assert.equal(device.providerCode, null);
  assert.deepEqual(device.capabilities, ["credential_read", "state_report"]);
});

test("provider and hybrid devices require a complete provider mapping", () => {
  assert.throws(
    () =>
      normalizeAccessDeviceInput({
        deviceCode: "AD-GATE01",
        displayName: "Gate",
        deviceType: "gate",
        integrationMode: "provider",
      }),
    /require a provider mapping/,
  );

  assert.throws(
    () =>
      normalizeAccessDeviceInput({
        deviceCode: "AD-GATE01",
        displayName: "Gate",
        deviceType: "gate",
        providerCode: "vendor",
      }),
    /supplied together/,
  );
});

test("accepts provider-neutral hardware mapping and capabilities", () => {
  const device = normalizeAccessDeviceInput({
    deviceCode: "AD-CTRL01",
    displayName: "North controller",
    deviceType: "controller",
    integrationMode: "hybrid",
    providerCode: "example_access",
    providerDeviceReference: "ctrl-8841",
    manufacturer: "Example",
    model: "X1",
    serialNumber: "SN-001",
    zoneReference: "north-entry",
    capabilities: ["remote_open", "remote_close", "state_report"],
    healthState: "healthy",
    healthObservedAt: "2026-10-18T03:30:00Z",
  });

  assert.equal(device.providerDeviceReference, "ctrl-8841");
  assert.equal(device.zoneReference, "north-entry");
  assert.equal(accessDeviceSupports(device, "remote_open"), true);
  assert.equal(accessDeviceSupports(device, "intercom"), false);
});

test("rejects unsupported capabilities and invalid observed health", () => {
  assert.throws(
    () =>
      normalizeAccessDeviceInput({
        deviceCode: "AD-GATE01",
        displayName: "Gate",
        deviceType: "gate",
        capabilities: ["unlock_everything"],
      }),
    /Unsupported access-device capability/,
  );

  assert.throws(
    () =>
      normalizeAccessDeviceInput({
        deviceCode: "AD-GATE01",
        displayName: "Gate",
        deviceType: "gate",
        healthState: "offline",
      }),
    /require healthObservedAt/,
  );
});

test("summarizes health without treating registry state as an event ledger", () => {
  const summary = summarizeAccessDeviceHealth({
    healthState: "maintenance",
    healthObservedAt: "2026-10-18T03:31:00Z",
    isActive: true,
  });

  assert.equal(summary.state, "maintenance");
  assert.equal(summary.isOperational, false);
  assert.equal(summary.observedAt, "2026-10-18T03:31:00.000Z");
});
