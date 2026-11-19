const UUID264 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export function normalizeRentalAllocation264(input) {
  const requestId = String(input?.requestId ?? "").trim();
  const staffSafetyReview = String(input?.staffSafetyReview ?? "").trim();
  if (!UUID264.test(requestId))
    throw new Error("Original rental request ID is invalid.");
  if (
    staffSafetyReview.length < 20 ||
    staffSafetyReview.length > 500 ||
    /\p{Cc}/u.test(staffSafetyReview)
  )
    throw new Error(
      "Required staff equipment, insurance and collection review must be 20–500 characters.",
    );
  return {
    requestId,
    staffSafetyReview,
    status: "reserved_for_staff_collection",
    paymentCaptured: false,
    equipmentHandedOver: false,
    animalAssigned: false,
  };
}

export function normalizeSupervisedPilot264(input) {
  const sessionId = String(input?.sessionId ?? "").trim();
  const outcome = String(input?.outcome ?? "").trim();
  const originalEvidenceReference = String(
    input?.originalEvidenceReference ?? "",
  ).trim();
  const supervisionWelfareCheck = String(
    input?.supervisionWelfareCheck ?? "",
  ).trim();
  if (!UUID264.test(sessionId))
    throw new Error("Original guided session ID is invalid.");
  if (!["hold", "accepted_for_internal_pilot"].includes(outcome))
    throw new Error(
      "Pilot acceptance must be HOLD or internal-only acceptance.",
    );
  if (!/^[A-Za-z0-9:._/ -]{12,150}$/u.test(originalEvidenceReference))
    throw new Error("Use a bounded non-sensitive original evidence reference.");
  if (
    supervisionWelfareCheck.length < 30 ||
    supervisionWelfareCheck.length > 650 ||
    /\p{Cc}/u.test(supervisionWelfareCheck)
  )
    throw new Error(
      "A human-reviewed supervision and welfare assessment (30–650 characters) is required.",
    );
  return {
    sessionId,
    outcome,
    originalEvidenceReference,
    supervisionWelfareCheck,
    guestEnrollmentEnabled: false,
    liveActivityBookingEnabled: false,
    insuranceCertified: false,
  };
}

export function rentalReservationLabel264(status) {
  return status === "reserved_for_staff_collection"
    ? "Staff reserved this physical item for your stay. No payment or pickup completed; contact the campground."
    : status === "cancelled"
      ? "The staff-only equipment reservation was cancelled. Contact the campground if you still need the item."
      : "No staff-authorized equipment reservation is confirmed.";
}
