const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const digestPattern = /^[0-9a-f]{64}$/;
const allowedEvents = ["retained", "extended", "copy_disposed"];
function uuid(raw, name) {
  const value = String(raw ?? "").trim();
  if (!uuidPattern.test(value))
    throw new Error(`${name} must be a valid identifier.`);
  return value;
}
function safeNote(raw, name, min, max) {
  const value = String(raw ?? "").trim();
  if (value.length < min || value.length > max)
    throw new Error(`${name} must be between ${min} and ${max} characters.`);
  if (
    /@|\b(?:sin|ssn|bank.account|routing.number|credit.card)\b|\d{7,}/i.test(
      value,
    )
  )
    throw new Error(
      `${name} must not contain contact or financial identifiers.`,
    );
  return value;
}
function identity(raw) {
  const sourceCampgroundId = uuid(raw.sourceCampgroundId, "Source campground");
  const targetCampgroundId = uuid(raw.targetCampgroundId, "Target campground");
  if (sourceCampgroundId === targetCampgroundId)
    throw new Error("Export must cover two distinct campground scopes.");
  return {
    id: uuid(raw.id, "New ledger record"),
    exportAcceptanceId: uuid(
      raw.exportAcceptanceId,
      "Source export acceptance receipt",
    ),
    sourceCampgroundId,
    targetCampgroundId,
  };
}
export function normalizeOwnerExportReconciliation(raw) {
  const observedCount = Number(raw.observedCount);
  const observedSha256 = String(raw.observedSha256 ?? "")
    .trim()
    .toLowerCase();
  if (
    !Number.isInteger(observedCount) ||
    observedCount < 1 ||
    observedCount > 50
  )
    throw new Error(
      "Observed CSV row count must be a whole number from 1 to 50.",
    );
  if (!digestPattern.test(observedSha256))
    throw new Error(
      "Observed SHA-256 must have exactly 64 hexadecimal characters.",
    );
  return {
    ...identity(raw),
    observedCount,
    observedSha256,
    evidenceReference: safeNote(
      raw.evidenceReference,
      "Reconciliation evidence reference",
      8,
      400,
    ),
    reconciliationNote: safeNote(
      raw.reconciliationNote,
      "Reconciliation note",
      12,
      800,
    ),
  };
}
export function normalizeOwnerExportRetention(raw, now = new Date()) {
  const eventKind = String(raw.eventKind ?? "").trim();
  if (!allowedEvents.includes(eventKind))
    throw new Error("Unknown export-copy retention event.");
  const supplied = String(raw.retentionDueAt ?? "").trim();
  let retentionDueAt = null;
  if (eventKind === "copy_disposed") {
    if (supplied)
      throw new Error(
        "Disposal attestation must not have an active retention deadline.",
      );
    if (String(raw.confirmed ?? "") !== "yes")
      throw new Error(
        "Copy-disposal attestation requires an explicit acknowledgement.",
      );
  } else {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(supplied))
      throw new Error("Retention deadline must be a UTC calendar date.");
    const due = new Date(`${supplied}T23:59:00.000Z`);
    if (
      !Number.isFinite(due.getTime()) ||
      due.toISOString().slice(0, 10) !== supplied ||
      due <= now ||
      due.getTime() > now.getTime() + 180 * 86400000
    )
      throw new Error(
        "Active retention must have a future deadline within 180 days.",
      );
    retentionDueAt = due.toISOString();
  }
  return {
    ...identity(raw),
    eventKind,
    retentionDueAt,
    evidenceReference: safeNote(
      raw.evidenceReference,
      "Retention evidence reference",
      8,
      400,
    ),
    retentionNote: safeNote(
      raw.retentionNote,
      "Retention/disposal attestation",
      12,
      800,
    ),
  };
}
export function classifyReconciliation(receipt, observation) {
  return receipt.exportSha256 === observation.observedSha256 &&
    receipt.exportRowCount === observation.observedCount
    ? "matched"
    : "mismatch";
}
export function latestByReceipt(items, timestampKey) {
  const map = new Map();
  for (const row of [...items].sort(
    (a, b) =>
      b[timestampKey].localeCompare(a[timestampKey]) ||
      b.id.localeCompare(a.id),
  )) {
    if (!map.has(row.exportAcceptanceId)) map.set(row.exportAcceptanceId, row);
  }
  return map;
}
export function retentionState(reconciliation, event, now = new Date()) {
  if (!reconciliation || reconciliation.result !== "matched")
    return "requires_reconciliation";
  if (!event) return "no_retention_plan";
  if (event.eventKind === "copy_disposed") return "copy_disposed";
  if (new Date(event.retentionDueAt) < now) return "retention_overdue";
  return "retained";
}
