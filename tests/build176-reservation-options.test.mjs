import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  cancellationDecisionPreview,
  normalizeReviewRequest,
  parseReviewDates,
} from "../lib/reservation-decisions/core.mjs";

const today = "2026-11-01";
const stay = {
  reservation: {
    status: "confirmed",
    arrivalDate: "2026-11-15",
    departureDate: "2026-11-17",
    campgroundLocalDate: today,
  },
  payment: {
    currencyCode: "CAD",
    financialReviewRequired: false,
  },
};
const policy = {
  id: "source-policy",
  rowVersion: 7,
  currencyCode: "CAD",
  freeCancellationDaysBeforeArrival: 7,
  earlyRefundBasisPoints: 10000,
  lateRefundBasisPoints: 0,
  securityDepositRefundBasisPoints: 10000,
  cancellationFeeCents: 1000,
  approvalThresholdCents: 20000,
};
const payments = [
  {
    id: "booking",
    paymentPurpose: "booking_due",
    amountCents: 15000,
    refundedCents: 3000,
    currencyCode: "CAD",
  },
  {
    id: "security",
    paymentPurpose: "security_deposit",
    amountCents: 5000,
    refundedCents: 0,
    currencyCode: "CAD",
  },
];

function preview(overrides = {}) {
  return cancellationDecisionPreview({
    stay,
    policy,
    payments,
    pendingPayments: false,
    pendingRefunds: false,
    ...overrides,
  });
}

test("Build 176 accepts only real future dates and non-mutating review kinds", () => {
  assert.deepEqual(
    parseReviewDates(
      { arrivalDate: "2026-11-20", departureDate: "2026-11-23" },
      today,
    ),
    { arrivalDate: "2026-11-20", departureDate: "2026-11-23", nights: 3 },
  );
  assert.deepEqual(
    normalizeReviewRequest(
      { kind: "cancellation_review", reason: "My plans changed." },
      today,
    ),
    {
      kind: "cancellation_review",
      reason: "My plans changed.",
      arrivalDate: null,
      departureDate: null,
      nights: null,
    },
  );
  assert.equal(
    normalizeReviewRequest(
      {
        kind: "change_dates",
        reason: "I need to arrive later.",
        arrivalDate: "2026-11-20",
        departureDate: "2026-11-23",
      },
      today,
    ).kind,
    "change_dates",
  );
  for (const input of [
    { arrivalDate: "2026-02-31", departureDate: "2026-03-03" },
    { arrivalDate: "2026-10-01", departureDate: "2026-10-03" },
    { arrivalDate: "2026-11-15", departureDate: "2026-11-15" },
    { arrivalDate: "2026-11-15", departureDate: "2027-03-01" },
  ]) {
    assert.throws(() => parseReviewDates(input, today));
  }
  assert.throws(() =>
    normalizeReviewRequest(
      { kind: "cancel", reason: "Cancel me please" },
      today,
    ),
  );
  assert.throws(() =>
    normalizeReviewRequest(
      { kind: "cancellation_review", reason: "short" },
      today,
    ),
  );
});

test("Build 176 only displays a sourced policy recommendation from captured unrefunded money", () => {
  const result = preview();
  assert.equal(result.status, "estimated");
  assert.equal(result.capturedCents, 20000);
  assert.equal(result.refundedCents, 3000);
  assert.equal(result.recommendation.policyWindow, "early");
  assert.equal(result.recommendation.recommendedRefundCents, 16000);
  assert.equal(result.recommendation.feeAppliedCents, 1000);
  assert.equal(result.recommendation.retainedCents, 1000);
});

test("Build 176 refuses guesses for absent or mismatched source, unsettled money and post-arrival state", () => {
  for (const overrides of [
    { policy: null },
    { policy: { ...policy, currencyCode: "USD" } },
    { pendingRefunds: true },
    { pendingPayments: true },
    {
      stay: {
        ...stay,
        payment: { ...stay.payment, financialReviewRequired: true },
      },
    },
    {
      stay: {
        ...stay,
        reservation: { ...stay.reservation, status: "checked_in" },
      },
    },
    {
      stay: {
        ...stay,
        reservation: { ...stay.reservation, arrivalDate: today },
      },
    },
    { payments: [{ ...payments[0], refundedCents: 16000 }] },
  ]) {
    const result = preview(overrides);
    assert.equal(result.status, "review_required");
    assert.equal(result.recommendation, null);
    assert.ok(result.reason);
  }
});

test("Build 176 source readback is guest-owned, refund safe, and never calls financial mutation", () => {
  const db = fs.readFileSync(
    new URL("../lib/reservation-decisions/postgres.mjs", import.meta.url),
    "utf8",
  );
  const page = fs.readFileSync(
    new URL("../app/guest/reservation-options/page.tsx", import.meta.url),
    "utf8",
  );
  const actions = fs.readFileSync(
    new URL("../app/guest/reservation-options/actions.ts", import.meta.url),
    "utf8",
  );
  const staff = fs.readFileSync(
    new URL(
      "../app/workspaces/management/campgrounds/reservations/review-requests/page.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(db, /getMyStayDetail/);
  assert.match(db, /r\.guest_user_id=\$2/);
  assert.match(db, /where p\.reservation_id=\$1 and p\.guest_user_id=\$2/);
  assert.match(db, /rf\.refund_state = 'succeeded'/);
  assert.match(
    db,
    /rf\.refund_state in \('pending_approval','approved','submitted'\)/,
  );
  assert.match(db, /set local role icamp_app/);
  assert.match(db, /for share of r/);
  assert.match(
    db,
    /on conflict on constraint guest_review_requests_idempotency_unique/,
  );
  assert.match(db, /set request_state='withdrawn'/);
  assert.match(page, /<QuoteSummary quote=\{freshDetail\.quotePreview\}/);
  assert.match(page, /Booking|reservation/i);
  assert.match(page, /confirmReview/);
  assert.match(actions, /requireSignedIn/);
  assert.match(actions, /expectedReservationVersion/);
  assert.match(staff, /requireStaff/);
  assert.doesNotMatch(
    actions,
    /cancelReservation|requestReservationRefund|submitRefund|capturePayment|sendSms|sendEmail/,
  );
  assert.doesNotMatch(
    db,
    /update public\.reservations|insert into public\.reservation_refunds|insert into public\.reservation_payments/,
  );
});

test("Build 176 owner/staff SQL policy denies anonymous access and guards immutable intent", () => {
  const migration = fs.readFileSync(
    new URL(
      "../database/migrations/0187_build176_guest_reservation_review_requests.sql",
      import.meta.url,
    ),
    "utf8",
  );
  const verify = fs.readFileSync(
    new URL(
      "../database/verify/0187_build176_guest_reservation_review_requests.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(migration, /enable row level security/);
  assert.match(migration, /force row level security/);
  assert.match(
    migration,
    /revoke all on public\.guest_reservation_review_requests from authenticated/,
  );
  assert.match(
    migration,
    /revoke all on public\.guest_reservation_review_requests from anon/,
  );
  assert.match(migration, /guest_user_id=user_account_id/);
  assert.match(migration, /guest_review_requests_one_active_kind_idx/);
  assert.match(migration, /new\.request_state <> 'withdrawn'/);
  assert.match(migration, /guest_review_requests_reservation_fk/);
  assert.match(verify, /relforcerowsecurity/);
  assert.doesNotMatch(migration, /security definer/i);
});
