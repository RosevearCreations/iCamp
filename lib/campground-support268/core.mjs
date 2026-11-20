// Build 268 — pure decision engine. Never charges cards, reserves inventory or sends mail.
export const BOOKING_RECOVERY_STAGES268 = Object.freeze([
  "SOURCE_MISSING", "PAYMENT_SHORTFALL", "PROVIDER_RECONCILIATION_REQUIRED",
  "HOLD_OR_SITE_REVIEW", "CONFIRMATION_MISSING",
  "DELIVERY_RETRY_REQUIRED", "RECEIPT_MISSING", "RECOVERED",
]);
export function classifyMissingConfirmation268(input) {
  const x = input ?? {};
  if (!x.originalReservation || !Number.isSafeInteger(x.bookingDueCents) ||
      !Number.isSafeInteger(x.capturedCents) || x.bookingDueCents < 0 ||
      x.capturedCents < 0) return "SOURCE_MISSING";
  if (x.capturedCents < x.bookingDueCents) return "PAYMENT_SHORTFALL";
  // An application-row captured event is not an independently verified provider settlement.
  if (x.providerReconciled !== true) return "PROVIDER_RECONCILIATION_REQUIRED";
  if (x.holdExpired === true || x.siteConflict === true)
    return "HOLD_OR_SITE_REVIEW";
  if (x.reservationStatus !== "confirmed" || !x.confirmationExists)
    return "CONFIRMATION_MISSING";
  if (x.deliveryState !== "delivered")
    return "DELIVERY_RETRY_REQUIRED";
  if (!x.receiptExists) return "RECEIPT_MISSING";
  return "RECOVERED";
}
export function nextSupportSlaTier268(entry, now = new Date()) {
  const created = new Date(entry?.createdAt);
  if (Number.isNaN(created.valueOf()) || !(now instanceof Date) ||
      Number.isNaN(now.valueOf()) || created > now) return null;
  if (entry?.status === "resolved" || !entry?.assignedUserId) return null;
  const hours = { critical: 1, priority: 8, routine: 48 }[entry?.severity];
  if (!hours || now.valueOf() - created.valueOf() <= hours * 3600000) return null;
  const reviewed = entry?.reviewedAt ? new Date(entry.reviewedAt) : null;
  if (reviewed && !Number.isNaN(reviewed.valueOf()) &&
      reviewed >= created && reviewed <= now) return null;
  return entry.severity;
}
export const CAMP_ROSEVEAR_REHEARSAL268 = Object.freeze({
  tenant: "Camp Rosevear",
  environment: "rehearsal-only",
  originalReservation: true, bookingDueCents: 12000, capturedCents: 12000,
  providerReconciled: false, holdExpired: false, siteConflict: false,
  reservationStatus: "pending", confirmationExists: false,
  deliveryState: "queued", receiptExists: false,
});
