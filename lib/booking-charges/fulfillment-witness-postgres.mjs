import pg from "pg";

import { appendAuditEvent } from "../audit/postgres.mjs";
import { getCampgroundAuthorization } from "../authz/postgres.mjs";
import {
  validateIndependentFieldWitness,
  validateOwnerShiftAudit,
} from "./fulfillment-witness-core.mjs";

let pool;
function database() {
  if (!pool) {
    if (!process.env.DATABASE_URL?.trim())
      throw new Error("DATABASE_URL required for private field witness.");
    pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      max: 4,
      connectionTimeoutMillis: 5000,
    });
  }
  return pool;
}

async function authorize(userId, campgroundId, owner = false) {
  const grant = await getCampgroundAuthorization(userId, campgroundId);
  if (
    !grant ||
    !["staff.manage", "reservation.modify"].every((value) =>
      grant.permissions.includes(value),
    ) ||
    (owner && !grant.roleCodes.includes("owner_admin"))
  )
    throw new Error(
      owner
        ? "Active campground Owner / Administrator required."
        : "Current campground supervisor required.",
    );
  return grant;
}

async function scoped(userId, work) {
  const client = await database().connect();
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

export async function listWitnessAuditEvidence({ userId, campgroundId }) {
  await authorize(userId, campgroundId);
  return scoped(userId, async (client) => {
    const [witness, forecast, owner] = await Promise.all([
      client.query(
        `select id,dispatch_id,closure_id,previous_witness_id,decision,
                evidence_reference,explanation,witnessed_by_user_id,witnessed_at
         from public.service_fulfillment_field_witness_events
         where campground_id=$1 order by witnessed_at desc,id desc limit 1001`,
        [campgroundId],
      ),
      client.query(
        `select id,expected_new_review_events,planning_load,evidence_coverage,
                captured_by_user_id,captured_at
         from public.service_fulfillment_forecast_checkpoints
         where campground_id=$1 order by captured_at desc,id desc limit 101`,
        [campgroundId],
      ),
      client.query(
        `select id,subject_kind,subject_id,decision,reviewed_at
         from public.service_fulfillment_owner_shift_audit_events
         where campground_id=$1 order by reviewed_at desc,id desc limit 1001`,
        [campgroundId],
      ),
    ]);
    return {
      witnesses: witness.rows.slice(0, 1000).map((row) => ({
        id: row.id,
        dispatchId: row.dispatch_id,
        closureId: row.closure_id,
        previousWitnessId: row.previous_witness_id,
        decision: row.decision,
        evidenceReference: row.evidence_reference,
        explanation: row.explanation,
        witnessedByUserId: row.witnessed_by_user_id,
        witnessedAt: iso(row.witnessed_at),
      })),
      checkpoints: forecast.rows.slice(0, 100).map((row) => ({
        id: row.id,
        expectedNewReviewEvents: row.expected_new_review_events,
        planningLoad: row.planning_load,
        evidenceCoverage: row.evidence_coverage,
        capturedAt: iso(row.captured_at),
      })),
      ownerAudits: owner.rows.slice(0, 1000).map((row) => ({
        id: row.id,
        subjectKind: row.subject_kind,
        subjectId: row.subject_id,
        decision: row.decision,
        reviewedAt: iso(row.reviewed_at),
      })),
      truncated:
        witness.rows.length > 1000 ||
        forecast.rows.length > 100 ||
        owner.rows.length > 1000,
    };
  });
}

export async function recordIndependentFieldWitness({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  ...input
}) {
  await authorize(actorUserId, campgroundId);
  const evidence = validateIndependentFieldWitness(input);
  return scoped(actorUserId, async (client) => {
    const dispatch = await client.query(
      `select organization_id from public.service_fulfillment_dispatches
       where campground_id=$1 and id=$2`,
      [campgroundId, evidence.dispatchId],
    );
    if (dispatch.rowCount !== 1)
      throw new Error("Current campground source dispatch required.");
    const organizationId = dispatch.rows[0].organization_id;
    const saved = await client.query(
      `insert into public.service_fulfillment_field_witness_events
       (organization_id,campground_id,dispatch_id,closure_id,previous_witness_id,
        decision,evidence_reference,explanation,witnessed_by_user_id)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id`,
      [
        organizationId,
        campgroundId,
        evidence.dispatchId,
        evidence.closureId,
        evidence.previousWitnessId,
        evidence.decision,
        evidence.evidenceReference,
        evidence.explanation,
        actorUserId,
      ],
    );
    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId,
      campgroundId,
      actionKey: "campground.fulfillment.independent_field_witness",
      permissionKey: "staff.manage",
      subjectType: "service_fulfillment_field_witness_events",
      subjectId: saved.rows[0].id,
      afterState: {
        dispatchId: evidence.dispatchId,
        closureId: evidence.closureId,
        decision: evidence.decision,
        independentDeviceAcceptance: "HOLD",
      },
    });
    return { id: saved.rows[0].id };
  });
}

export async function recordForecastCheckpoint({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  forecast,
}) {
  const grant = await authorize(actorUserId, campgroundId);
  if (
    !forecast ||
    !Number.isInteger(forecast.expectedNewReviewEvents) ||
    forecast.expectedNewReviewEvents < 0 ||
    !Number.isInteger(forecast.planningLoad) ||
    forecast.planningLoad < 0 ||
    !["PARTIAL_HOLD", "SOURCE_SNAPSHOT_ONLY"].includes(forecast.evidenceCoverage)
  )
    throw new Error("A current source-derived forecast is required.");
  return scoped(actorUserId, async (client) => {
    const saved = await client.query(
      `insert into public.service_fulfillment_forecast_checkpoints
       (organization_id,campground_id,expected_new_review_events,
        planning_load,evidence_coverage,captured_by_user_id)
       values ($1,$2,$3,$4,$5,$6) returning id`,
      [
        grant.organizationId,
        campgroundId,
        forecast.expectedNewReviewEvents,
        forecast.planningLoad,
        forecast.evidenceCoverage,
        actorUserId,
      ],
    );
    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: grant.organizationId,
      campgroundId,
      actionKey: "campground.fulfillment.forecast_checkpoint",
      permissionKey: "staff.manage",
      subjectType: "service_fulfillment_forecast_checkpoints",
      subjectId: saved.rows[0].id,
      afterState: {
        forecastHorizonHours: 8,
        expectedNewReviewEvents: forecast.expectedNewReviewEvents,
        evidenceCoverage: forecast.evidenceCoverage,
        ownerAcceptance: "HOLD",
      },
    });
    return { id: saved.rows[0].id };
  });
}

export async function recordOwnerShiftAudit({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  ...input
}) {
  const grant = await authorize(actorUserId, campgroundId, true);
  const audit = validateOwnerShiftAudit(input);
  return scoped(actorUserId, async (client) => {
    const saved = await client.query(
      `insert into public.service_fulfillment_owner_shift_audit_events
       (organization_id,campground_id,subject_kind,subject_id,decision,
        explanation,reviewed_by_user_id)
       values ($1,$2,$3,$4,$5,$6,$7) returning id`,
      [
        grant.organizationId,
        campgroundId,
        audit.subjectKind,
        audit.subjectId,
        audit.decision,
        audit.explanation,
        actorUserId,
      ],
    );
    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: grant.organizationId,
      campgroundId,
      actionKey: "campground.fulfillment.owner_shift_audit",
      permissionKey: "staff.manage",
      subjectType: "service_fulfillment_owner_shift_audit_events",
      subjectId: saved.rows[0].id,
      afterState: {
        subjectKind: audit.subjectKind,
        subjectId: audit.subjectId,
        decision: audit.decision,
        masterConnection: "HOLD",
        independentDeviceAcceptance: "HOLD",
      },
    });
    return { id: saved.rows[0].id };
  });
}
