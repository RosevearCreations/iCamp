const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export function reconciliationId(value) {
  const id = String(value ?? "").trim();
  if (!UUID.test(id)) throw new Error("Credential identifier must be a UUID.");
  return id;
}

export function normalizeReconciliationReview(input) {
  const disposition = String(input.disposition ?? "").trim();
  if (!["acknowledged", "override_reviewed"].includes(disposition)) {
    throw new Error("Reconciliation review decision is invalid.");
  }
  const reason = String(input.reason ?? "").trim();
  if (reason.length < 20 || reason.length > 1000) {
    throw new Error("A review reason of 20–1000 characters is required.");
  }
  const rowVersion = Number(input.rowVersion);
  if (!Number.isSafeInteger(rowVersion) || rowVersion < 1) {
    throw new Error("Current credential version is required.");
  }
  return { disposition, reason, rowVersion };
}

// This verdict is only for iCamp-side admission; it never actuates physical devices.
// A recorded override never changes a denied result or resurrects a revoked pass.
export function evaluateCredentialAdmission(record, now = new Date()) {
  const instant = new Date(now);
  if (!Number.isFinite(instant.getTime()))
    throw new Error("Invalid review time.");
  const at = instant.getTime();
  const from = record.validFrom ? new Date(record.validFrom).getTime() : NaN;
  const until = record.validUntil
    ? new Date(record.validUntil).getTime()
    : null;

  if (record.status !== "active") return { allowed: false, reason: "revoked" };
  if (!Number.isFinite(from) || at < from) {
    return { allowed: false, reason: "not_yet_valid" };
  }
  if (until !== null && (!Number.isFinite(until) || at >= until)) {
    return { allowed: false, reason: "expired" };
  }
  if (record.sourceKind === "visitor" || record.sourceKind === "vehicle_pass") {
    if (record.sourceStatus !== "active") {
      return { allowed: false, reason: "source_inactive" };
    }
    const start = new Date(record.sourceValidFrom).getTime();
    const end = new Date(record.sourceValidUntil).getTime();
    if (
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      at < start ||
      at >= end
    ) {
      return { allowed: false, reason: "source_outside_window" };
    }
    if (Number(record.duplicateCount) > 1) {
      return { allowed: false, reason: "duplicate_assignment" };
    }
  }
  if (
    record.sourceKind === "reservation" &&
    record.sourceStatus !== "checked_in"
  ) {
    return { allowed: false, reason: "stay_inactive" };
  }
  if (record.assignmentStatus && record.assignmentStatus !== "active") {
    return { allowed: false, reason: "assignment_ended" };
  }
  return { allowed: true, reason: "valid_in_app" };
}
