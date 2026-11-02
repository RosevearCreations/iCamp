import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateCancellationRefundRecommendation,
  refundApprovalRequirement,
  refundRemainingCents,
  validateCancellationRefundPolicyInput,
} from "../lib/refunds/core.mjs";
import { createMockRefundProvider } from "../lib/refunds/provider.mjs";

test("Build 045 calculates early cancellation refund with fee and security deposit", () => {
  const policy = validateCancellationRefundPolicyInput({
    currencyCode: "CAD",
    freeCancellationDaysBeforeArrival: 7,
    earlyRefundBasisPoints: 10000,
    lateRefundBasisPoints: 0,
    securityDepositRefundBasisPoints: 10000,
    cancellationFeeCents: 1000,
    approvalThresholdCents: 25000,
  });

  const result = calculateCancellationRefundRecommendation({
    arrivalDate: "2027-07-20",
    asOfDate: "2027-07-01",
    policy,
    payments: [
      {
        id: "payment-booking",
        paymentPurpose: "booking_due",
        amountCents: 10000,
        refundedCents: 0,
      },
      {
        id: "payment-security",
        paymentPurpose: "security_deposit",
        amountCents: 5000,
        refundedCents: 0,
      },
    ],
  });

  assert.equal(result.policyWindow, "early");
  assert.equal(result.feeAppliedCents, 1000);
  assert.equal(result.recommendedRefundCents, 14000);
  assert.equal(result.retainedCents, 1000);
});

test("Build 045 applies late policy without reducing security-deposit refund", () => {
  const result = calculateCancellationRefundRecommendation({
    arrivalDate: "2027-07-05",
    asOfDate: "2027-07-01",
    policy: {
      currencyCode: "CAD",
      freeCancellationDaysBeforeArrival: 7,
      earlyRefundBasisPoints: 10000,
      lateRefundBasisPoints: 2500,
      securityDepositRefundBasisPoints: 10000,
      cancellationFeeCents: 0,
      approvalThresholdCents: 25000,
    },
    payments: [
      {
        id: "payment-booking",
        paymentPurpose: "booking_due",
        amountCents: 10000,
        refundedCents: 0,
      },
      {
        id: "payment-security",
        paymentPurpose: "security_deposit",
        amountCents: 5000,
        refundedCents: 0,
      },
    ],
  });

  assert.equal(result.policyWindow, "late");
  assert.equal(result.recommendedRefundCents, 7500);
  assert.equal(result.allocations[0].recommendedCents, 2500);
  assert.equal(result.allocations[1].recommendedCents, 5000);
});

test("Build 045 approval gate catches threshold and policy overrides", () => {
  assert.deepEqual(
    refundApprovalRequirement({
      amountCents: 20000,
      approvalThresholdCents: 25000,
      policyRecommendedCents: 20000,
    }),
    {
      approvalRequired: false,
      exceedsThreshold: false,
      exceedsPolicy: false,
    },
  );

  assert.equal(
    refundApprovalRequirement({
      amountCents: 30000,
      approvalThresholdCents: 25000,
      policyRecommendedCents: 30000,
    }).approvalRequired,
    true,
  );

  assert.equal(
    refundApprovalRequirement({
      amountCents: 15000,
      approvalThresholdCents: 25000,
      policyRecommendedCents: 10000,
    }).approvalRequired,
    true,
  );
});

test("Build 045 never reserves more refund than captured payment", () => {
  assert.equal(
    refundRemainingCents({
      capturedCents: 10000,
      reservedOrRefundedCents: 2500,
    }),
    7500,
  );
  assert.throws(
    () =>
      refundRemainingCents({
        capturedCents: 10000,
        reservedOrRefundedCents: 10001,
      }),
    /exceeds captured/u,
  );
});

test("Build 045 free mock refund adapter links refund to original payment reference", async () => {
  const provider = createMockRefundProvider();
  const event = await provider.refundPayment({
    refundId: "refund-123",
    originalPaymentReference: "mock-payment:payment-123",
    amountCents: 5000,
    currencyCode: "CAD",
    idempotencyKey: "aaaaaaaaaaaaaaaa",
  });

  assert.equal(event.providerKey, "mock");
  assert.equal(event.eventType, "refund.succeeded");
  assert.equal(event.amountCents, 5000);
  assert.match(event.providerRefundReference, /^mock-refund:/u);
});
