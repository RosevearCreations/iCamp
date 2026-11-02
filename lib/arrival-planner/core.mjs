const arrivalModes = Object.freeze([
  "unspecified",
  "personal_vehicle",
  "rideshare",
  "walking",
  "other",
]);
const documentStates = Object.freeze([
  "not_reviewed",
  "will_bring",
  "need_help",
]);

function optionalCount(value, maximum) {
  if (value == null || String(value).trim() === "") return null;
  if (!/^(0|[1-9]\d*)$/u.test(String(value).trim())) {
    throw new Error("Use a whole-number guest or vehicle count.");
  }
  const count = Number(value);
  if (!Number.isSafeInteger(count) || count > maximum) {
    throw new Error("The arrival count exceeds the review limit.");
  }
  return count;
}

export function normalizeArrivalPlan(input) {
  const state = String(input.state ?? "").trim();
  if (!["draft", "submitted"].includes(state)) {
    throw new Error("Choose to save a draft or submit to staff.");
  }
  const expectedArrivalTime = String(input.expectedArrivalTime ?? "").trim();
  if (
    expectedArrivalTime &&
    !/^([01]\d|2[0-3]):[0-5]\d$/u.test(expectedArrivalTime)
  ) {
    throw new Error("Enter an estimated arrival time in HH:MM format.");
  }
  const arrivalMode = String(input.arrivalMode ?? "unspecified").trim();
  const documentPreparation = String(
    input.documentPreparation ?? "not_reviewed",
  ).trim();
  if (!arrivalModes.includes(arrivalMode)) {
    throw new Error("Choose a valid arrival transport option.");
  }
  if (!documentStates.includes(documentPreparation)) {
    throw new Error("Choose a valid document-preparation option.");
  }
  const expectedVehicleCount = optionalCount(input.expectedVehicleCount, 20);
  const expectedVisitorCount = optionalCount(input.expectedVisitorCount, 100);
  const rulesReviewed = input.rulesReviewed === true;
  const assistanceRequested = input.assistanceRequested === true;
  const assistanceNote = assistanceRequested
    ? String(input.assistanceNote ?? "").trim()
    : "";
  if (assistanceNote.length > 300) {
    throw new Error("Keep assistance arrangements under 300 characters.");
  }
  if (
    state === "submitted" &&
    (!expectedArrivalTime ||
      expectedVehicleCount === null ||
      expectedVisitorCount === null ||
      documentPreparation === "not_reviewed" ||
      !rulesReviewed)
  ) {
    throw new Error(
      "To submit, provide an arrival time, both counts, document preparation and rules review.",
    );
  }
  return {
    state,
    expectedArrivalTime: expectedArrivalTime || null,
    arrivalMode,
    expectedVehicleCount,
    expectedVisitorCount,
    documentPreparation,
    rulesReviewed,
    assistanceRequested,
    assistanceNote: assistanceNote || null,
  };
}

export function normalizeStaffArrivalReview(input) {
  const outcome = String(input.outcome ?? "").trim();
  const note = String(input.note ?? "").trim();
  if (!["reviewed", "follow_up_needed"].includes(outcome)) {
    throw new Error("Choose a staff-review result.");
  }
  if (
    note.length > 300 ||
    (outcome === "follow_up_needed" && note.length < 10)
  ) {
    throw new Error("Explain needed follow-up in 10–300 characters.");
  }
  return { outcome, note: note || null };
}

export function arrivalReadiness({ stay, plan, review }) {
  const open =
    stay.reservation.status === "confirmed" &&
    stay.reservation.departureDate > stay.reservation.campgroundLocalDate;
  const tasks = [
    {
      id: "contact",
      label: "Booking contact recorded",
      complete: Boolean(stay.contact?.name && stay.contact?.email),
      detail:
        "The office will independently verify identity and contact details.",
    },
    {
      id: "arrival",
      label: "Estimated arrival time supplied",
      complete: Boolean(plan?.expectedArrivalTime),
      detail: stay.rules.currentCheckInTime
        ? `Campground check-in starts at ${stay.rules.currentCheckInTime} local time; an earlier estimate is not early-access approval.`
        : "Confirm the arrival window with the campground office.",
    },
    {
      id: "party",
      label: "Visitors and vehicles declared for staff recheck",
      complete:
        plan?.expectedVisitorCount != null &&
        plan?.expectedVehicleCount != null,
      detail:
        "These are proposed arrival counts only. Site limits and the official reservation remain authoritative.",
    },
    {
      id: "documents",
      label: "Documents and confirmation preparation stated",
      complete: Boolean(plan && plan.documentPreparation !== "not_reviewed"),
      detail: stay.documents.confirmationNumber
        ? `Confirmation ${stay.documents.confirmationNumber} is recorded; bring the office-required documents and identification. Do not upload ID here.`
        : "A confirmation number is not recorded; ask the office what proof to bring.",
    },
    {
      id: "rules",
      label: "Current rules reviewed by guest",
      complete: plan?.rulesReviewed === true,
      detail:
        "This checklist acknowledgement does not replace formal campground rules acceptance or staff verification.",
    },
  ];
  const differences = [];
  if (plan && plan.sourceReservationVersion !== stay.reservation.rowVersion) {
    differences.push(
      "Reservation changed after this arrival plan was saved; review and resubmit it.",
    );
  }
  if (
    plan?.expectedVehicleCount != null &&
    plan.expectedVehicleCount !== stay.party.vehicles
  ) {
    differences.push("Vehicle count differs from the booked record.");
  }
  if (
    plan?.expectedVisitorCount != null &&
    plan.expectedVisitorCount !== stay.party.visitors
  ) {
    differences.push("Visitor count differs from the booked record.");
  }
  if (
    plan?.expectedArrivalTime &&
    stay.rules.currentCheckInTime &&
    plan.expectedArrivalTime < stay.rules.currentCheckInTime
  ) {
    differences.push("Estimated arrival is before campground check-in time.");
  }
  if (
    stay.payment.outstandingCents > 0 ||
    stay.payment.financialReviewRequired
  ) {
    differences.push(
      "Front desk must independently review the recorded balance or financial hold.",
    );
  }
  const reviewCurrent = Boolean(
    review &&
    plan &&
    plan.sourceReservationVersion === stay.reservation.rowVersion &&
    review.reviewedPlanVersion === plan.rowVersion &&
    review.reviewedReservationVersion === stay.reservation.rowVersion,
  );
  return {
    open,
    tasks,
    completed: tasks.filter((task) => task.complete).length,
    differences,
    reviewCurrent,
    staffReviewOutcome: reviewCurrent ? review.outcome : null,
    // A completed checklist or staff receipt never authorizes check-in,
    // gate credentials, charges, or an automatic status transition.
    checkInAuthorized: false,
  };
}
