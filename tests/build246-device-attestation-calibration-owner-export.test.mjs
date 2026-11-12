import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  validateOriginalDeviceReview,
  validateCalibrationFollowup,
  classifyCalibrationException,
  buildOwnerAcceptanceEvidenceExport,
} from "../lib/booking-charges/fulfillment-attestation-core.mjs";
const id = "11111111-2222-4333-8444-555555555555";
const other = "11111111-2222-4333-8444-666666666666";
const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("original device intake requires source IDs, non-secret reference and SHA-256, never verification", () => {
  const valid = {
    dispatchId: id,
    fieldReportId: other,
    witnessId: id,
    decision: "inspected_unverified",
    evidenceReference: "FIELD-ORIGINAL-001",
    digestSha256: "a".repeat(64),
    explanation: "Original device evidence reviewed against source record.",
  };
  assert.equal(validateOriginalDeviceReview(valid).previousReviewId, null);
  assert.equal(validateOriginalDeviceReview({...valid,previousReviewId:other}).previousReviewId,other);
  for (const invalid of [
    {dispatchId:"not-uuid"},
    {fieldReportId:"not-uuid"},
    {witnessId:"not-uuid"},
    {previousReviewId:"stale"},
    {decision:"cryptographically_verified"},
    {evidenceReference:"https://host.test/?token=secret"},
    {digestSha256:"1234"},
    {digestSha256:"B".repeat(64)},
    {explanation:"short"},
  ]) assert.throws(() => validateOriginalDeviceReview({...valid,...invalid}));
});

test("calibration followups reject direct success or falsified historical subjects", () => {
  const valid = {checkpointId:id,decision:"investigate",explanation:"Review unexpected forecast variance."};
  assert.equal(validateCalibrationFollowup(valid).previousEventId,null);
  for (const invalid of [
    {checkpointId:"bad"},
    {previousEventId:"stale"},
    {decision:"owner_accept"},
    {explanation:"short"},
  ]) assert.throws(()=>validateCalibrationFollowup({...valid,...invalid}));
});

test("forecast classification is deterministic and partial/horizon pending remain HOLD", () => {
  assert.equal(classifyCalibrationException({
    evidenceState:"AWAITING_EIGHT_HOUR_HORIZON", expectedNewReviewEvents:2, absoluteError:null,
  }).status,"PENDING_WINDOW");
  assert.equal(classifyCalibrationException({
    evidenceState:"PARTIAL_HOLD", expectedNewReviewEvents:2, absoluteError:99,
  }).status,"PARTIAL_HOLD");
  assert.equal(classifyCalibrationException({
    evidenceState:"OBSERVED_SOURCE_ONLY", expectedNewReviewEvents:2, absoluteError:1,
  }).status,"WITHIN_REVIEW_BAND");
  assert.equal(classifyCalibrationException({
    evidenceState:"OBSERVED_SOURCE_ONLY", expectedNewReviewEvents:2, absoluteError:2,
  }).status,"INVESTIGATE_VARIANCE");
  assert.equal(classifyCalibrationException(null).status,"PARTIAL_HOLD");
});

test("owner source export removes worker/guest identifiers and notes, retains HOLD and deviations", () => {
  const dossier = buildOwnerAcceptanceEvidenceExport({
    campgroundId:id,sourceRevision:"1".repeat(40),generatedAt:"2026-11-12T12:00:00Z",
    witnessEvents:[{id:other,explanation:"PRIVATE-HUMAN-NOTE"}],
    originalDeviceReviews:[{
      id,dispatchId:id,fieldReportId:other,witnessId:id,
      previousReviewId:null,evidenceReference:"FIELD-REF-1234",
      digestSha256:"b".repeat(64),decision:"inspected_unverified",
      reviewedByUserId:"PRIVATE-ACTOR",reviewedAt:"2026-11-12T10:00:00Z",
      explanation:"PRIVATE-DEVICE-NOTE",
    }],
    checkpoints:[{id,capturedAt:"2026-11-11T10:00:00Z",expectedNewReviewEvents:1}],
    evaluations:[{checkpointId:id,expectedNewReviewEvents:1,
      observedNewReviewEvents:4,absoluteError:3,evidenceState:"OBSERVED_SOURCE_ONLY"}],
    calibrations:[{id:other,checkpointId:id,decision:"investigate",
      explanation:"PRIVATE-CALIBRATION-NOTE"}],
    ownerAudits:[{id,subjectKind:"forecast_checkpoint",subjectId:id,decision:"recheck_required",
      reviewedAt:"2026-11-12T10:00:00Z",explanation:"PRIVATE-OWNER-NOTE"}],
    truncated:true,
  });
  assert.equal(dossier.completeness,"PARTIAL_HOLD");
  assert.equal(dossier.originalDeviceSignatureVerified,false);
  assert.equal(dossier.ownerProductionAcceptance,"HOLD");
  assert.equal(dossier.masterConnection,"HOLD");
  assert.equal(dossier.forecastCalibration[0].variance.status,"INVESTIGATE_VARIANCE");
  const raw=JSON.stringify(dossier);
  assert.doesNotMatch(raw,/PRIVATE-|reviewedByUserId|explanation|guestName|email/u);
});

test("Build 246 SQL guards are immutable, actor-diverse, original-linked and source-counted", () => {
  const sql=read("database/migrations/0230_build246_device_review_calibration.sql");
  const verify=read("database/verify/0230_build246_device_review_calibration.sql");
  const db=read("lib/booking-charges/fulfillment-attestation-postgres.mjs");
  const api=read("app/api/management/fulfillment-supervisor/acceptance-evidence/route.ts");
  const actions=read("app/workspaces/management/campgrounds/fulfillment-priority/actions.ts");
  const view=read("app/workspaces/management/campgrounds/fulfillment-priority/page.tsx");
  const manifest=JSON.parse(read("public/.well-known/rosevear-integration-manifest.json"));
  assert.match(sql,/force row level security/u);
  assert.match(sql,/report\.id is distinct from new\.field_report_id/u);
  assert.match(sql,/witness\.id is distinct from new\.witness_id/u);
  assert.match(sql,/report\.reported_by_user_id,witness\.witnessed_by_user_id/u);
  assert.match(sql,/checkpoint\.captured_at\+interval '8 hours'/u);
  assert.match(sql,/observed_new_review_events<>observed/u);
  assert.match(sql,/abs\(observed-checkpoint\.expected_new_review_events\)/u);
  assert.doesNotMatch(sql,/grant\s+(update|delete)/iu);
  assert.match(verify,/Build 246 evidence must be append-only/u);
  assert.match(db,/set local role icamp_app/u);
  assert.match(db,/appendAuditEvent/u);
  assert.match(actions,/recordCalibrationFollowupAction/u);
  assert.match(actions,/recordOriginalDeviceReviewAction/u);
  assert.match(view,/Record original-device source review/u);
  assert.match(view,/Record calibration follow-up/u);
  assert.match(api,/roleCodes\.includes\("owner_admin"\)/u);
  assert.match(api,/private, no-store/u);
  assert.match(api,/UNSIGNED_PRIVATE_OWNER_SOURCE/u);
  assert.equal(manifest.tenant_boundary,"platform_shell");
  assert.equal(manifest.signature.key_id,null);
  assert.equal(manifest.connection_state,"DISCONNECTED / HOLD");
});
