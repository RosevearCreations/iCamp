const GATE_STATES = new Set(["open", "closed", "unknown"]);
const HEALTH_STATES = new Set([
  "unknown",
  "healthy",
  "degraded",
  "offline",
  "maintenance",
  "retired",
]);
const DEVICE_EVENT_KINDS = new Set([
  "state_observed",
  "health_observed",
  "fault",
  "recovered",
  "heartbeat",
]);
const ACCESS_OUTCOMES = new Set(["granted", "denied", "error", "unknown"]);
const DIRECTIONS = new Set(["entry", "exit", "unknown"]);
const SOURCE_KINDS = new Set(["provider", "system", "staff"]);

function optionalTrimmed(value, maxLength, label) {
  if (value == null || value === "") return null;
  const result = String(value).trim();
  if (!result || result.length > maxLength) {
    throw new Error(`${label} must be between 1 and ${maxLength} characters`);
  }
  return result;
}

function requiredDate(value, label) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${label} must be a valid date`);
  }
  return parsed.toISOString();
}

function normalizeSource(input) {
  const sourceKind = String(input.sourceKind ?? "provider");
  if (!SOURCE_KINDS.has(sourceKind)) {
    throw new Error("Unsupported sourceKind");
  }
  if (sourceKind === "staff" && !input.actorUserId && !input.recordedByUserId) {
    throw new Error("Staff-sourced events require a staff recorder");
  }
  return sourceKind;
}

export function normalizeDeviceEventInput(input) {
  const eventKind = String(input.eventKind ?? "");
  if (!DEVICE_EVENT_KINDS.has(eventKind)) {
    throw new Error("Unsupported device event kind");
  }

  const gateState = input.gateState == null ? null : String(input.gateState);
  if (gateState && !GATE_STATES.has(gateState)) {
    throw new Error("Unsupported gateState");
  }
  if (eventKind === "state_observed" && !gateState) {
    throw new Error("state_observed requires gateState");
  }

  const healthState =
    input.healthState == null ? null : String(input.healthState);
  if (healthState && !HEALTH_STATES.has(healthState)) {
    throw new Error("Unsupported healthState");
  }
  if (eventKind === "health_observed" && !healthState) {
    throw new Error("health_observed requires healthState");
  }

  return {
    deviceId: input.deviceId,
    eventKind,
    gateState,
    healthState,
    providerEventReference: optionalTrimmed(
      input.providerEventReference,
      240,
      "providerEventReference",
    ),
    occurredAt: requiredDate(input.occurredAt, "occurredAt"),
    sourceKind: normalizeSource(input),
    actorUserId: input.actorUserId ?? null,
    eventMetadata: input.eventMetadata ?? {},
  };
}

export function normalizeAccessEventInput(input) {
  const outcome = String(input.outcome ?? "");
  if (!ACCESS_OUTCOMES.has(outcome)) {
    throw new Error("Unsupported access outcome");
  }

  const deniedReason = optionalTrimmed(input.deniedReason, 500, "deniedReason");
  if (outcome === "denied" && !deniedReason) {
    throw new Error("Denied access events require deniedReason");
  }
  if (outcome !== "denied" && deniedReason) {
    throw new Error("deniedReason is only valid for denied access events");
  }

  const direction = String(input.direction ?? "unknown");
  if (!DIRECTIONS.has(direction)) {
    throw new Error("Unsupported access direction");
  }

  return {
    deviceId: input.deviceId,
    credentialId: input.credentialId ?? null,
    guestProfileId: input.guestProfileId ?? null,
    visitorRegistrationId: input.visitorRegistrationId ?? null,
    roadVehicleRegistrationId: input.roadVehicleRegistrationId ?? null,
    staffUserId: input.staffUserId ?? null,
    outcome,
    deniedReason,
    direction,
    sourceKind: normalizeSource(input),
    providerEventReference: optionalTrimmed(
      input.providerEventReference,
      240,
      "providerEventReference",
    ),
    occurredAt: requiredDate(input.occurredAt, "occurredAt"),
    recordedByUserId: input.recordedByUserId ?? null,
    eventMetadata: input.eventMetadata ?? {},
  };
}

export function latestDeviceState(events) {
  const states = events
    .filter(
      (event) =>
        event.eventKind === "state_observed" &&
        GATE_STATES.has(event.gateState),
    )
    .toSorted(
      (a, b) =>
        new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
    );

  return states[0] ?? null;
}

export function summarizeAccessOutcome(events) {
  return events.reduce(
    (summary, event) => {
      if (ACCESS_OUTCOMES.has(event.outcome)) {
        summary[event.outcome] += 1;
      }
      return summary;
    },
    { granted: 0, denied: 0, error: 0, unknown: 0 },
  );
}
