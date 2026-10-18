import {
  assertPrivilegedActionControl,
  normalizePrivilegedReason,
} from "../audit/privileged.mjs";

export const MANUAL_GATE_OVERRIDE_RATE_LIMIT = Object.freeze({
  maxCommands: 3,
  windowSeconds: 60,
});

const COMMANDS = new Set(["open", "close"]);
const SOURCE_CHANNELS = new Set(["web", "staff", "ivr", "sms"]);

export function permissionForGateCommand(command) {
  if (command === "open") return "gate.override.open";
  if (command === "close") return "gate.override.close";
  throw new Error("Unsupported gate override command");
}

export function capabilityForGateCommand(command) {
  if (command === "open") return "remote_open";
  if (command === "close") return "remote_close";
  throw new Error("Unsupported gate override command");
}

export function normalizeGateOverrideInput(input) {
  const command = String(input.command ?? "").trim().toLowerCase();
  if (!COMMANDS.has(command)) {
    throw new Error("Unsupported gate override command");
  }

  const sourceChannel = String(input.sourceChannel ?? "web").trim().toLowerCase();
  if (!SOURCE_CHANNELS.has(sourceChannel)) {
    throw new Error("Unsupported gate override source channel");
  }

  const requestId = String(input.requestId ?? "").trim();
  if (requestId.length < 8 || requestId.length > 160) {
    throw new Error("requestId must be 8-160 characters");
  }

  const privileged = assertPrivilegedActionControl({
    riskLevel: "high",
    reason: normalizePrivilegedReason(input.reason),
    reauthenticatedAt: input.reauthenticatedAt,
    assuranceLevel: input.assuranceLevel,
  });

  return {
    command,
    permission: permissionForGateCommand(command),
    requiredCapability: capabilityForGateCommand(command),
    reason: privileged.reason,
    reauthenticatedAt: privileged.reauthenticatedAt.toISOString(),
    assuranceLevel: privileged.assuranceLevel,
    sourceChannel,
    requestId,
  };
}

export function normalizeGateProviderOutcome(input) {
  const allowed = new Set([
    "dispatched",
    "succeeded",
    "failed",
    "rejected",
    "timeout",
    "unsupported",
  ]);

  const outcome = String(input.outcome ?? "").trim().toLowerCase();
  if (!allowed.has(outcome)) {
    throw new Error("Unsupported gate provider outcome");
  }

  const optionalText = (value, max, label) => {
    if (value == null || value === "") return null;
    const result = String(value).trim();
    if (!result || result.length > max) {
      throw new Error(`${label} must be 1-${max} characters`);
    }
    return result;
  };

  return {
    outcome,
    providerCommandReference: optionalText(
      input.providerCommandReference,
      240,
      "providerCommandReference",
    ),
    providerStatus: optionalText(input.providerStatus, 120, "providerStatus"),
    providerMessage: optionalText(input.providerMessage, 500, "providerMessage"),
    providerMetadata: input.providerMetadata ?? {},
  };
}

export function assertDeviceSupportsGateCommand(device, command) {
  if (!device?.isActive) {
    throw new Error("Inactive access devices cannot receive manual overrides");
  }

  const requiredCapability = capabilityForGateCommand(command);
  if (!Array.isArray(device.capabilities) || !device.capabilities.includes(requiredCapability)) {
    throw new Error(`Access device does not support ${requiredCapability}`);
  }

  return requiredCapability;
}
