import assert from "node:assert/strict";
import test from "node:test";

import {
  calculatePaymentProgress,
  calculateReservationPaymentSchedule,
  moneyInputToCents,
  percentInputToBasisPoints,
  validatePaymentPolicyInput,
} from "../lib/payments/core.mjs";
import {
  createMockPaymentProvider,
  normalizeMockPaymentWebhook,
  signMockPaymentWebhook,
  verifyPaymentWebhookSignature,
} from "../lib/payments/provider.mjs";

test("Build 042 parses money and percentage policy inputs", () => {
  assert.equal(moneyInputToCents("125.50"), 12550);
  assert.equal(percentInputToBasisPoints("25"), 2500);

  const policy = validatePaymentPolicyInput({
    depositMode: "percentage",
    depositPercentageBasisPoints: 2500,
    securityDepositCents: 5000,
    securityDepositDueStage: "with_balance",
    balanceDueMode: "days_before_arrival",
    balanceDueDaysBeforeArrival: 30,
    currencyCode: "CAD",
  });

  assert.equal(policy.depositPercentageBasisPoints, 2500);
  assert.equal(policy.balanceDueDaysBeforeArrival, 30);
});

test("Build 042 calculates percentage deposit, security deposit and balance due", () => {
  const schedule = calculateReservationPaymentSchedule({
    totalCents: 100000,
    currencyCode: "CAD",
    arrivalDate: "2027-07-31",
    bookingDate: "2027-01-10",
    policy: {
      depositMode: "percentage",
      depositFixedCents: null,
      depositPercentageBasisPoints: 2500,
      securityDepositCents: 10000,
      securityDepositDueStage: "with_balance",
      balanceDueMode: "days_before_arrival",
      balanceDueDaysBeforeArrival: 30,
      currencyCode: "CAD",
    },
  });

  assert.equal(schedule.bookingDepositCents, 25000);
  assert.equal(schedule.reservationBalanceCents, 75000);
  assert.equal(schedule.balanceDueDate, "2027-07-01");
  assert.equal(schedule.bookingDueCents, 25000);
  assert.equal(schedule.totalPayableCents, 110000);

  const booking = calculatePaymentProgress({
    schedule,
    capturedCents: 0,
    asOfDate: "2027-01-10",
  });
  assert.equal(booking.dueNowCents, 25000);

  const balance = calculatePaymentProgress({
    schedule,
    capturedCents: 25000,
    asOfDate: "2027-07-01",
  });
  assert.equal(balance.dueNowCents, 85000);
  assert.equal(balance.outstandingCents, 85000);
});

test("Build 042 full deposit defaults to the full accepted quote", () => {
  const schedule = calculateReservationPaymentSchedule({
    totalCents: 21999,
    currencyCode: "CAD",
    arrivalDate: "2027-08-01",
    bookingDate: "2027-04-01",
    policy: {
      depositMode: "full",
      depositFixedCents: null,
      depositPercentageBasisPoints: null,
      securityDepositCents: 0,
      securityDepositDueStage: "with_deposit",
      balanceDueMode: "at_booking",
      balanceDueDaysBeforeArrival: null,
      currencyCode: "CAD",
    },
  });

  assert.equal(schedule.bookingDepositCents, 21999);
  assert.equal(schedule.reservationBalanceCents, 0);
  assert.equal(schedule.bookingDueCents, 21999);
});

test("Build 042 mock webhooks are HMAC verified and normalized", () => {
  const secret = "build-042-test-secret";
  const timestamp = 1792022400;
  const rawBody = JSON.stringify({
    eventId: "evt-1",
    paymentReference: "mock-payment:123",
    eventType: "payment.captured",
    eventStatus: "captured",
    amountCents: 5000,
    currencyCode: "CAD",
    occurredAt: "2026-10-15T00:00:00.000Z",
  });
  const signature = signMockPaymentWebhook({
    rawBody,
    timestamp,
    secret,
  });

  assert.equal(
    verifyPaymentWebhookSignature({
      rawBody,
      timestamp,
      signature,
      secret,
      nowSeconds: timestamp,
    }),
    true,
  );
  assert.equal(
    verifyPaymentWebhookSignature({
      rawBody,
      timestamp,
      signature,
      secret,
      nowSeconds: timestamp + 301,
    }),
    false,
  );

  const event = normalizeMockPaymentWebhook(rawBody);
  assert.equal(event.eventType, "payment.captured");
  assert.equal(event.amountCents, 5000);
});

test("Build 042 mock provider creates a deterministic sandbox capture", async () => {
  const provider = createMockPaymentProvider();
  const created = await provider.createPayment({
    paymentId: "payment-id",
    amountCents: 5000,
    currencyCode: "CAD",
    idempotencyKey: "reservation:payment-id:attempt:1",
  });
  const captured = await provider.capturePayment({
    paymentId: "payment-id",
    providerPaymentReference: created.providerPaymentReference,
    amountCents: 5000,
    currencyCode: "CAD",
  });

  assert.equal(created.providerPaymentReference, "mock-payment:payment-id");
  assert.equal(captured.eventType, "payment.captured");
  assert.equal(captured.providerEventId, "mock-capture:payment-id");
});
