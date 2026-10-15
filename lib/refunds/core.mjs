export const defaultCancellationRefundPolicy = Object.freeze({
  currencyCode: "CAD",
  freeCancellationDaysBeforeArrival: 7,
  earlyRefundBasisPoints: 10000,
  lateRefundBasisPoints: 0,
  securityDepositRefundBasisPoints: 10000,
  cancellationFeeCents: 0,
  approvalThresholdCents: 25000,
});

function integer(value, label, minimum, maximum) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(label + " is invalid.");
  }
  return parsed;
}

function isoDate(value, label) {
  const normalized = String(value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(normalized)) {
    throw new Error(label + " must use YYYY-MM-DD.");
  }
  const parsed = new Date(normalized + "T00:00:00Z");
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== normalized
  ) {
    throw new Error(label + " is invalid.");
  }
  return normalized;
}

function currencyCode(value) {
  const normalized = String(value ?? "")
    .trim()
    .toUpperCase();
  if (!/^[A-Z]{3}$/u.test(normalized)) {
    throw new Error("Refund currency code is invalid.");
  }
  return normalized;
}

function basisPoints(value, label) {
  return integer(value, label, 0, 10000);
}

function cents(value, label, allowZero = true) {
  return integer(value, label, allowZero ? 0 : 1, 200000000);
}

export function normalizeRefundReason(value) {
  const text = String(value ?? "").trim();
  if (text.length < 3 || text.length > 1000) {
    throw new Error("Refund/adjustment reason must be between 3 and 1000 characters.");
  }
  return text;
}

export function validateCancellationRefundPolicyInput(input = {}) {
  return {
    currencyCode: currencyCode(input.currencyCode ?? "CAD"),
    freeCancellationDaysBeforeArrival: integer(
      input.freeCancellationDaysBeforeArrival,
      "Free-cancellation days",
      0,
      365,
    ),
    earlyRefundBasisPoints: basisPoints(
      input.earlyRefundBasisPoints,
      "Early refund percentage",
    ),
    lateRefundBasisPoints: basisPoints(
      input.lateRefundBasisPoints,
      "Late refund percentage",
    ),
    securityDepositRefundBasisPoints: basisPoints(
      input.securityDepositRefundBasisPoints,
      "Security-deposit refund percentage",
    ),
    cancellationFeeCents: cents(
      input.cancellationFeeCents,
      "Cancellation fee",
    ),
    approvalThresholdCents: cents(
      input.approvalThresholdCents,
      "Approval threshold",
    ),
  };
}

export function daysBeforeArrival(arrivalDate, asOfDate) {
  const arrival = new Date(isoDate(arrivalDate, "Arrival date") + "T00:00:00Z");
  const asOf = new Date(isoDate(asOfDate, "As-of date") + "T00:00:00Z");
  return Math.floor((arrival.getTime() - asOf.getTime()) / 86400000);
}

export function calculateCancellationRefundRecommendation({
  arrivalDate,
  asOfDate,
  policy = defaultCancellationRefundPolicy,
  payments = [],
}) {
  const normalized = validateCancellationRefundPolicyInput({
    ...defaultCancellationRefundPolicy,
    ...policy,
  });
  const days = daysBeforeArrival(arrivalDate, asOfDate);
  const early =
    days >= normalized.freeCancellationDaysBeforeArrival;
  const ordinaryBps = early
    ? normalized.earlyRefundBasisPoints
    : normalized.lateRefundBasisPoints;

  const allocations = payments.map((payment) => {
    const captured = cents(payment.amountCents, "Captured payment", false);
    const alreadyRefunded = cents(
      payment.refundedCents ?? 0,
      "Already refunded amount",
    );
    if (alreadyRefunded > captured) {
      throw new Error("Refunded amount exceeds captured payment.");
    }
    const remainingCents = captured - alreadyRefunded;
    const bps =
      payment.paymentPurpose === "security_deposit"
        ? normalized.securityDepositRefundBasisPoints
        : ordinaryBps;
    return {
      paymentId: String(payment.id),
      paymentPurpose: String(payment.paymentPurpose),
      remainingCents,
      basisPoints: bps,
      recommendedCents: Math.floor((remainingCents * bps) / 10000),
    };
  });

  let feeRemaining = normalized.cancellationFeeCents;
  for (const allocation of allocations) {
    if (
      allocation.paymentPurpose === "security_deposit" ||
      allocation.recommendedCents <= 0 ||
      feeRemaining <= 0
    ) {
      continue;
    }
    const applied = Math.min(allocation.recommendedCents, feeRemaining);
    allocation.recommendedCents -= applied;
    feeRemaining -= applied;
  }

  const capturedRemainingCents = allocations.reduce(
    (sum, item) => sum + item.remainingCents,
    0,
  );
  const recommendedRefundCents = allocations.reduce(
    (sum, item) => sum + item.recommendedCents,
    0,
  );
  const feeAppliedCents =
    normalized.cancellationFeeCents - feeRemaining;

  return {
    daysBeforeArrival: days,
    policyWindow: early ? "early" : "late",
    capturedRemainingCents,
    recommendedRefundCents,
    retainedCents: capturedRemainingCents - recommendedRefundCents,
    feeAppliedCents,
    allocations,
  };
}

export function refundApprovalRequirement({
  amountCents,
  approvalThresholdCents,
  policyRecommendedCents,
  batchRecommendedCents = null,
}) {
  const amount = cents(amountCents, "Refund amount", false);
  const threshold = cents(
    approvalThresholdCents,
    "Approval threshold",
  );
  const recommended = cents(
    policyRecommendedCents,
    "Policy recommended refund",
  );
  const batch =
    batchRecommendedCents == null
      ? amount
      : cents(batchRecommendedCents, "Batch refund amount");

  const exceedsThreshold = batch > threshold;
  const exceedsPolicy = amount > recommended;

  return {
    approvalRequired: exceedsThreshold || exceedsPolicy,
    exceedsThreshold,
    exceedsPolicy,
  };
}

export function refundRemainingCents({
  capturedCents,
  reservedOrRefundedCents = 0,
}) {
  const captured = cents(capturedCents, "Captured amount", false);
  const reserved = cents(
    reservedOrRefundedCents,
    "Reserved/refunded amount",
  );
  if (reserved > captured) {
    throw new Error("Refund reservation exceeds captured amount.");
  }
  return captured - reserved;
}
