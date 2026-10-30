export const PILOT_AREAS = Object.freeze([
  ["front_desk", "Front desk arrival, check-in and departure"],
  ["maintenance", "Maintenance work order, assignment and sign-off"],
  ["access", "Security, gate access and emergency override"],
  ["booking", "Booking, availability, holds and cancellation"],
  ["pos", "Point of sale, rentals and reconciliation"],
  ["devices", "Real device and browser compatibility"],
]);

export const PILOT_STATES = Object.freeze([
  "NOT_TESTED",
  "BLOCKED",
  "FAILED",
  "PASSED_OWNER_REPORTED",
]);

export function blankPilot() {
  return Object.fromEntries(PILOT_AREAS.map(([id]) => [id, "NOT_TESTED"]));
}

export function summarizePilot(input) {
  const results = Object.fromEntries(
    PILOT_AREAS.map(([id]) => [
      id,
      PILOT_STATES.includes(input?.[id]) ? input[id] : "NOT_TESTED",
    ]),
  );
  const counts = Object.fromEntries(
    PILOT_STATES.map((state) => [
      state,
      Object.values(results).filter((value) => value === state).length,
    ]),
  );
  return {
    build: 155,
    fixture: "Camp Rosevear (synthetic, inactive)",
    results,
    counts,
    pilot_acceptance: "NOT_INDEPENDENTLY_VERIFIED",
    public_launch_authorized: false,
    production_activation_authorized: false,
  };
}
