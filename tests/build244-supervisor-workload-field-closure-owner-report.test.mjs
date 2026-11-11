import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  validateFieldClosureEvidence,
  buildSupervisorWorkloadForecast,
  buildOwnerShiftPerformanceReport,
} from "../lib/booking-charges/fulfillment-performance-core.mjs";

const read = (name) =>
  readFileSync(new URL(`../${name}`, import.meta.url), "utf8");
const id = "11111111-2222-4333-8444-555555555555";
const id2 = "11111111-2222-4333-8444-666666666666";

test("field closure requires current UUID inputs, safe evidence refs, meaningful reason", () => {
  const good = {
    dispatchId: id,
    fieldReportId: id2,
    reviewId: id,
    decision: "closure_reviewed",
    evidenceReference: "FIELD-REPORT-12345",
    note: "Reviewer inspected the current field report.",
  };
  assert.equal(validateFieldClosureEvidence(good).previousEventId, null);
  assert.equal(
    validateFieldClosureEvidence({ ...good, previousEventId: id2 })
      .previousEventId,
    id2,
  );
  for (const change of [
    { fieldReportId: "not-uuid" },
    { decision: "independent_accept" },
    { evidenceReference: "https://example.com/?token=PRIVATE" },
    { note: "short" },
    { previousEventId: "stale" },
  ]) {
    assert.throws(() => validateFieldClosureEvidence({ ...good, ...change }));
  }
});

test("workload forecast is deterministic, bounded by observed source events and never authorizes staffing", () => {
  const trend = {
    days: 7,
    truncated: false,
    buckets: [
      { escalations: 6, deviceBlockers: 3, handoffRequests: 0 },
      ...Array.from({ length: 6 }, () => ({
        escalations: 1,
        deviceBlockers: 0,
        handoffRequests: 1,
      })),
    ],
  };
  const result = buildSupervisorWorkloadForecast({
    trend,
    openCases: 8,
    pendingHandoffs: 3,
    asOf: "2026-11-11T10:00:00Z",
  });
  assert.equal(result.observedDemandEvents, 18);
  assert.equal(result.expectedNewReviewEvents, 1);
  assert.equal(result.planningLoad, 9);
  assert.equal(result.peakDailyShiftEquivalent, 2);
  assert.equal(result.automatedStaffing, false);
  assert.equal(result.independentAcceptance, "HOLD");
  const partial = buildSupervisorWorkloadForecast({
    trend,
    openCases: 8,
    pendingHandoffs: 3,
    asOf: "2026-11-11T10:00:00Z",
    truncated: true,
  });
  assert.equal(partial.evidenceCoverage, "PARTIAL_HOLD");
  assert.throws(() =>
    buildSupervisorWorkloadForecast({
      trend,
      openCases: -1,
      pendingHandoffs: 3,
      asOf: "2026-11-11T10:00:00Z",
    }),
  );
});

test("owner report aggregates latest closure decisions without identity or free-text leakage", () => {
  const report = buildOwnerShiftPerformanceReport({
    campgroundId: id,
    sourceRevision: "1".repeat(40),
    asOf: "2026-11-11T10:00:00Z",
    trend: { days: 7 },
    forecast: { independentAcceptance: "HOLD" },
    closures: [
      {
        dispatchId: id,
        decision: "recheck_required",
        note: "sensitive private note",
        recordedByUserId: id2,
      },
      {
        dispatchId: id,
        decision: "closure_reviewed",
        note: "older",
        recordedByUserId: id2,
      },
      {
        dispatchId: id2,
        decision: "closure_reviewed",
        note: "private",
        recordedByUserId: id,
      },
    ],
    truncated: true,
  });
  assert.equal(report.fieldClosureReviews, 1);
  assert.equal(report.fieldRechecks, 1);
  assert.equal(report.sourceCoverage, "PARTIAL_HOLD");
  assert.equal(report.masterConnection, "HOLD");
  assert.equal(report.independentlyVerifiedFieldAcceptance, false);
  assert.doesNotMatch(
    JSON.stringify(report),
    /sensitive private note|recordedByUserId/u,
  );
});

test("Build 244 source enforces owner gate, RLS, latest report/review and immutable writes", () => {
  const sql = read(
    "database/migrations/0228_build244_field_closure_evidence.sql",
  );
  const api = read(
    "app/api/management/fulfillment-supervisor/shift-performance/route.ts",
  );
  const db = read("lib/booking-charges/fulfillment-performance-postgres.mjs");
  const view = read(
    "app/workspaces/management/campgrounds/fulfillment-priority/page.tsx",
  );
  const manifest = JSON.parse(
    read("public/.well-known/rosevear-integration-manifest.json"),
  );
  assert.match(sql, /force row level security/u);
  assert.match(sql, /latest_report\.id is distinct from new\.field_report_id/u);
  assert.match(sql, /latest_review\.id is distinct from new\.review_id/u);
  assert.match(sql, /latest_review\.decision <> 'reviewed_unverified'/u);
  assert.match(
    sql,
    /latest_report\.reported_by_user_id is not distinct from new\.recorded_by_user_id/u,
  );
  assert.match(
    sql,
    /grant select,insert on public\.service_fulfillment_field_closure_events to icamp_app/u,
  );
  assert.doesNotMatch(sql, /grant\s+(update|delete)/iu);
  assert.match(db, /set local role icamp_app/u);
  assert.match(api, /roleCodes\.includes\("owner_admin"\)/u);
  assert.match(api, /session\.user\.accountType !== "staff"/u);
  assert.match(api, /private, no-store/u);
  assert.match(view, /Independent device acceptance remains/u);
  assert.equal(
    manifest.source_revision,
    "1f29c23f5fba7c2326e09873ebff42223622044b",
  );
  assert.equal(manifest.tenant_boundary, "platform_shell");
  assert.equal(manifest.signature.key_id, null);
  assert.equal(manifest.connection_state, "DISCONNECTED / HOLD");
});
