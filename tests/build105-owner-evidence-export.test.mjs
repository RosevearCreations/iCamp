import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  normalizeEvidenceSearch,
  normalizeEvidenceExport,
  evidenceStatus,
  csvCell,
  renderEvidenceCsv,
  csvDigest,
} from "../lib/permanent-unit-owner-evidence/core.mjs";

const source = "105b0000-0000-4000-8000-000000000001";
const target = "105b0000-0000-4000-8000-000000000002";
const id = "105b0000-0000-4000-8000-000000000003";
const receiptInput = {
  id,
  sourceCampgroundId: source,
  targetCampgroundId: target,
  confirmed: "yes",
  evidenceReference: "audit-review-105",
  acceptanceNote: "Owner confirms this restricted internal metadata extract.",
};
const read = (path) =>
  readFileSync(new URL(path, import.meta.url), "utf8").toLowerCase();

test("literal search normalizes scopes, statuses, dates and bounded pagination", () => {
  const f = normalizeEvidenceSearch({
    sourceCampgroundId: source,
    targetCampgroundId: target,
    status: "accepted",
    query: " Ref_100% ",
    from: "2026-01-01",
    to: "2026-10-25",
    page: "20",
  });
  assert.equal(f.query, "Ref_100%");
  assert.equal(f.page, 20);
  for (const update of [
    { sourceCampgroundId: target },
    { status: "approve_loan" },
    { page: 21 },
    { page: 0 },
    { page: 1.5 },
    { from: "2026-02-30" },
    { to: "2025-12-31" },
    { query: "x".repeat(101) },
  ])
    assert.throws(() => normalizeEvidenceSearch({ ...f, ...update }));
});
test("export requires a distinct exact campground pair and explicit owner acceptance", () => {
  assert.equal(normalizeEvidenceExport(receiptInput).id, id);
  for (const update of [
    { id: "" },
    { sourceCampgroundId: "" },
    { targetCampgroundId: source },
    { confirmed: "" },
    { acceptanceNote: "short" },
    { evidenceReference: "bank 123456789" },
  ])
    assert.throws(() =>
      normalizeEvidenceExport({ ...receiptInput, ...update }),
    );
});
test("status reflects only the latest review plus immutable acceptance", () => {
  assert.equal(evidenceStatus({}), "awaiting_review");
  assert.equal(
    evidenceStatus({
      reassessmentId: id,
      reviewKind: "resolution_requires_revisit",
    }),
    "revisit_needed",
  );
  assert.equal(
    evidenceStatus({ reassessmentId: id, reviewKind: "resolution_supported" }),
    "supported_pending_acceptance",
  );
  assert.equal(
    evidenceStatus({ reassessmentId: id, acceptanceId: target }),
    "accepted",
  );
});
test("CSV guards against formula injection and yields a deterministic SHA-256 receipt", () => {
  for (const input of ["=1+1", "+cmd", "-2+3", "@sum", " \t=2"]) {
    assert.equal(csvCell(input), `"'${input}"`);
  }
  assert.equal(csvCell('say "hello"'), '"say ""hello"""');
  const csv = renderEvidenceCsv([
    {
      resolutionId: id,
      planId: id,
      sourceCampgroundId: source,
      targetCampgroundId: target,
      resolvedAt: "2026-10-25T00:00:00.000Z",
      resolutionKind: "coordinated",
      resolutionEvidenceReference: "=cmd",
      reassessmentId: null,
      reviewedAt: null,
      reviewKind: null,
      reviewEvidenceReference: null,
      acceptanceId: null,
      acceptedAt: null,
      acceptanceEvidenceReference: null,
      status: "awaiting_review",
    },
  ]);
  assert.ok(csv.startsWith("\uFEFF"));
  assert.ok(csv.includes('"\'=cmd"'));
  assert.match(csvDigest(csv), /^[a-f0-9]{64}$/);
  assert.equal(csvDigest(csv), csvDigest(csv));
  assert.equal(csv.includes("reviewer_note"), false);
});
test("database and backend enforce immutable owner-only export receipts and 50-row cap", () => {
  const schema = read(
    "../database/migrations/0136_owner_resolution_evidence_exports.sql",
  );
  const verify = read(
    "../database/verify/0136_owner_resolution_evidence_exports.sql",
  );
  const pg = read("../lib/permanent-unit-owner-evidence/postgres.mjs");
  const route = read("../app/api/owner-finance/evidence/export/route.ts");
  for (const needle of [
    "force row level security",
    "winterization_append_only",
    "is_campground_finance_owner(source_campground_id)",
    "is_campground_finance_owner(target_campground_id)",
    "accepted_by_user_id",
    "revoke all",
  ])
    assert.ok(schema.includes(needle), needle);
  for (const needle of [
    "relforcerowsecurity",
    "has_table_privilege",
    "immutab",
    "dual-campground",
  ])
    assert.ok(verify.includes(needle), needle);
  for (const needle of [
    "repeatable read",
    "set local role icamp_app",
    "getcampgroundauthorization",
    "owner_admin",
    "permanent_unit.transfer",
    "rows.length > 50",
    "export_sha256",
    "limit $9",
    "ilike",
    "source_campground_id=any",
    "target_campground_id=any",
  ])
    assert.ok(pg.includes(needle), needle);
  for (const needle of [
    "origin",
    "getcurrentsession",
    "text/csv",
    "no-store",
    "attachment",
  ])
    assert.ok(route.includes(needle), needle);
  for (const forbidden of [
    "update public.",
    "delete from public.",
    "insert into public.permanent_unit_financing",
    "credit_score",
    "buyer_display_name",
  ])
    assert.equal(pg.includes(forbidden), false, forbidden);
});
