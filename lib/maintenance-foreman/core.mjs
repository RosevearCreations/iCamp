export const maintenanceResponsibilityLevels = Object.freeze([
  "crew",
  "foreman",
  "main_foreman",
  "manager",
]);

export const maintenanceEscalationTriggers = Object.freeze([
  "emergency_priority",
  "urgent_priority",
  "blocked",
  "response_overdue",
  "completion_overdue",
]);

export const maintenanceEscalationStates = Object.freeze([
  "open",
  "acknowledged",
  "resolved",
]);

function clean(value) {
  return String(value ?? "").trim();
}

export function validateMaintenanceResponsibilityLevel(value) {
  const level = clean(value);
  if (!maintenanceResponsibilityLevels.includes(level)) {
    throw new Error("Maintenance responsibility level is invalid.");
  }
  return level;
}

export function validateMaintenanceEscalationTrigger(value) {
  const trigger = clean(value);
  if (!maintenanceEscalationTriggers.includes(trigger)) {
    throw new Error("Maintenance escalation trigger is invalid.");
  }
  return trigger;
}

export function validateMaintenanceEscalationState(value) {
  const state = clean(value);
  if (!maintenanceEscalationStates.includes(state)) {
    throw new Error("Maintenance escalation state is invalid.");
  }
  return state;
}

export function validateEscalationThresholdMinutes(value) {
  const minutes = Number(value);
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > 43_200) {
    throw new Error(
      "Escalation threshold must be a whole number from 0 to 43,200 minutes.",
    );
  }
  return minutes;
}

export function validateEscalationNote(value, { required = false } = {}) {
  const note = clean(value);
  if (!note) {
    if (required) {
      throw new Error("Escalation note is required.");
    }
    return null;
  }
  if (note.length > 2000) {
    throw new Error("Escalation note must be 2,000 characters or fewer.");
  }
  return note;
}

export function responsibilityRank(level) {
  return maintenanceResponsibilityLevels.indexOf(
    validateMaintenanceResponsibilityLevel(level),
  ) + 1;
}

export function mayAssignResponsibility(actorLevel, targetLevel) {
  const actorRank = responsibilityRank(actorLevel);
  const targetRank = responsibilityRank(targetLevel);

  if (actorRank < 2) {
    return false;
  }
  if (actorRank >= 4) {
    return true;
  }
  return targetRank < actorRank;
}

export function deriveEscalationSignals(workOrder, policies, referenceTime) {
  const now = new Date(referenceTime).getTime();
  const byTrigger = new Map(
    policies
      .filter((policy) => policy.isActive)
      .map((policy) => [policy.triggerKey, policy]),
  );
  const result = [];

  const add = (triggerKey, active, baseTime) => {
    const policy = byTrigger.get(triggerKey);
    if (!policy || !active) {
      return;
    }
    const threshold = Number(policy.thresholdMinutes) * 60_000;
    const eligibleAt =
      baseTime == null ? now : new Date(baseTime).getTime() + threshold;
    if (now < eligibleAt) {
      return;
    }
    result.push({
      triggerKey,
      targetLevel: policy.targetLevel,
      thresholdMinutes: Number(policy.thresholdMinutes),
      eligibleAt: new Date(eligibleAt).toISOString(),
    });
  };

  add(
    "emergency_priority",
    workOrder.priorityKey === "emergency",
    workOrder.createdAt,
  );
  add(
    "urgent_priority",
    workOrder.priorityKey === "urgent",
    workOrder.createdAt,
  );
  add("blocked", workOrder.status === "blocked", workOrder.updatedAt);
  add(
    "response_overdue",
    workOrder.respondedAt == null &&
      !["completed", "cancelled"].includes(workOrder.status),
    workOrder.responseDueAt,
  );
  add(
    "completion_overdue",
    !["completed", "cancelled"].includes(workOrder.status),
    workOrder.completionDueAt,
  );

  return result;
}

export function formatMaintenanceResponsibility(level) {
  return validateMaintenanceResponsibilityLevel(level)
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatEscalationTrigger(trigger) {
  return validateMaintenanceEscalationTrigger(trigger)
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
