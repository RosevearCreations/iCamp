function cents(value, label) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 200000000) {
    throw new Error(label + " is invalid.");
  }
  return parsed;
}

export function reservationConfirmationEligibility({
  bookingDueCents,
  capturedCents,
}) {
  const requiredCents = cents(bookingDueCents, "Booking amount due");
  const paidCents = cents(capturedCents, "Captured amount");
  const shortfallCents = Math.max(0, requiredCents - paidCents);

  return {
    eligible: shortfallCents === 0,
    requiredCents,
    capturedCents: paidCents,
    shortfallCents,
  };
}

export function deterministicDocumentNumber(prefix, seed) {
  const normalizedPrefix = String(prefix ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/gu, "");
  const normalizedSeed = String(seed ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/gu, "");

  if (!/^[A-Z]{2,6}$/u.test(normalizedPrefix)) {
    throw new Error("Document prefix is invalid.");
  }
  if (normalizedSeed.length < 8) {
    throw new Error("Document seed is invalid.");
  }

  return normalizedPrefix + "-" + normalizedSeed.slice(0, 16);
}

export function confirmationSnapshot({
  reservation,
  checkout,
  schedule,
  capturedCents,
}) {
  const eligibility = reservationConfirmationEligibility({
    bookingDueCents: schedule.bookingDueCents,
    capturedCents,
  });

  return {
    version: 1,
    reservation: {
      id: reservation.id,
      statusAtConfirmation: reservation.status,
      arrivalDate: reservation.arrivalDate,
      departureDate: reservation.departureDate,
      campgroundName: reservation.campgroundName,
      accommodationCode: reservation.accommodationCode,
      accommodationName: reservation.accommodationName,
    },
    guest: {
      name: checkout.contactName,
      email: checkout.contactEmail,
      occupants: checkout.occupants,
      visitors: checkout.visitors,
      pets: checkout.pets,
      vehicles: checkout.vehicles,
    },
    acceptedQuote: {
      currencyCode: checkout.currencyCode,
      staySubtotalCents: checkout.staySubtotalCents,
      chargeTotalCents: checkout.chargeTotalCents,
      totalCents: checkout.totalCents,
    },
    paymentSchedule: {
      bookingDueCents: schedule.bookingDueCents,
      bookingDepositCents: schedule.bookingDepositCents,
      reservationBalanceCents: schedule.reservationBalanceCents,
      securityDepositCents: schedule.securityDepositCents,
      securityDepositDueStage: schedule.securityDepositDueStage,
      balanceDueMode: schedule.balanceDueMode,
      balanceDueDate: schedule.balanceDueDate,
      totalPayableCents: schedule.totalPayableCents,
      capturedAtConfirmationCents: eligibility.capturedCents,
    },
    immutableSources: {
      build041Quote: true,
      build042Schedule: true,
    },
  };
}
