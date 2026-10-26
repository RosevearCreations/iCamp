import { createHash } from "node:crypto";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const statuses = [
  "all",
  "awaiting_review",
  "revisit_needed",
  "supported_pending_acceptance",
  "accepted",
];
function dateOnly(raw, name) {
  const value = String(raw ?? "").trim();
  if (!value) return null;
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) !== value
  )
    throw new Error(`${name} must be a real UTC calendar date.`);
  return value;
}
function scopedId(value, name) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (!uuidPattern.test(raw)) throw new Error(`${name} is invalid.`);
  return raw;
}
function safeText(value, name, min, max) {
  const result = String(value ?? "").trim();
  if (result.length < min || result.length > max)
    throw new Error(`${name} must be ${min}–${max} characters.`);
  if (
    /@|\b(?:sin|ssn|bank.account|routing.number|credit.card)\b|\d{7,}/i.test(
      result,
    )
  )
    throw new Error(
      `${name} must not contain contact or financial identifiers.`,
    );
  return result;
}
export function normalizeEvidenceSearch(input = {}) {
  const sourceCampgroundId = scopedId(
    input.sourceCampgroundId,
    "Source campground",
  );
  const targetCampgroundId = scopedId(
    input.targetCampgroundId,
    "Target campground",
  );
  if (
    sourceCampgroundId &&
    targetCampgroundId &&
    sourceCampgroundId === targetCampgroundId
  )
    throw new Error("Cross-campground search requires distinct properties.");
  const status = String(input.status ?? "all").trim();
  if (!statuses.includes(status))
    throw new Error("Invalid review evidence state.");
  const query = String(input.query ?? "").trim();
  if (query.length > 100 || /[\u0000-\u001f]/.test(query))
    throw new Error(
      "Evidence search must be at most 100 printable characters.",
    );
  const from = dateOnly(input.from, "Start date");
  const to = dateOnly(input.to, "End date");
  if (from && to && from > to)
    throw new Error("Start date must precede end date.");
  const page = Number(input.page ?? 1);
  if (!Number.isSafeInteger(page) || page < 1 || page > 20)
    throw new Error("Search pages must be between 1 and 20.");
  return {
    sourceCampgroundId,
    targetCampgroundId,
    status,
    query,
    from,
    to,
    page,
  };
}
export function normalizeEvidenceExport(input = {}) {
  const filter = normalizeEvidenceSearch({ ...input, page: 1 });
  if (!filter.sourceCampgroundId || !filter.targetCampgroundId)
    throw new Error(
      "Choose both the source and target campground before exporting.",
    );
  if (String(input.confirmed ?? "") !== "yes")
    throw new Error("Explicit restricted-export acknowledgement is required.");
  const id = scopedId(input.id, "Export receipt");
  if (!id) throw new Error("Export receipt identifier is required.");
  return {
    ...filter,
    id,
    evidenceReference: safeText(
      input.evidenceReference,
      "Export source reference",
      8,
      400,
    ),
    acceptanceNote: safeText(
      input.acceptanceNote,
      "Export acceptance note",
      12,
      800,
    ),
  };
}
export function evidenceStatus(row) {
  if (row.acceptanceId) return "accepted";
  if (!row.reassessmentId) return "awaiting_review";
  if (row.reviewKind === "resolution_supported")
    return "supported_pending_acceptance";
  return "revisit_needed";
}
export function csvCell(input) {
  let value = String(input ?? "");
  // Prevent spreadsheet formula execution even when source evidence was entered earlier.
  if (/^[\s]*[=+\-@\t\r]/.test(value)) value = `'${value}`;
  return `"${value.replaceAll('"', '""')}"`;
}
export function renderEvidenceCsv(rows) {
  const columns = [
    ["Resolution ID", "resolutionId"],
    ["Plan ID", "planId"],
    ["Source campground ID", "sourceCampgroundId"],
    ["Target campground ID", "targetCampgroundId"],
    ["Resolution date UTC", "resolvedAt"],
    ["Resolution status", "resolutionKind"],
    ["Resolution evidence reference", "resolutionEvidenceReference"],
    ["Independent review ID", "reassessmentId"],
    ["Latest review date UTC", "reviewedAt"],
    ["Review outcome", "reviewKind"],
    ["Review evidence reference", "reviewEvidenceReference"],
    ["Acceptance ID", "acceptanceId"],
    ["Acceptance date UTC", "acceptedAt"],
    ["Acceptance evidence reference", "acceptanceEvidenceReference"],
    ["Workflow state", "status"],
  ];
  const lines = [columns.map(([name]) => csvCell(name)).join(",")];
  for (const row of rows)
    lines.push(columns.map(([, key]) => csvCell(row[key])).join(","));
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}
export function csvDigest(csv) {
  return createHash("sha256").update(csv, "utf8").digest("hex");
}
