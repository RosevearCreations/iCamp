const DEVICE_TYPES = new Set([
  "gate",
  "door",
  "barrier",
  "controller",
  "reader",
  "keypad",
  "intercom",
  "other",
]);

const INTEGRATION_MODES = new Set(["local", "provider", "hybrid"]);
const HEALTH_STATES = new Set([
  "unknown",
  "healthy",
  "degraded",
  "offline",
  "maintenance",
  "retired",
]);
const CAPABILITIES = new Set([
  "credential_read",
  "state_report",
  "remote_open",
  "remote_close",
  "intercom",
  "vehicle_loop",
  "entry_direction",
  "exit_direction",
]);

function optionalTrimmed(value, maxLength, label) {
  if (value == null || value === "") return null;
  const result = String(value).trim();
  if (!result || result.length > maxLength) {
    throw new Error(`${label} must be between 1 and ${maxLength} characters`);
  }
  return result;
}

export function normalizeAccessDeviceInput(input) {
  const deviceCode = String(input.deviceCode ?? "")\n    .trim()\n    .toUpperCase();
  if (!/^AD-[A-Z0-9]{4,32}$/.test(deviceCode)) {
    throw new Error(\n      "deviceCode must use AD- followed by 4-32 letters or digits",\n    );
  }

  const displayName = optionalTrimmed(input.displayName, 160, "displayName");
  if (!displayName) throw new Error("displayName is required");

  const deviceType = String(input.deviceType ?? "");
  if (!DEVICE_TYPES.has(deviceType)) throw new Error("Unsupported deviceType");

  const integrationMode = String(input.integrationMode ?? "local");
  if (!INTEGRATION_MODES.has(integrationMode)) {
    throw new Error("Unsupported integrationMode");
  }

  const providerCode = optionalTrimmed(input.providerCode, 64, "providerCode");
  if (providerCode && !/^[a-z][a-z0-9_-]{1,63}$/.test(providerCode)) {
    throw new Error("providerCode must be a lowercase provider identifier");
  }
  const providerDeviceReference = optionalTrimmed(
    input.providerDeviceReference,
    240,
    "providerDeviceReference",
  );

  if (Boolean(providerCode) !== Boolean(providerDeviceReference)) {
    throw new Error(
      "providerCode and providerDeviceReference must be supplied together",
    );
  }
  if (integrationMode !== "local" && !providerCode) {
    throw new Error("Provider and hybrid devices require a provider mapping");
  }

  const healthState = String(input.healthState ?? "unknown");
  if (!HEALTH_STATES.has(healthState))\n    throw new Error("Unsupported healthState");

  const healthObservedAt =
    input.healthObservedAt == null || input.healthObservedAt === ""
      ? null
      : new Date(input.healthObservedAt);
  if (healthObservedAt && Number.isNaN(healthObservedAt.getTime())) {
    throw new Error("healthObservedAt must be a valid date");
  }
  if (healthState !== "unknown" && !healthObservedAt) {
    throw new Error("Observed health states require healthObservedAt");
  }

  const capabilities = Array.from(
    new Set((input.capabilities ?? []).map((value) => String(value))),
  ).sort();
  for (const capability of capabilities) {
    if (!CAPABILITIES.has(capability)) {
      throw new Error(`Unsupported access-device capability: ${capability}`);
    }
  }

  return {
    deviceCode,
    displayName,
    deviceType,
    integrationMode,
    locationLabel: optionalTrimmed(input.locationLabel, 240, "locationLabel"),
    zoneReference: optionalTrimmed(input.zoneReference, 80, "zoneReference"),
    parentControllerId: input.parentControllerId ?? null,
    providerCode,
    providerDeviceReference,
    manufacturer: optionalTrimmed(input.manufacturer, 120, "manufacturer"),
    model: optionalTrimmed(input.model, 120, "model"),
    serialNumber: optionalTrimmed(input.serialNumber, 160, "serialNumber"),
    capabilities,
    healthState,
    healthObservedAt: healthObservedAt?.toISOString() ?? null,
    isActive: input.isActive !== false,
  };
}

export function accessDeviceSupports(device, capability) {
  if (!CAPABILITIES.has(capability)) return false;
  return new Set(device.capabilities ?? []).has(capability);
}

export function summarizeAccessDeviceHealth(device, now = new Date()) {
  const state = HEALTH_STATES.has(device.healthState)
    ? device.healthState
    : "unknown";
  const observed =
    device.healthObservedAt == null ? null : new Date(device.healthObservedAt);

  return {
    state,
    observedAt:
      observed && !Number.isNaN(observed.getTime())
        ? observed.toISOString()
        : null,
    isOperational:
      device.isActive !== false &&
      !["offline", "maintenance", "retired"].includes(state),
    evaluatedAt: now.toISOString(),
  };
}
