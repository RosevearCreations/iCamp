import { FULFILLMENT_PRIORITY_FILTERS } from "./fulfillment-priority-core.mjs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

export function validateSavedPriorityView({ label, filter }) {
  const name = String(label ?? "")
    .trim()
    .replace(/\s+/gu, " ");
  if (name.length < 2 || name.length > 48) {
    throw new Error("Name the view using 2–48 characters.");
  }
  if (!Object.hasOwn(FULFILLMENT_PRIORITY_FILTERS, String(filter ?? ""))) {
    throw new Error("Choose a supported priority filter.");
  }
  return { label: name, filter: String(filter) };
}

export function validateCaseOwnership({
  dispatchId,
  previousEventId,
  intent,
  note,
}) {
  if (!UUID.test(String(dispatchId ?? "")))
    throw new Error("Choose a recorded dispatch.");
  const previous = String(previousEventId ?? "").trim();
  if (previous && !UUID.test(previous))
    throw new Error("Ownership changed. Refresh the case.");
  if (!["claim", "release"].includes(intent))
    throw new Error("Choose claim or release.");
  const reason = String(note ?? "").trim();
  if (reason.length < 5 || reason.length > 300) {
    throw new Error("Give an ownership reason of 5–300 characters.");
  }
  return {
    dispatchId: String(dispatchId),
    previousEventId: previous || null,
    intent,
    note: reason,
  };
}

export function validateMobileFieldReport({
  dispatchId,
  deviceKind,
  outcome,
  note,
}) {
  if (!UUID.test(String(dispatchId ?? "")))
    throw new Error("Choose your current dispatch.");
  if (!["mobile", "tablet", "desktop"].includes(deviceKind)) {
    throw new Error("Choose the device class used in the field.");
  }
  if (!["usable", "blocked"].includes(outcome)) {
    throw new Error("Report whether the worker task could be used.");
  }
  const observation = String(note ?? "").trim();
  if (observation.length < 5 || observation.length > 300) {
    throw new Error("Describe the device observation in 5–300 characters.");
  }
  return {
    dispatchId: String(dispatchId),
    deviceKind,
    outcome,
    note: observation,
  };
}

export function fieldAcceptanceLabel(report) {
  if (!report) return "No worker device evidence received";
  return report.outcome === "blocked"
    ? "Worker-reported blocker · independent acceptance HOLD"
    : "Worker-reported usable · independent acceptance HOLD";
}
