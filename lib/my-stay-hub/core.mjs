function event({ id, title, detail, at, kind = "recorded", source }) {
  return { id, title, detail, at, kind, source };
}

export function buildStayHubSummary({
  stay,
  arrival = null,
  assistance = null,
  reviews = null,
  asOf,
}) {
  const { reservation, documents, rules, checkIn, checkOut } = stay;
  const events = [];
  const plan = arrival?.plan ?? null;
  const staffReview = arrival?.review ?? null;
  const planCurrent =
    plan?.state === "submitted" &&
    plan?.sourceReservationVersion === reservation.rowVersion;
  const staffReviewCurrent =
    planCurrent &&
    staffReview?.reviewedPlanVersion === plan?.rowVersion &&
    staffReview?.reviewedReservationVersion === reservation.rowVersion;

  if (documents.confirmationNumber) {
    events.push(
      event({
        id: "confirmation",
        title: "Confirmation on record",
        detail: `Confirmation ${documents.confirmationNumber}. Issuance time is not available in this view.`,
        at: null,
        source: "Reservation confirmation",
      }),
    );
  }
  if (rules.bookingAcknowledgedAt) {
    events.push(
      event({
        id: "rules",
        title: "Booking rules acknowledged",
        detail: "Recorded during booking; current published rules may differ.",
        at: rules.bookingAcknowledgedAt,
        source: "Booking rules acknowledgement",
      }),
    );
  }
  if (plan?.submittedAt || plan?.updatedAt) {
    events.push(
      event({
        id: "arrival-plan",
        title:
          plan.state === "draft"
            ? "Arrival plan draft saved"
            : planCurrent
              ? "Arrival plan submitted"
              : "Arrival plan needs review after reservation change",
        detail:
          plan.state === "draft"
            ? "Draft details have not been submitted to staff."
            : planCurrent
              ? "Guest pre-registration received; this is not check-in approval."
              : "The saved plan refers to an earlier reservation version.",
        at: plan.state === "draft" ? plan.updatedAt : plan.submittedAt,
        kind:
          plan.state === "draft" || planCurrent ? "recorded" : "needs_review",
        source: "Guest arrival plan",
      }),
    );
  }
  if (staffReview?.reviewedAt) {
    events.push(
      event({
        id: "staff-review",
        title: staffReviewCurrent
          ? staffReview.outcome === "reviewed"
            ? "Arrival details reviewed by staff"
            : "Staff requested arrival follow-up"
          : "Previous staff review no longer current",
        detail: staffReviewCurrent
          ? "Office review is not gate access or a check-in authorization."
          : "A newer arrival plan or reservation version needs another review.",
        at: staffReview.reviewedAt,
        kind:
          staffReviewCurrent && staffReview.outcome === "reviewed"
            ? "recorded"
            : "needs_review",
        source: "Staff arrival review",
      }),
    );
  }
  for (const request of reviews ?? []) {
    events.push(
      event({
        id: `decision-${request.id}`,
        title:
          request.kind === "cancellation_review"
            ? "Cancellation review requested"
            : "Reservation change requested",
        detail:
          request.state === "withdrawn"
            ? "Request withdrawn. No booking change or refund is implied."
            : request.sourceReservationVersion !== reservation.rowVersion
              ? "Submitted against an older reservation version; ask the office for current status."
              : "Submitted for staff review; no booking change or refund is implied.",
        at: request.submittedAt,
        kind:
          request.state === "withdrawn" ||
          request.sourceReservationVersion !== reservation.rowVersion
            ? "needs_review"
            : "recorded",
        source: "Guest reservation decision request",
      }),
    );
    if (request.withdrawnAt) {
      events.push(
        event({
          id: `withdrawn-${request.id}`,
          title: "Review request withdrawn",
          detail: "The underlying reservation remains authoritative.",
          at: request.withdrawnAt,
          source: "Guest reservation decision request",
        }),
      );
    }
  }
  for (const request of assistance?.requests ?? []) {
    if (request.submittedAt) {
      events.push(
        event({
          id: `assistance-${request.id}`,
          title: "Assistance request submitted",
          detail: `${request.category.replaceAll("_", " ")} · ${request.severity.replaceAll("_", " ")}. This is not emergency dispatch.`,
          at: request.submittedAt,
          source: "Guest assistance request",
        }),
      );
    }
  }
  for (const update of assistance?.updates ?? []) {
    for (const item of update.updates) {
      if (!item.occurredAt) continue;
      events.push(
        event({
          id: `case-event-${item.id}`,
          title: "Assistance case update",
          detail: item.summary,
          at: item.occurredAt,
          source: "Guest-visible assistance case event",
        }),
      );
    }
  }
  for (const receipt of documents.receipts) {
    if (!receipt.issuedAt) continue;
    events.push(
      event({
        id: `receipt-${receipt.id}`,
        title: "Payment receipt issued",
        detail: `Receipt ${receipt.receiptNumber}. View the original document for amount and details.`,
        at: receipt.issuedAt,
        source: "Reservation receipt",
      }),
    );
  }
  if (checkIn?.checkedInAt) {
    events.push(
      event({
        id: "check-in",
        title: "Checked in by campground",
        detail:
          "Recorded check-in; credential handoff is a separate staff control.",
        at: checkIn.checkedInAt,
        source: "Reservation check-in",
      }),
    );
  } else if (["confirmed", "pending"].includes(reservation.status)) {
    events.push(
      event({
        id: "scheduled-arrival",
        title: "Scheduled arrival",
        detail:
          "Reservation date only. This is not a confirmed arrival or access permission.",
        at: reservation.arrivalDate,
        kind: "scheduled",
        source: "Reservation arrival date",
      }),
    );
  }
  if (checkOut?.checkedOutAt) {
    events.push(
      event({
        id: "check-out",
        title: "Checked out by campground",
        detail:
          "Recorded checkout; financial and return handoffs may still need review.",
        at: checkOut.checkedOutAt,
        source: "Reservation check-out",
      }),
    );
  } else if (
    ["pending", "confirmed", "checked_in"].includes(reservation.status)
  ) {
    events.push(
      event({
        id: "scheduled-departure",
        title: "Scheduled departure",
        detail: "Reservation date only; not a completed checkout.",
        at: reservation.departureDate,
        kind: "scheduled",
        source: "Reservation departure date",
      }),
    );
  }
  events.sort((a, b) => {
    if (!a.at && !b.at) return a.id.localeCompare(b.id);
    if (!a.at) return -1;
    if (!b.at) return 1;
    return a.at.localeCompare(b.at) || a.id.localeCompare(b.id);
  });

  const openCases = assistance
    ? assistance.requests.filter((request) => {
        const update = assistance.updates.find(
          (item) => item.requestId === request.id,
        );
        return !update || !["closed", "resolved"].includes(update.caseState);
      }).length
    : null;
  const nextAction =
    reservation.status === "pending"
      ? {
          title: "Review your pending reservation",
          detail:
            "Booking remains pending; payment/confirmation is not assumed.",
          href: "/guest/stay",
        }
      : reservation.status === "confirmed" && (!plan || !planCurrent)
        ? {
            title: "Prepare your arrival",
            detail: "Share optional arrival details for an office review.",
            href: "/guest/arrival-planner",
          }
        : reservation.status === "checked_in"
          ? {
              title: "Your on-site essentials",
              detail: "Review assistance cases and campground guidance.",
              href: "/guest/assistance",
            }
          : {
              title: "Review your stay documents",
              detail: "Check your reservation and original documents.",
              href: "/guest/stay",
            };

  return {
    asOf,
    reservationVersion: reservation.rowVersion,
    events,
    openCases,
    planCurrent: Boolean(planCurrent),
    staffReviewCurrent: Boolean(staffReviewCurrent),
    nextAction,
  };
}
