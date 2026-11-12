import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  validateIndependentFieldWitness,
  validateOwnerShiftAudit,
  evaluateForecastCheckpoint,
  buildWitnessAuditSummary,
} from "../lib/booking-charges/fulfillment-witness-core.mjs";

const id = "11111111-2222-4333-8444-555555555555";
const another = "11111111-2222-4333-8444-666666666666";
const read = (name) =>
  readFileSync(new URL("../" + name, import.meta.url), "utf8");

test("independent witness accepts only current source identifiers and non-secret evidence", () => {
  const valid = {
    dispatchId: id,
    closureId: another,
    decision: "observed_unverified",
    evidenceReference: "FIELD-OBSERVATION-123",
    explanation: "Observed current source evidence on site.",
  };
  assert.equal(
    validateIndependentFieldWitness(valid).previousWitnessId,
    null,
  );
  assert.equal(
    validateIndependentFieldWitness({
      ...valid,
      previousWitnessId: id,
    }).previousWitnessId,
    id,
  );
  for (const invalid of [
    { dispatchId: "not-uuid" },
    { closureId: "not-uuid" },
    { previousWitnessId: "stale" },
    { decision: "cryptographic_accept" },
    { evidenceReference: "https://host.test/?token=SECRET" },
    { explanation: "short" },
  ]) {
    assert.throws(() =>
      validateIndependentFieldWitness({ ...valid, ...invalid }),
    );
  }
});

test("owner shift audit requires supported subject, decision and explanation", () => {
  const valid = {
    subjectKind: "field_witness",
    subjectId: id,
    decision: "reviewed_unverified",
    explanation: "The human witness needs source-only signoff.",
  };
  assert.equal(validateOwnerShiftAudit(valid).subjectId, id);
  for (const invalid of [
    { subjectKind: "master_connection" },
    { subjectId: "stale" },
    { decision: "approve_device" },
    { explanation: "bad" },
  ]) {
    assert.throws(() => validateOwnerShiftAudit({ ...valid, ...invalid }));
  }
});

test("forecast checkpoint accuracy is retrospective, duplicate-safe by event category and never creates acceptance", () => {
  const checkpoint = {
    id,
    capturedAt: "2026-11-11T10:00:00.000Z",
    expectedNewReviewEvents: 3,
    planningLoad: 8,
    evidenceCoverage: "SOURCE_SNAPSHOT_ONLY",
  };
  const reviews = [
    { id, decision: "blocker_escalated", reviewedAt: "2026-11-11T11:00:00.000Z" },
    { id: another, decision: "followup_resolved", reviewedAt: "2026-11-11T12:00:00.000Z" },
    { id: "a", decision: "escalation_requested", reviewedAt: "2026-11-11T18:00:00.000Z" },
  ];
  const handoffs = [
    { id: another, eventKind: "request", recordedAt: "2026-11-11T17:59:00.000Z" },
    { id: id, eventKind: "accept", recordedAt: "2026-11-11T13:00:00.000Z" },
  ];
  const pending = evaluateForecastCheckpoint({
    checkpoint,
    reviews,
    handoffs,
    asOf: "2026-11-11T17:59:00.000Z",
  });
  assert.equal(pending.observedNewReviewEvents, null);
  assert.equal(pending.evidenceState, "AWAITING_EIGHT_HOUR_HORIZON");
  const result = evaluateForecastCheckpoint({
    checkpoint,
    reviews,
    handoffs,
    asOf: "2026-11-11T19:00:00.000Z",
  });
  assert.equal(result.observedNewReviewEvents, 2);
  assert.equal(result.absoluteError, 1);
  assert.equal(result.ownerAcceptance, "HOLD");
  assert.equal(result.independentFieldAcceptance, "HOLD");
  assert.equal(
    evaluateForecastCheckpoint({
      checkpoint,
      reviews,
      handoffs,
      asOf: "2026-11-11T19:00:00.000Z",
      truncated: true,
    }).evidenceState,
    "PARTIAL_HOLD",
  );
});

test("private owner summary uses aggregate decisions, not raw worker notes or identities", () => {
  const report = buildWitnessAuditSummary({
    witnesses: [
      {
        id,
        dispatchId: id,
        decision: "recheck_required",
        explanation: "PRIVATE_FIELD_PERSON_NOT_FOR_EXPORT",
        witnessedByUserId: another,
      },
      { id: another, dispatchId: id, decision: "observed_unverified" },
    ],
    checkpoints: [],
    reviews: [],
    handoffs: [],
    ownerAudits: [{ id, subjectKind: "field_witness" }],
    asOf: "2026-11-11T19:00:00.000Z",
  });
  assert.equal(report.witnessRechecks, 1);
  assert.equal(report.latestWitnessReviews, 0);
  assert.equal(report.ownerReviewEvents, 1);
  assert.equal(report.masterConnection, "HOLD");
  assert.doesNotMatch(
    JSON.stringify(report),
    /PRIVATE_FIELD_PERSON_NOT_FOR_EXPORT|witnessedByUserId/u,
  );
});

test("Build 245 SQL and protected pathways preserve source custody, RLS and owner gate", () => {
  const sql = read(
    "database/migrations/0229_build245_field_witness_forecast_owner_audit.sql",
  );
  const db = read("lib/booking-charges/fulfillment-witness-postgres.mjs");
  const actions = read(
    "app/workspaces/management/campgrounds/fulfillment-priority/actions.ts",
  );
  const ui = read(
    "app/workspaces/management/campgrounds/fulfillment-priority/page.tsx",
  );
  const api = read(
    "app/api/management/fulfillment-supervisor/shift-performance/route.ts",
  );
  const manifest = JSON.parse(
    read("public/.well-known/rosevear-integration-manifest.json"),
  );
  assert.match(sql, /force row level security/u);
  assert.match(sql, /icamp_private\.has_current_campground_owner_admin/u);
  assert.match(sql, /current_closure\.reported_by_user_id/u);
  assert.match(sql, /current_closure\.reviewed_by_user_id/u);
  assert.match(sql, /current_report is distinct from current_closure\.field_report_id/u);
  assert.match(sql, /forecast\.captured_at\+interval '8 hours'/u);
  assert.doesNotMatch(sql, /grant\s+(update|delete)/iu);
  assert.match(db, /set local role icamp_app/u);
  assert.match(db, /await appendAuditEvent/u);
  assert.match(actions, /recordOwnerShiftAuditAction/u);
  assert.match(actions, /saveForecastCheckpointAction/u);
  assert.match(ui, /Record independent witness statement/u);
  assert.match(ui, /Record owner forecast audit/u);
  assert.match(api, /roleCodes\.includes\("owner_admin"\)/u);
  assert.match(api, /fieldWitnessAudit/u);
  assert.equal(manifest.tenant_boundary, "platform_shell");
  assert.equal(manifest.signature.key_id, null);
  assert.equal(manifest.connection_state, "DISCONNECTED / HOLD");
});
