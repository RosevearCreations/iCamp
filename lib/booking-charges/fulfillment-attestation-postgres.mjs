import pg from "pg";
import { appendAuditEvent } from "../audit/postgres.mjs";
import { getCampgroundAuthorization } from "../authz/postgres.mjs";
import {
  validateOriginalDeviceReview,
  validateCalibrationFollowup,
} from "./fulfillment-attestation-core.mjs";
import { evaluateForecastCheckpoint } from "./fulfillment-witness-core.mjs";

let pool;
const getPool = () => {
  if (!pool) {
    if (!process.env.DATABASE_URL?.trim())
      throw new Error("DATABASE_URL required for private attestation source.");
    pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      max: 4,
      connectionTimeoutMillis: 5000,
    });
  }
  return pool;
};
async function authorize(userId, campgroundId, owner = false) {
  const grant = await getCampgroundAuthorization(userId, campgroundId);
  if (
    !grant ||
    !["staff.manage", "reservation.modify"].every((p) =>
      grant.permissions.includes(p),
    ) ||
    (owner && !grant.roleCodes.includes("owner_admin"))
  )
    throw new Error(
      owner
        ? "Campground Owner / Administrator required."
        : "Authorized campground supervisor required.",
    );
  return grant;
}
async function scoped(userId, work) {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    await client.query("set local role icamp_app");
    await client.query("select set_config('icamp.user_id',$1,true)", [userId]);
    const result = await work(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
const iso = (value) =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();

export async function listAttestationCalibrationEvidence({
  userId,
  campgroundId,
}) {
  await authorize(userId, campgroundId);
  return scoped(userId, async (client) => {
    const [device, calibration] = await Promise.all([
      client.query(
        `select id,dispatch_id,field_report_id,witness_id,previous_review_id,
                evidence_reference,digest_sha256,decision,reviewed_by_user_id,reviewed_at
         from public.service_fulfillment_original_device_review_events
         where campground_id=$1 order by reviewed_at desc,id desc limit 1001`,
        [campgroundId],
      ),
      client.query(
        `select id,checkpoint_id,previous_event_id,expected_new_review_events,
                observed_new_review_events,absolute_error,decision,recorded_at
         from public.service_fulfillment_calibration_followup_events
         where campground_id=$1 order by recorded_at desc,id desc limit 1001`,
        [campgroundId],
      ),
    ]);
    return {
      originalDeviceReviews: device.rows.slice(0, 1000).map((row) => ({
        id: row.id,
        dispatchId: row.dispatch_id,
        fieldReportId: row.field_report_id,
        witnessId: row.witness_id,
        previousReviewId: row.previous_review_id,
        evidenceReference: row.evidence_reference,
        digestSha256: row.digest_sha256,
        decision: row.decision,
        reviewedByUserId: row.reviewed_by_user_id,
        reviewedAt: iso(row.reviewed_at),
      })),
      calibrations: calibration.rows.slice(0, 1000).map((row) => ({
        id: row.id,
        checkpointId: row.checkpoint_id,
        previousEventId: row.previous_event_id,
        expectedNewReviewEvents: row.expected_new_review_events,
        observedNewReviewEvents: row.observed_new_review_events,
        absoluteError: row.absolute_error,
        decision: row.decision,
        recordedAt: iso(row.recorded_at),
      })),
      truncated: device.rows.length > 1000 || calibration.rows.length > 1000,
    };
  });
}

export async function recordOriginalDeviceReview({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  ...input
}) {
  const grant = await authorize(actorUserId, campgroundId);
  const review = validateOriginalDeviceReview(input);
  return scoped(actorUserId, async (client) => {
    const saved = await client.query(
      `insert into public.service_fulfillment_original_device_review_events
       (organization_id,campground_id,dispatch_id,field_report_id,witness_id,
        previous_review_id,evidence_reference,digest_sha256,decision,
        explanation,reviewed_by_user_id)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning id`,
      [
        grant.organizationId,
        campgroundId,
        review.dispatchId,
        review.fieldReportId,
        review.witnessId,
        review.previousReviewId,
        review.evidenceReference,
        review.digestSha256,
        review.decision,
        review.explanation,
        actorUserId,
      ],
    );
    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: grant.organizationId,
      campgroundId,
      actionKey: "campground.fulfillment.original_device_review",
      permissionKey: "staff.manage",
      subjectType: "service_fulfillment_original_device_review_events",
      subjectId: saved.rows[0].id,
      afterState: {
        dispatchId: review.dispatchId,
        fieldReportId: review.fieldReportId,
        witnessId: review.witnessId,
        digestSha256: review.digestSha256,
        decision: review.decision,
        cryptographicAttestation: "HOLD",
      },
    });
    return { id: saved.rows[0].id };
  });
}

/** Recompute from authenticated source events; never accept observed counts from a form. */
export async function recordCalibrationFollowup({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  checkpoints,
  reviews,
  handoffs,
  truncated,
  asOf,
  ...input
}) {
  const grant = await authorize(actorUserId, campgroundId);
  const record = validateCalibrationFollowup(input);
  if (truncated)
    throw new Error("Partial source cannot certify calibration counts.");
  const checkpoint = checkpoints.find(
    (item) => item.id === record.checkpointId,
  );
  if (!checkpoint) throw new Error("Current campground checkpoint required.");
  const accuracy = evaluateForecastCheckpoint({
    checkpoint,
    reviews,
    handoffs,
    asOf,
    truncated,
  });
  if (
    accuracy.evidenceState !== "OBSERVED_SOURCE_ONLY" ||
    accuracy.observedNewReviewEvents === null ||
    accuracy.absoluteError === null
  )
    throw new Error("Await a complete eight-hour source horizon.");
  return scoped(actorUserId, async (client) => {
    const saved = await client.query(
      `insert into public.service_fulfillment_calibration_followup_events
       (organization_id,campground_id,checkpoint_id,previous_event_id,
        expected_new_review_events,observed_new_review_events,absolute_error,
        decision,explanation,recorded_by_user_id)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning id`,
      [
        grant.organizationId,
        campgroundId,
        record.checkpointId,
        record.previousEventId,
        accuracy.expectedNewReviewEvents,
        accuracy.observedNewReviewEvents,
        accuracy.absoluteError,
        record.decision,
        record.explanation,
        actorUserId,
      ],
    );
    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: grant.organizationId,
      campgroundId,
      actionKey: "campground.fulfillment.calibration_followup",
      permissionKey: "staff.manage",
      subjectType: "service_fulfillment_calibration_followup_events",
      subjectId: saved.rows[0].id,
      afterState: {
        checkpointId: record.checkpointId,
        expected: accuracy.expectedNewReviewEvents,
        observed: accuracy.observedNewReviewEvents,
        absoluteError: accuracy.absoluteError,
        decision: record.decision,
        independentAcceptance: "HOLD",
      },
    });
    return { id: saved.rows[0].id };
  });
}
