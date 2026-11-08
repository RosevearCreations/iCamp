function item(id, title, detail, state) {
  return { id, title, detail, state };
}

/**
 * Read-only presentation of guest-owned reservation and arrival-plan sources.
 * Neither an arrival plan nor a staff review authorizes check-in or access.
 */
export function buildGuestArrivalGuide({
  stay,
  arrival = null,
  arrivalAvailable = true,
}) {
  const reservation = stay?.reservation;
  if (!reservation?.id || !reservation?.campground?.slug) {
    throw new Error("A verified guest reservation is required.");
  }

  const status = reservation.status;
  const checkedIn = Boolean(stay.checkIn?.checkedInAt);
  const checkedOut = Boolean(stay.checkOut?.checkedOutAt);
  const plan = arrivalAvailable ? (arrival?.plan ?? null) : null;
  const review = arrivalAvailable ? (arrival?.review ?? null) : null;
  const planVersionCurrent = Boolean(
    plan && plan.sourceReservationVersion === reservation.rowVersion,
  );
  const submittedCurrent = planVersionCurrent && plan?.state === "submitted";
  const reviewCurrent = Boolean(
    submittedCurrent &&
    review &&
    review.reviewedReservationVersion === reservation.rowVersion &&
    review.reviewedPlanVersion === plan.rowVersion,
  );
  const reviewOutcome = reviewCurrent ? review.outcome : null;

  const facts = [
    item(
      "arrival",
      "Arrival date",
      reservation.arrivalDate
        ? `${reservation.arrivalDate} · campground local calendar`
        : "Confirm your arrival date with the office.",
      reservation.arrivalDate ? "information" : "unknown",
    ),
    item(
      "time",
      "Check-in time",
      stay.rules?.currentCheckInTime
        ? `${stay.rules.currentCheckInTime} · campground local time. Earlier arrival requires office confirmation.`
        : "The campground has not supplied a current check-in time here. Ask the office.",
      stay.rules?.currentCheckInTime ? "information" : "unknown",
    ),
    item(
      "confirmation",
      "Booking confirmation",
      status === "pending"
        ? "Reservation is pending; arrival and site access are not confirmed."
        : stay.documents?.confirmationNumber
          ? `Confirmation ${stay.documents.confirmationNumber} is on record. Bring the documents the office requires.`
          : "No confirmation number is shown here; ask the office what booking proof to bring.",
      status === "pending" || !stay.documents?.confirmationNumber
        ? "review"
        : "information",
    ),
    item(
      "plan",
      "Guest arrival details",
      !arrivalAvailable
        ? "Could not verify saved arrival details. Refresh or contact the office."
        : plan && !planVersionCurrent
          ? "Saved details refer to an older reservation version. Review and resubmit."
          : submittedCurrent
            ? "Arrival details submitted for staff review; not a completed check-in."
            : plan?.state === "draft"
              ? "Editable draft saved; not yet submitted to staff."
              : "No submitted arrival plan on record. Pre-registration is optional.",
      !arrivalAvailable || (plan && !planVersionCurrent)
        ? "unknown"
        : "information",
    ),
    item(
      "office",
      "Front-desk review",
      !arrivalAvailable
        ? "Staff review could not be verified."
        : reviewOutcome === "reviewed"
          ? "Current arrival plan reviewed by staff; this is not check-in or gate approval."
          : reviewOutcome === "follow_up_needed"
            ? "Staff have requested follow-up. Contact the campground office."
            : review
              ? "Previous staff review is no longer current; ask the office to recheck."
              : "No current staff review receipt recorded.",
      !arrivalAvailable || (review && !reviewCurrent)
        ? "unknown"
        : reviewOutcome === "follow_up_needed"
          ? "review"
          : "information",
    ),
  ];

  const needsFinancialReview = Boolean(
    stay.payment?.financialReviewRequired ||
    (stay.payment?.outstandingCents ?? 0) > 0,
  );
  const notices = [];
  if (needsFinancialReview) {
    notices.push(
      "An outstanding amount or financial review is recorded. Ask the office to verify it; this page cannot settle or waive a balance.",
    );
  }
  if (
    status === "confirmed" &&
    !checkedIn &&
    reservation.arrivalDate &&
    reservation.campgroundLocalDate > reservation.arrivalDate
  ) {
    notices.push(
      "The scheduled arrival date has passed without a recorded check-in. Contact the office to verify your stay.",
    );
  }
  if (status === "checked_in" && !checkedIn) {
    notices.push(
      "The reservation status says checked in, but the actual check-in receipt is missing. Ask staff to verify it.",
    );
  }
  if (status === "completed" && !checkedOut) {
    notices.push(
      "Stay completion is shown without a recorded checkout receipt. Ask staff for verification.",
    );
  }

  const phase =
    status === "pending"
      ? "pending"
      : status === "completed"
        ? checkedOut
          ? "past"
          : "office_review"
        : status === "checked_in"
          ? checkedIn
            ? "on_site"
            : "office_review"
          : status === "confirmed" && !checkedIn && !checkedOut
            ? "before_arrival"
            : "office_review";
  const headline =
    phase === "pending"
      ? "Your booking is awaiting confirmation"
      : phase === "on_site"
        ? "Your check-in is recorded"
        : phase === "past"
          ? "Your checkout is recorded"
          : phase === "before_arrival"
            ? "Get ready for arrival"
            : "Ask the office to verify your stay";

  const id = encodeURIComponent(reservation.id);
  const mapHref = `/booking/map?campground=${encodeURIComponent(reservation.campground.slug)}&arrivalDate=${encodeURIComponent(reservation.arrivalDate ?? "")}&departureDate=${encodeURIComponent(reservation.departureDate ?? "")}#wayfinding`;
  const actions = [
    {
      label:
        phase === "before_arrival" ? "Review arrival plan" : "Open My Stay",
      href:
        phase === "before_arrival"
          ? `/guest/arrival-planner?reservation=${id}`
          : `/guest/stay?reservation=${id}`,
    },
    { label: "Campground map", href: mapHref },
    {
      label: "Rules & stay details",
      href: `/guest/stay?reservation=${id}#my-stay-guidance`,
    },
    {
      label: "Assistance & existing cases",
      href: `/guest/assistance?reservation=${id}`,
    },
  ];
  if (stay.documents?.confirmationNumber) {
    actions.push({
      label: "Issued confirmation & receipts",
      href: `/booking/reservations/${id}/documents`,
    });
  }

  return {
    phase,
    headline,
    facts,
    notices,
    actions,
    campgroundGuidance: stay.rules?.guestSummary ?? null,
    assistanceHint:
      checkedIn && !checkedOut
        ? "New in-app assistance requests are available during a recorded checked-in stay. Urgent requests do not dispatch emergency services."
        : "Before check-in or after checkout, this link is for existing cases. For new arrival questions, contact the campground office directly.",
    // The guide does not approve payments, entry, check-in or guest messaging.
    checkInAuthorized: false,
    accessAuthorized: false,
  };
}
