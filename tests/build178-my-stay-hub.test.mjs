import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { buildStayHubSummary } from "../lib/my-stay-hub/core.mjs";

const stay = {
  reservation: {
    id: "reservation-1",
    status: "confirmed",
    rowVersion: 4,
    arrivalDate: "2026-11-09",
    departureDate: "2026-11-12",
  },
  documents: {
    confirmationNumber: "CONF-100",
    receipts: [
      {
        id: "receipt-1",
        receiptNumber: "R-100",
        issuedAt: "2026-10-31T10:00:00Z",
      },
    ],
  },
  rules: { bookingAcknowledgedAt: "2026-10-30T09:00:00Z" },
  checkIn: null,
  checkOut: null,
};

const asOf = "2026-11-01T12:00:00Z";

test("Build178 orders actual events and separates scheduled dates from verified check-in", () => {
  const summary = buildStayHubSummary({ stay, asOf });
  assert.deepEqual(
    summary.events.map((event) => event.id),
    [
      "confirmation",
      "rules",
      "receipt-receipt-1",
      "scheduled-arrival",
      "scheduled-departure",
    ],
  );
  assert.equal(
    summary.events.find((event) => event.id === "confirmation").at,
    null,
  );
  assert.equal(
    summary.events.find((event) => event.id === "scheduled-arrival").kind,
    "scheduled",
  );
  assert.equal(
    summary.events.some((event) => event.id === "check-in"),
    false,
  );
  assert.equal(summary.openCases, null);
  assert.equal(summary.reservationVersion, 4);
});

test("Build178 marks stale arrival/staff reviews without granting access", () => {
  const summary = buildStayHubSummary({
    stay,
    asOf,
    arrival: {
      plan: {
        submittedAt: "2026-10-29T10:00:00Z",
        sourceReservationVersion: 3,
        rowVersion: 2,
      },
      review: {
        reviewedAt: "2026-10-30T12:00:00Z",
        reviewedPlanVersion: 2,
        reviewedReservationVersion: 3,
        outcome: "reviewed",
      },
    },
  });
  assert.equal(summary.planCurrent, false);
  assert.equal(summary.staffReviewCurrent, false);
  assert.equal(
    summary.events.find((event) => event.id === "arrival-plan").kind,
    "needs_review",
  );
  assert.equal(
    summary.events.find((event) => event.id === "staff-review").kind,
    "needs_review",
  );
});

test("Build178 records only source-backed check-in, checkout, assistance and decision receipts", () => {
  const checkedIn = {
    ...stay,
    reservation: { ...stay.reservation, status: "completed" },
    checkIn: { checkedInAt: "2026-11-09T15:00:00Z" },
    checkOut: { checkedOutAt: "2026-11-12T11:00:00Z" },
  };
  const summary = buildStayHubSummary({
    stay: checkedIn,
    asOf,
    reviews: [
      {
        id: "r",
        kind: "cancellation_review",
        state: "submitted",
        submittedAt: "2026-10-31T11:00:00Z",
        sourceReservationVersion: 3,
        withdrawnAt: null,
      },
    ],
    assistance: {
      requests: [
        {
          id: "a",
          category: "maintenance",
          severity: "urgent",
          submittedAt: "2026-11-10T11:00:00Z",
        },
        {
          id: "b",
          category: "wifi",
          severity: "normal",
          submittedAt: "2026-11-10T12:00:00Z",
        },
      ],
      updates: [
        {
          requestId: "a",
          caseState: "closed",
          updates: [
            {
              id: "u",
              summary: "Office contacted guest",
              occurredAt: "2026-11-10T11:30:00Z",
            },
          ],
        },
      ],
    },
  });
  assert.equal(
    summary.events.some((event) => event.id === "check-in"),
    true,
  );
  assert.equal(
    summary.events.some((event) => event.id === "check-out"),
    true,
  );
  assert.equal(
    summary.events.some((event) => event.id.startsWith("scheduled")),
    false,
  );
  assert.equal(summary.openCases, 1);
  assert.equal(
    summary.events.find((event) => event.id === "decision-r").kind,
    "needs_review",
  );
  assert.equal(
    summary.events.find((event) => event.id === "case-event-u").source,
    "Guest-visible assistance case event",
  );
});

test("Build178 private route uses session and guest-owned source reads, with no mutable actions", () => {
  const page = readFileSync(
    new URL("../app/guest/hub/page.tsx", import.meta.url),
    "utf8",
  );
  assert.match(page, /requireSignedIn\("\/guest\/hub"\)/);
  assert.match(page, /session\.user\.accountType !== "guest"/);
  assert.match(
    page,
    /stays\.find\(\(stay\) => stay\.id === params\.reservation\)/,
  );
  assert.match(page, /getMyStayDetail\(\{[\s\S]*userId: session\.user\.id/);
  assert.match(
    page,
    /listGuestAssistanceUpdates\(\{ userId: session\.user\.id, reservationId \}\)/,
  );
  assert.match(page, /Promise\.allSettled/);
  assert.match(page, /method="get"/);
  assert.doesNotMatch(
    page,
    /paymentProvider\.|sendSms\(|sendEmail\(|authorizeGate\(/,
  );
});
