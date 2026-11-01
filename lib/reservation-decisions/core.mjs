import { calculateCancellationRefundRecommendation } from "../refunds/core.mjs";

export const RESERVATION_REVIEW_KINDS = Object.freeze([
  "change_dates",
  "cancellation_review",
]);

const isoDate = /^\d{4}-\d{2}-\d{2}$/u;

export function parseReviewDates(input, today) {
  const arrivalDate = String(input.arrivalDate ?? "").trim();
  const departureDate = String(input.departureDate ?? "").trim();
  for (const date of [arrivalDate, departureDate, today]) {
    if (!isoDate.test(date)) throw new Error("Use YYYY-MM-DD dates.");
    const parsed = new Date(`${date}T00:00:00Z`);
    if (
      Number.isNaN(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== date
    ) {
      throw new Error("Choose real calendar dates.");
    }
  }
  const nights =
    (Date.parse(`${departureDate}T00:00:00Z`) -
      Date.parse(`${arrivalDate}T00:00:00Z`)) /
    86_400_000;
  if (arrivalDate < today || nights < 1 || nights > 90) {
    throw new Error("Choose future dates for between one and 90 nights.");
  }
  return { arrivalDate, departureDate, nights };
}

export function normalizeReviewRequest(input, today) {
  const kind = String(input.kind ?? "").trim();
  if (!RESERVATION_REVIEW_KINDS.includes(kind)) {
    throw new Error("Choose a valid review request.");
  }
  const reason = String(input.reason ?? "").trim();
  if (reason.length < 10 || reason.length > 500) {
    throw new Error("Describe the request in 10–500 characters.");
  }
  const dates =
    kind === "change_dates"
      ? parseReviewDates(input, today)
      : { arrivalDate: null, departureDate: null, nights: null };
  return { kind, reason, ...dates };
}

export function cancellationDecisionPreview({
  stay,
  policy,
  payments,
  pendingRefunds,
  pendingPayments,
}) {
  const status = stay.reservation.status;
  const localDate = stay.reservation.campgroundLocalDate;
  const capturedCents = payments.reduce(
    (sum, payment) => sum + payment.amountCents,
    0,
  );
  const refundedCents = payments.reduce(
    (sum, payment) => sum + payment.refundedCents,
    0,
  );
  const base = {
    status: "review_required",
    reason: null,
    capturedCents,
    refundedCents,
    recommendation: null,
  };
  if (status !== "confirmed") {
    return {
      ...base,
      reason: "This reservation is not in a confirmed pre-arrival state.",
    };
  }
  if (stay.reservation.arrivalDate <= localDate) {
    return { ...base, reason: "Arrival has begun or passed." };
  }
  if (!policy) {
    return { ...base, reason: "No current cancellation policy is configured." };
  }
  if (
    policy.currencyCode !== stay.payment.currencyCode ||
    payments.some((payment) => payment.currencyCode !== policy.currencyCode)
  ) {
    return { ...base, reason: "The source currencies do not match." };
  }
  if (
    stay.payment.financialReviewRequired ||
    pendingRefunds ||
    pendingPayments
  ) {
    return {
      ...base,
      reason:
        "This reservation has an unsettled payment, refund, or financial review.",
    };
  }
  try {
    const recommendation = calculateCancellationRefundRecommendation({
      arrivalDate: stay.reservation.arrivalDate,
      asOfDate: localDate,
      policy,
      payments: payments.map((payment) => ({
        id: payment.id,
        paymentPurpose: payment.paymentPurpose,
        amountCents: payment.amountCents,
        refundedCents: payment.refundedCents,
      })),
    });
    return { ...base, status: "estimated", recommendation };
  } catch {
    return {
      ...base,
      reason: "Captured or refunded amounts could not be reconciled safely.",
    };
  }
}
