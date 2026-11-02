const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
export const vendorCategories = Object.freeze([
  "waste",
  "septic",
  "repairs",
  "infrastructure",
  "grounds",
  "other",
]);
export const vendorEventKinds = Object.freeze([
  "response",
  "progress",
  "followup",
  "completed",
  "cancelled",
  "invoice_intake",
  "invoice_reviewed",
]);
const clean = (value) => String(value ?? "").trim();
export function vendorUuid(value, label = "ID") {
  const id = clean(value);
  if (!uuidPattern.test(id)) throw new Error(label + " must be a UUID.");
  return id.toLowerCase();
}
function optionalUuid(value, label) {
  return clean(value) ? vendorUuid(value, label) : null;
}
function bounded(value, label, min, max) {
  const t = clean(value);
  if (t.length < min || t.length > max)
    throw new Error(label + ` must be ${min}–${max} characters.`);
  return t;
}
function optionalText(value, label, min, max) {
  return clean(value) ? bounded(value, label, min, max) : null;
}
function integer(value, label, min, max) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max)
    throw new Error(label + ` must be ${min}–${max}.`);
  return n;
}
export function vendorDate(value, label) {
  const text = clean(value);
  if (
    !/^\d{4}-\d{2}-\d{2}$/u.test(text) ||
    Number.isNaN(new Date(text + "T00:00:00Z").getTime()) ||
    new Date(text + "T00:00:00Z").toISOString().slice(0, 10) !== text
  )
    throw new Error(label + " must be a valid date.");
  return text;
}
export function normalizeVendorProfile(input) {
  const category = clean(input?.serviceCategory);
  if (!vendorCategories.includes(category))
    throw new Error("Vendor category is invalid.");
  const email = optionalText(input?.contactEmail, "Contact email", 6, 254);
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/u.test(email))
    throw new Error("Contact email is invalid.");
  return {
    id: vendorUuid(input?.id, "Vendor ID"),
    displayName: bounded(input?.displayName, "Vendor name", 3, 160),
    serviceCategory: category,
    contactName: optionalText(input?.contactName, "Contact name", 2, 160),
    contactEmail: email,
    contactPhone: optionalText(input?.contactPhone, "Contact phone", 7, 40),
    privateNote: bounded(input?.privateNote, "Private vendor note", 12, 1000),
  };
}
export function normalizeVendorContract(input) {
  const from = vendorDate(input?.validFrom, "Contract start"),
    expires = vendorDate(input?.expiresOn, "Contract expiry");
  if (expires < from) throw new Error("Contract expiry must follow the start.");
  return {
    id: vendorUuid(input?.id, "Contract ID"),
    vendorId: vendorUuid(input?.vendorId, "Vendor ID"),
    supersedesContractId: optionalUuid(
      input?.supersedesContractId,
      "Previous contract ID",
    ),
    contractReference: bounded(
      input?.contractReference,
      "Contract reference",
      8,
      120,
    ),
    title: bounded(input?.title, "Contract title", 8, 200),
    validFrom: from,
    expiresOn: expires,
    responseTargetHours: integer(
      input?.responseTargetHours,
      "Response hours",
      1,
      168,
    ),
    completionTargetDays: integer(
      input?.completionTargetDays,
      "Completion days",
      1,
      180,
    ),
    documentMediaId: optionalUuid(
      input?.documentMediaId,
      "Confidential document ID",
    ),
    privateNote: bounded(input?.privateNote, "Contract review note", 12, 1500),
  };
}
export function normalizeVendorRecurring(input) {
  return {
    id: vendorUuid(input?.id, "Recurring plan ID"),
    vendorId: vendorUuid(input?.vendorId, "Vendor ID"),
    contractId: optionalUuid(input?.contractId, "Contract ID"),
    supersedesPlanId: optionalUuid(input?.supersedesPlanId, "Previous plan ID"),
    serviceLabel: bounded(input?.serviceLabel, "Service label", 8, 160),
    cadenceDays: integer(input?.cadenceDays, "Cadence days", 1, 365),
    nextDueOn: vendorDate(input?.nextDueOn, "Next due date"),
    privateNote: bounded(input?.privateNote, "Recurring plan note", 12, 1000),
  };
}
export function normalizeVendorRequest(input) {
  return {
    id: vendorUuid(input?.id, "Request ID"),
    vendorId: vendorUuid(input?.vendorId, "Vendor ID"),
    contractId: optionalUuid(input?.contractId, "Contract ID"),
    recurringPlanId: optionalUuid(input?.recurringPlanId, "Recurring plan ID"),
    workOrderId: optionalUuid(input?.workOrderId, "Work order ID"),
    title: bounded(input?.title, "Request title", 8, 180),
    requestDescription: bounded(
      input?.requestDescription,
      "Request detail",
      20,
      2000,
    ),
    responseTargetHours: integer(
      input?.responseTargetHours,
      "Response hours",
      1,
      168,
    ),
    completionTargetDays: integer(
      input?.completionTargetDays,
      "Completion days",
      1,
      180,
    ),
  };
}
export function normalizeVendorEvent(input) {
  const kind = clean(input?.kind);
  if (!vendorEventKinds.includes(kind))
    throw new Error("Vendor event type is invalid.");
  const sourceReference = optionalText(
    input?.sourceReference,
    "Source reference",
    8,
    200,
  );
  if (
    ["response", "completed", "invoice_intake"].includes(kind) &&
    !sourceReference
  )
    throw new Error(
      "External source or invoice reference required for this evidence.",
    );
  return {
    id: vendorUuid(input?.id, "Vendor event ID"),
    requestId: vendorUuid(input?.requestId, "Vendor request ID"),
    kind,
    sourceReference,
    note: bounded(input?.note, "Evidence note", 20, 1500),
    evidenceMediaId: optionalUuid(
      input?.evidenceMediaId,
      "Confidential evidence ID",
    ),
    reviewsEventId:
      kind === "invoice_reviewed"
        ? vendorUuid(input?.reviewsEventId, "Invoice intake ID")
        : null,
  };
}
export function assessVendorRequest(request, events, now = new Date()) {
  const related = events
    .filter((e) => e.requestId === request.id)
    .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
  const hasResponse = related.some((e) => e.kind === "response");
  const closed = related.some((e) =>
    ["completed", "cancelled"].includes(e.kind),
  );
  const pendingInvoices = related.filter(
    (e) =>
      e.kind === "invoice_intake" &&
      !related.some(
        (r) => r.kind === "invoice_reviewed" && r.reviewsEventId === e.id,
      ),
  );
  const flags = [];
  if (!hasResponse && !closed && new Date(request.responseDueAt) < now)
    flags.push("response_overdue");
  if (!closed && new Date(request.completionDueAt) < now)
    flags.push("completion_overdue");
  if (pendingInvoices.length) flags.push("invoice_intake_unreviewed");
  if (related.some((e) => e.kind === "followup"))
    flags.push("followup_evidence");
  return {
    flags,
    closed,
    hasResponse,
    pendingInvoices: pendingInvoices.length,
    status: closed
      ? related.some((e) => e.kind === "cancelled")
        ? "cancelled"
        : "completed"
      : hasResponse
        ? "response_recorded"
        : "awaiting_response",
  };
}
export function assessVendorContract(contract, contracts, now = new Date()) {
  const superseded = contracts.some(
    (c) => c.supersedesContractId === contract.id,
  );
  const daysRemaining = Math.ceil(
    (new Date(contract.expiresOn + "T23:59:59Z").getTime() - now.getTime()) /
      86_400_000,
  );
  return {
    superseded,
    daysRemaining,
    flag: superseded
      ? "superseded"
      : daysRemaining < 0
        ? "expired"
        : daysRemaining <= 30
          ? "expires_soon"
          : "current",
  };
}
export function assessVendorRecurring(plan, plans, now = new Date()) {
  const superseded = plans.some((p) => p.supersedesPlanId === plan.id);
  const daysUntil = Math.ceil(
    (new Date(plan.nextDueOn + "T23:59:59Z").getTime() - now.getTime()) /
      86_400_000,
  );
  return {
    superseded,
    daysUntil,
    flag: superseded
      ? "superseded"
      : daysUntil < 0
        ? "due_overdue"
        : daysUntil <= 14
          ? "due_soon"
          : "planned",
  };
}
