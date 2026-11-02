import assert from "node:assert/strict";
import test from "node:test";

import {
  confirmationSnapshot,
  deterministicDocumentNumber,
  reservationConfirmationEligibility,
} from "../lib/reservation-documents/core.mjs";

test("Build 043 confirms when the booking-time obligation is satisfied", () => {
  assert.deepEqual(
    reservationConfirmationEligibility({
      bookingDueCents: 5000,
      capturedCents: 5000,
    }),
    {
      eligible: true,
      requiredCents: 5000,
      capturedCents: 5000,
      shortfallCents: 0,
    },
  );

  assert.deepEqual(
    reservationConfirmationEligibility({
      bookingDueCents: 5000,
      capturedCents: 3200,
    }),
    {
      eligible: false,
      requiredCents: 5000,
      capturedCents: 3200,
      shortfallCents: 1800,
    },
  );
});

test("Build 043 document numbers are deterministic and non-secret", () => {
  const seed = "12345678-90ab-cdef-1234-567890abcdef";
  assert.equal(deterministicDocumentNumber("IC", seed), "IC-1234567890ABCDEF");
  assert.equal(
    deterministicDocumentNumber("INV", seed),
    "INV-1234567890ABCDEF",
  );
  assert.equal(
    deterministicDocumentNumber("RCT", seed),
    "RCT-1234567890ABCDEF",
  );
});

test("Build 043 confirmation snapshot preserves Build 041 and 042 boundaries", () => {
  const snapshot = confirmationSnapshot({
    reservation: {
      id: "reservation-1",
      status: "pending",
      arrivalDate: "2027-07-01",
      departureDate: "2027-07-04",
      campgroundName: "Demo Campground",
      accommodationCode: "A01",
      accommodationName: "Site A01",
    },
    checkout: {
      contactName: "Guest Example",
      contactEmail: "guest@example.com",
      occupants: 2,
      visitors: 0,
      pets: 1,
      vehicles: 1,
      currencyCode: "CAD",
      staySubtotalCents: 30000,
      chargeTotalCents: 2500,
      totalCents: 32500,
    },
    schedule: {
      bookingDueCents: 10000,
      bookingDepositCents: 10000,
      reservationBalanceCents: 22500,
      securityDepositCents: 5000,
      securityDepositDueStage: "on_arrival",
      balanceDueMode: "days_before_arrival",
      balanceDueDate: "2027-06-17",
      totalPayableCents: 37500,
    },
    capturedCents: 10000,
  });

  assert.deepEqual(snapshot.immutableSources, {
    build041Quote: true,
    build042Schedule: true,
  });
  assert.equal(snapshot.acceptedQuote.totalCents, 32500);
  assert.equal(snapshot.paymentSchedule.capturedAtConfirmationCents, 10000);
});
