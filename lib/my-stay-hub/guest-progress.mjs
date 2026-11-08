const knownStates = new Set([
  "pending",
  "confirmed",
  "checked_in",
  "completed",
]);

function step(id, label, state, detail) {
  return { id, label, state, detail };
}

export function buildGuestStayProgress(stay) {
  const reservation = stay?.reservation;
  if (
    !reservation ||
    !knownStates.has(reservation.status) ||
    !/^\d{4}-\d{2}-\d{2}$/u.test(reservation.arrivalDate ?? "") ||
    !/^\d{4}-\d{2}-\d{2}$/u.test(reservation.departureDate ?? "") ||
    !/^\d{4}-\d{2}-\d{2}$/u.test(reservation.campgroundLocalDate ?? "")
  ) {
    throw new Error("Current reservation progress is unavailable.");
  }

  const status = reservation.status;
  const confirmed = status !== "pending";
  const checkedInAt = stay.checkIn?.checkedInAt ?? null;
  const checkedOutAt = stay.checkOut?.checkedOutAt ?? null;
  const beforeArrival =
    reservation.arrivalDate >= reservation.campgroundLocalDate;
  const beforeDeparture =
    reservation.departureDate >= reservation.campgroundLocalDate;

  const steps = [
    step(
      "booking",
      "Reservation",
      confirmed ? "recorded" : "pending",
      confirmed
        ? "Confirmed in the reservation record."
        : "Confirmation has not been recorded.",
    ),
    checkedInAt
      ? step(
          "arrival",
          "Arrival",
          "recorded",
          "Campground check-in is recorded.",
        )
      : status === "pending"
        ? step(
            "arrival",
            "Arrival",
            "pending",
            "Wait for reservation confirmation before relying on arrival arrangements.",
          )
        : status === "confirmed" && beforeArrival
          ? step(
              "arrival",
              "Arrival",
              "scheduled",
              `Scheduled ${reservation.arrivalDate}; no check-in recorded.`,
            )
          : step(
              "arrival",
              "Arrival",
              "needs_review",
              "No verified check-in record; ask campground staff.",
            ),
    checkedOutAt
      ? step(
          "stay",
          "On site",
          "recorded",
          "A completed checkout is recorded; the stay is no longer active.",
        )
      : checkedInAt
        ? step(
            "stay",
            "On site",
            "recorded",
            "Check-in is recorded. Access remains subject to campground rules.",
          )
        : step(
            "stay",
            "On site",
            "pending",
            "An active on-site stay is not verified.",
          ),
    checkedOutAt
      ? step(
          "departure",
          "Departure",
          "recorded",
          "Campground checkout is recorded.",
        )
      : status === "pending"
        ? step(
            "departure",
            "Departure",
            "pending",
            "Expected departure is subject to reservation confirmation.",
          )
        : ["confirmed", "checked_in"].includes(status) && beforeDeparture
          ? step(
              "departure",
              "Departure",
              "scheduled",
              `Scheduled ${reservation.departureDate}; no checkout recorded.`,
            )
          : step(
              "departure",
              "Departure",
              "needs_review",
              "No verified checkout record; ask campground staff.",
            ),
  ];

  const headline =
    status === "pending"
      ? "Reservation awaiting confirmation"
      : status === "confirmed"
        ? "Your stay is scheduled"
        : status === "checked_in"
          ? checkedInAt
            ? "Campground check-in recorded"
            : "Check-in evidence needs verification"
          : checkedOutAt
            ? "Campground checkout recorded"
            : "Stay completion needs verification";

  return {
    headline,
    steps,
    hasUnverifiedMilestone: steps.some((item) => item.state === "needs_review"),
  };
}
