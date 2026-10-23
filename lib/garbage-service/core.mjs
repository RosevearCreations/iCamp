export const GARBAGE_STREAMS = Object.freeze([
  "garbage",
  "recycling",
  "organics",
]);

export const GARBAGE_SERVICE_MODES = Object.freeze([
  "central_bins",
  "included_site_pickup",
  "scheduled_site_pickup",
  "paid_on_demand",
]);

export const GARBAGE_PICKUP_STATES = Object.freeze([
  "requested",
  "scheduled",
  "in_progress",
  "completed",
  "cancelled",
]);

function choice(value, allowed, name) {
  const result = String(value ?? "")
    .trim()
    .toLowerCase();
  if (!allowed.includes(result)) throw new Error(`Invalid ${name}.`);
  return result;
}

function shortText(value, name, max = 500) {
  const result = String(value ?? "").trim();
  if (result.length > max) throw new Error(`${name} is too long.`);
  return result || null;
}

export function normalizeGarbagePolicy(input) {
  const mode = choice(input?.mode, GARBAGE_SERVICE_MODES, "service mode");
  const stream = choice(input?.stream, GARBAGE_STREAMS, "waste stream");
  const feeCents = Number(input?.feeCents ?? 0);
  if (!Number.isSafeInteger(feeCents) || feeCents < 0 || feeCents > 1000000) {
    throw new Error("Fee must be a valid nonnegative amount in cents.");
  }
  if (mode !== "paid_on_demand" && feeCents !== 0) {
    throw new Error("Only paid on-demand pickup may carry a configured fee.");
  }
  if (mode === "paid_on_demand" && feeCents === 0) {
    throw new Error("Paid on-demand pickup requires a nonzero fee.");
  }
  const weekday =
    input?.weekday == null || input.weekday === ""
      ? null
      : Number(input.weekday);
  if (
    weekday !== null &&
    (!Number.isInteger(weekday) || weekday < 0 || weekday > 6)
  ) {
    throw new Error("Pickup weekday must be Sunday (0) through Saturday (6).");
  }
  if (mode === "scheduled_site_pickup" && weekday === null) {
    throw new Error("Scheduled pickup needs a weekday.");
  }
  if (mode !== "scheduled_site_pickup" && weekday !== null) {
    throw new Error("A pickup weekday is only valid for scheduled pickup.");
  }
  return {
    mode,
    stream,
    feeCents,
    weekday,
    instructions: shortText(input?.instructions, "Service instructions", 1000),
    locationDescription: shortText(
      input?.locationDescription,
      "Bin location",
      240,
    ),
    isEnabled: input?.isEnabled !== false,
  };
}

export function normalizeGarbagePickup(input) {
  const stream = choice(input?.stream, GARBAGE_STREAMS, "waste stream");
  const mode = choice(input?.mode, GARBAGE_SERVICE_MODES, "pickup mode");
  if (mode === "central_bins") {
    throw new Error(
      "Central bins are self-service and do not create pickup requests.",
    );
  }
  const note = shortText(input?.note, "Pickup note", 1000);
  const clientRequestId = String(input?.clientRequestId ?? "").trim();
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      clientRequestId,
    )
  ) {
    throw new Error("A valid pickup request ID is required for safe retries.");
  }
  return { mode, stream, note, clientRequestId };
}

export function nextGarbagePickupState(current, next) {
  const transitions = {
    requested: ["scheduled", "cancelled"],
    scheduled: ["in_progress", "cancelled"],
    in_progress: ["completed", "cancelled"],
    completed: [],
    cancelled: [],
  };
  if (!transitions[current]?.includes(next)) {
    throw new Error(`Cannot move pickup from ${current} to ${next}.`);
  }
  return next;
}
