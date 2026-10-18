import assert from "node:assert/strict";
import test from "node:test";

import {
  MANUAL_GATE_OVERRIDE_RATE_LIMIT,
  assertDeviceSupportsGateCommand,
  capabilityForGateCommand,
  normalizeGateOverrideInput,
  normalizeGateProviderOutcome,
  permissionForGateCommand,
} from "../lib/access-control/override.mjs";

test("maps open and close to distinct high-risk permissions and capabilities", () => {
  assert.equal(permissionForGateCommand("open"), "gate.override.open");
  assert.equal(permissionForGateCommand("close"), "gate.override.close");
  assert.equal(capabilityForGateCommand("open"), "remote_open");
  assert.equal(capabilityForGateCommand("close"), "remote_close");
});

test("normalizes a high-risk manual override with explicit reason and recent re-auth", () => {
  const now = new Date();
  const result = normalizeGateOverrideInput({
    command: "open",
    reason: "Emergency staff access requested",
    reauthenticatedAt: now,
    assuranceLevel: "aal1",
    requestId: "override-0001",
    sourceChannel: "web",
  });

  assert.equal(result.command, "open");
  assert.equal(result.permission, "gate.override.open");
  assert.equal(result.requiredCapability, "remote_open");
  assert.equal(result.reason, "Emergency staff access requested");
});

test("rejects stale re-authentication for manual override", () => {
  const stale = new Date(Date.now() - 11 * 60 * 1000);

  assert.throws(
    () =>
      normalizeGateOverrideInput({
        command: "close",
        reason: "Secure the vehicle entrance",
        reauthenticatedAt: stale,
        assuranceLevel: "aal1",
        requestId: "override-0002",
      }),
    /Recent re-authentication is required/,
  );
});

test("requires device capability and active state", () => {
  assert.equal(
    assertDeviceSupportsGateCommand(
      { isActive: true, capabilities: ["remote_open"] },
      "open",
    ),
    "remote_open",
  );

  assert.throws(
    () =>
      assertDeviceSupportsGateCommand(
        { isActive: true, capabilities: ["state_report"] },
        "open",
      ),
    /does not support remote_open/,
  );

  assert.throws(
    () =>
      assertDeviceSupportsGateCommand(
        { isActive: false, capabilities: ["remote_close"] },
        "close",
      ),
    /Inactive access devices/,
  );
});

test("normalizes bounded provider outcome evidence", () => {
  const result = normalizeGateProviderOutcome({
    outcome: "succeeded",
    providerCommandReference: "cmd-123",
    providerStatus: "accepted",
    providerMessage: "Barrier acknowledged command",
    providerMetadata: { latencyMs: 120 },
  });

  assert.equal(result.outcome, "succeeded");
  assert.equal(result.providerCommandReference, "cmd-123");
  assert.deepEqual(result.providerMetadata, { latencyMs: 120 });
});

test("rate limit contract is deliberately bounded", () => {
  assert.deepEqual(MANUAL_GATE_OVERRIDE_RATE_LIMIT, {
    maxCommands: 3,
    windowSeconds: 60,
  });
});
