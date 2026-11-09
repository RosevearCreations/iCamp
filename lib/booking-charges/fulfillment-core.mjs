export const SERVICE_WINDOWS = Object.freeze([
  "anytime",
  "morning",
  "afternoon",
  "evening",
]);

const nextStates = Object.freeze({
  queued: ["scheduled", "blocked"],
  scheduled: ["in_progress", "blocked"],
  in_progress: ["completed", "blocked"],
  blocked: ["scheduled"],
  completed: [],
});

export function normalizeDailyCapacity(value) {
  if (value === null || value === undefined || String(value).trim() === "")
    return null;
  if (!/^[1-9][0-9]*$/u.test(String(value).trim())) {
    throw new Error("Daily capacity must be a whole number of units.");
  }
  const capacity = Number(value);
  if (!Number.isSafeInteger(capacity) || capacity > 10000) {
    throw new Error("Daily capacity must be between 1 and 10000.");
  }
  return capacity;
}

export function assertDailyCapacity({ capacity, used, requested }) {
  if (capacity === null || capacity === undefined) return;
  if (
    !Number.isSafeInteger(Number(used)) ||
    Number(used) < 0 ||
    !Number.isSafeInteger(Number(requested)) ||
    Number(requested) < 0
  ) {
    throw new Error("Service allocation quantity is invalid.");
  }
  if (Number(used) + Number(requested) > capacity) {
    const error = new Error("ICAMP_SERVICE_CAPACITY_EXCEEDED");
    error.code = "ICAMP_SERVICE_CAPACITY_EXCEEDED";
    throw error;
  }
}

export function validateFulfillmentUpdate({
  currentState,
  nextState,
  serviceDate,
  arrivalDate,
  departureDate,
  serviceWindow,
  staffNote,
}) {
  if (!nextStates[currentState]?.includes(nextState)) {
    throw new Error("This fulfillment state transition is not permitted.");
  }
  const date = String(serviceDate ?? "");
  const parsed = new Date(date + "T00:00:00Z");
  if (
    !/^\d{4}-\d{2}-\d{2}$/u.test(date) ||
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== date ||
    date < arrivalDate ||
    date >= departureDate
  ) {
    throw new Error("Service date must fall within the reserved stay.");
  }
  if (!SERVICE_WINDOWS.includes(serviceWindow))
    throw new Error("Invalid service window.");
  const note = String(staffNote ?? "").trim();
  if (note.length > 500) throw new Error("Staff note is too long.");
  return {
    nextState,
    serviceDate: date,
    serviceWindow,
    staffNote: note || null,
  };
}
