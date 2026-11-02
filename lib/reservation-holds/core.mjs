import { normalizeAvailabilityWindow } from "../live-availability/core.mjs";

export const HOLD_DURATION_MINUTES = Object.freeze({ minimum: 2, maximum: 60 });

export function normalizeHoldDuration(value) {
  const duration = Number(value);
  if (
    !Number.isInteger(duration) ||
    duration < HOLD_DURATION_MINUTES.minimum ||
    duration > HOLD_DURATION_MINUTES.maximum
  ) {
    throw new Error(
      `Temporary hold duration must be a whole number from ${HOLD_DURATION_MINUTES.minimum} to ${HOLD_DURATION_MINUTES.maximum} minutes.`,
    );
  }
  return duration;
}

export function normalizeHoldKey(value) {
  const holdKey = String(value ?? "").trim();
  if (holdKey.length < 8 || holdKey.length > 160) {
    throw new Error("Temporary hold request key must be 8-160 characters.");
  }
  return holdKey;
}

export function normalizeHoldRequest(input = {}) {
  const window = normalizeAvailabilityWindow(input);
  const accommodationId = String(input.accommodationId ?? "").trim();
  if (!accommodationId) throw new Error("Accommodation is required.");
  return {
    ...window,
    accommodationId,
    holdKey: normalizeHoldKey(input.holdKey),
  };
}

export function mapTemporaryHold(row) {
  return {
    id: row.id,
    campgroundId: row.campground_id,
    accommodationId: row.accommodation_id,
    accommodationCode: row.accommodation_code ?? null,
    accommodationName: row.accommodation_name ?? null,
    arrivalDate: row.arrival_date,
    departureDate: row.departure_date,
    holdState: row.hold_state,
    expiresAt:
      row.expires_at instanceof Date
        ? row.expires_at.toISOString()
        : String(row.expires_at),
    holdKey: row.hold_key,
    rowVersion: Number(row.row_version ?? 0),
  };
}

export function temporaryHoldErrorCode(error) {
  const message = String(error?.message ?? "");
  if (message.includes("ICAMP_HOLD_KEY_REUSED")) return "ICAMP_HOLD_KEY_REUSED";
  if (message.includes("active reservation"))
    return "ICAMP_HOLD_CONFLICT_RESERVATION";
  if (message.includes("active temporary hold"))
    return "ICAMP_HOLD_CONFLICT_HOLD";
  if (message.includes("active seasonal assignment"))
    return "ICAMP_HOLD_CONFLICT_SEASONAL";
  if (message.includes("management closure or hold"))
    return "ICAMP_HOLD_CONFLICT_RESTRICTION";
  if (message.includes("unresolved cottage turnover"))
    return "ICAMP_HOLD_CONFLICT_TURNOVER";
  return null;
}
