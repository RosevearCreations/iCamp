export const serviceOperatingStatuses = Object.freeze([
  "unknown",
  "reported_open",
  "reported_closed",
]);

export const serviceOperatingStatusLabels = Object.freeze({
  unknown: "Operating status not confirmed",
  reported_open: "Campground reported open at last review",
  reported_closed: "Campground reported temporarily closed at last review",
});

function textField(value, label, limit) {
  const text = String(value ?? "").trim();
  if (
    text.length > limit ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(text)
  ) {
    throw new Error(
      `${label} must contain at most ${limit} readable characters.`,
    );
  }
  return text;
}

export function normalizeAmenityServiceReview(input = {}) {
  const operatingStatus = String(input.operatingStatus ?? "unknown").trim();
  if (!serviceOperatingStatuses.includes(operatingStatus)) {
    throw new Error("Choose a valid campground-reported operating status.");
  }
  const hoursSummary = textField(input.hoursSummary, "Operating hours", 450);
  const accessibilityDetails = textField(
    input.accessibilityDetails,
    "Accessibility details",
    500,
  );
  const publish = input.publish === true;
  if (publish && input.confirmed !== true) {
    throw new Error(
      "Confirm that the campground reviewed these details before publishing.",
    );
  }
  if (
    publish &&
    operatingStatus === "unknown" &&
    !hoursSummary &&
    !accessibilityDetails
  ) {
    throw new Error("Add reviewed service information before publishing.");
  }
  return { operatingStatus, hoursSummary, accessibilityDetails, publish };
}

export function publicAmenityService(row) {
  if (
    !row?.serviceReviewedAt ||
    !serviceOperatingStatuses.includes(row.serviceOperatingStatus)
  )
    return null;
  const reviewedAt = new Date(row.serviceReviewedAt);
  if (!Number.isFinite(reviewedAt.getTime())) return null;
  return {
    operatingStatus: row.serviceOperatingStatus,
    hoursSummary: String(row.serviceHoursSummary ?? ""),
    accessibilityDetails: String(row.serviceAccessibilityDetails ?? ""),
    reviewedAt: reviewedAt.toISOString(),
  };
}
