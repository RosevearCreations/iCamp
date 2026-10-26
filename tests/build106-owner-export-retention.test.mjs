import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  normalizeOwnerExportReconciliation,
  normalizeOwnerExportRetention,
  classifyReconciliation,
  latestByReceipt,
  retentionState,
} from "../lib/permanent-unit-owner-retention/core.mjs";

const source = "106b0000-0000-4000-8000-000000000001";
const target = "106b0000-0000-4000-8000-000000000002";
const id = "106b0000-0000-4000-8000-000000000003";
const receipt = "106b0000-0000-4000-8000-000000000004";
const hash = "a".repeat(64);
const identity = {
  id,
  exportAcceptanceId: receipt,
  sourceCampgroundId: source,
  targetCampgroundId: target,
};
const observed = {
  ...identity,
  observedSha256: hash.toUpperCase(),
  observedCount: "25",
  evidenceReference: "owner-hash-confirmation-106",
  reconciliationNote: "Independent local CSV hash and row-count verification.",
};
const read = (path) =>
  readFileSync(new URL(path, import.meta.url), "utf8").toLowerCase();

test("reconciliation validates exact SHA-256, row limits and independent evidence references", () => {
  const value = normalizeOwnerExportReconciliation(observed);
  assert.equal(value.observedSha256, hash);
  assert.equal(value.observedCount, 25);
  for (const change of [
    { observedSha256: "not-a-digest" },
    { observedCount: "0" },
    { observedCount: "51" },
    { observedCount: "1.2" },
    { targetCampgroundId: source },
    { evidenceReference: "guest@example.org" },
    { reconciliationNote: "short" },
  ])
    assert.throws(() =>
      normalizeOwnerExportReconciliation({ ...observed, ...change }),
    );
  assert.equal(
    classifyReconciliation({ exportSha256: hash, exportRowCount: 25 }, value),
    "matched",
  );
  assert.equal(
    classifyReconciliation({ exportSha256: hash, exportRowCount: 24 }, value),
    "mismatch",
  );
});

test("retention enforces future bounded UTC due dates and explicit manual disposal confirmation", () => {
  const now = new Date("2026-10-25T00:00:00Z");
  const base = {
    ...identity,
    eventKind: "retained",
    retentionDueAt: "2026-12-01",
    evidenceReference: "secure-owner-storage-log",
    retentionNote:
      "The downloaded copy was placed in restricted owner storage.",
  };
  assert.match(
    normalizeOwnerExportRetention(base, now).retentionDueAt,
    /^2026-12-01/,
  );
  assert.equal(
    normalizeOwnerExportRetention({ ...base, eventKind: "extended" }, now)
      .eventKind,
    "extended",
  );
  assert.equal(
    normalizeOwnerExportRetention(
      {
        ...base,
        eventKind: "copy_disposed",
        retentionDueAt: "",
        confirmed: "yes",
      },
      now,
    ).retentionDueAt,
    null,
  );
  for (const change of [
    { eventKind: "unknown" },
    { retentionDueAt: "2026-10-24" },
    { retentionDueAt: "2027-12-01" },
    { retentionDueAt: "2026-02-30" },
    {
      eventKind: "copy_disposed",
      retentionDueAt: "2026-12-01",
      confirmed: "yes",
    },
    { eventKind: "copy_disposed", retentionDueAt: "", confirmed: "" },
    { retentionNote: "account number 123456789" },
  ])
    assert.throws(() =>
      normalizeOwnerExportRetention({ ...base, ...change }, now),
    );
});

test("latest reconciliation and retention states honor immutable historical ordering", () => {
  const later = {
    id: target,
    exportAcceptanceId: receipt,
    reconciledAt: "2026-10-25T11:00:00Z",
    result: "matched",
  };
  const earlier = {
    id: source,
    exportAcceptanceId: receipt,
    reconciledAt: "2026-10-25T10:00:00Z",
    result: "mismatch",
  };
  assert.equal(
    latestByReceipt([earlier, later], "reconciledAt").get(receipt).result,
    "matched",
  );
  const now = new Date("2026-10-25T12:00:00Z");
  assert.equal(retentionState(null, null, now), "requires_reconciliation");
  assert.equal(retentionState(later, null, now), "no_retention_plan");
  assert.equal(
    retentionState(
      later,
      { eventKind: "retained", retentionDueAt: "2026-10-25T13:00:00Z" },
      now,
    ),
    "retained",
  );
  assert.equal(
    retentionState(
      later,
      { eventKind: "extended", retentionDueAt: "2026-10-25T11:00:00Z" },
      now,
    ),
    "retention_overdue",
  );
  assert.equal(
    retentionState(
      later,
      { eventKind: "copy_disposed", retentionDueAt: null },
      now,
    ),
    "copy_disposed",
  );
});

test("SQL and backend gate owner permissions, independence, append-only chronology and manual-only disposal", () => {
  const schema = read(
    "../database/migrations/0137_owner_export_reconciliation_retention.sql",
  );
  const verify = read(
    "../database/verify/0137_owner_export_reconciliation_retention.sql",
  );
  const backend = read("../lib/permanent-unit-owner-retention/postgres.mjs");
  const page = read(
    "../app/workspaces/management/campgrounds/permanent-units/financing/owner-portfolio/planning/outcomes/review/evidence/retention/page.tsx",
  );
  for (const needle of [
    "force row level security",
    "winterization_append_only",
    "is_campground_finance_owner(source_campground_id)",
    "is_campground_finance_owner(target_campground_id)",
    "accepted_by_user_id=new.reconciled_by_user_id",
    "new.observed_sha256=receipt.export_sha256",
    "copy_disposed",
    "180 days",
    "pg_advisory_xact_lock",
    "result='matched'",
    "revoke all",
    "for insert to icamp_app",
  ])
    assert.ok(schema.includes(needle), needle);
  for (const needle of [
    "relforcerowsecurity",
    "has_table_privilege",
    "accepted_by_user_id",
    "180 days",
  ])
    assert.ok(verify.includes(needle), needle);
  for (const needle of [
    "set local role icamp_app",
    "getcampgroundauthorization",
    "owner_admin",
    "permanent_unit.transfer",
    "limit 31",
    "limit 301",
    "case when e.export_sha256=$4",
  ])
    assert.ok(backend.includes(needle), needle);
  assert.ok(page.includes('helptopic="permanent.owner-retention"'));
  assert.ok(page.includes("get-filehash"));
  for (const forbidden of [
    "update public.",
    "delete from public.",
    "insert into public.permanent_unit_financing",
    "buyer_display_name",
    "credit_score",
  ])
    assert.equal(backend.includes(forbidden), false, forbidden);
});
