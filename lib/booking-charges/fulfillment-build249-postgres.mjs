import pg from "pg";
import { appendAuditEvent } from "../audit/postgres.mjs";
import { getCampgroundAuthorization } from "../authz/postgres.mjs";
import {
  validateOriginalDeviceWitness,
  reconcileCrossMasterAcceptance,
} from "./fulfillment-build249-core.mjs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const REV = /^[a-f0-9]{40}$/u;
let pool;
function database() {
  if (!pool) {
    if (!process.env.DATABASE_URL?.trim())
      throw new Error(
        "DATABASE_URL required for private original witness custody.",
      );
    pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      max: 4,
      connectionTimeoutMillis: 5000,
    });
  }
  return pool;
}
async function authorize(userId, campgroundId) {
  if (!UUID.test(String(campgroundId ?? "")))
    throw new Error("Current campground ID required.");
  const grant = await getCampgroundAuthorization(userId, campgroundId);
  if (
    !grant ||
    !["staff.manage", "reservation.modify"].every((p) =>
      grant.permissions.includes(p),
    )
  )
    throw new Error("Current campground supervisor required.");
  return grant;
}
async function scoped(userId, sourceRevision, work) {
  const client = await database().connect();
  try {
    await client.query("begin");
    await client.query("set local role icamp_app");
    await client.query("select set_config('icamp.user_id',$1,true)", [userId]);
    if (sourceRevision)
      await client.query("select set_config('icamp.source_revision',$1,true)", [
        sourceRevision,
      ]);
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
const productionRevision = () => {
  const revision = process.env.VERCEL_GIT_COMMIT_SHA ?? "";
  if (!REV.test(revision))
    throw new Error("Exact deployed source SHA required.");
  return revision;
};
const iso = (d) =>
  d instanceof Date ? d.toISOString() : new Date(d).toISOString();

export async function listOriginalDeviceWitnessAdmissions({
  userId,
  campgroundId,
}) {
  const grant = await authorize(userId, campgroundId);
  return scoped(userId, null, async (client) => {
    const rows = await client.query(
      [
        "select id,dispatch_id,signature_verification_id,original_review_id,",
        "source_revision,decision,admitted_at",
        "from public.service_fulfillment_original_device_witness_admissions",
        "where campground_id=$1 and organization_id=$2",
        "order by admitted_at desc,id desc limit 1001",
      ].join(" "),
      [campgroundId, grant.organizationId],
    );
    return {
      witnesses: rows.rows.slice(0, 1000).map((row) => ({
        id: row.id,
        dispatchId: row.dispatch_id,
        signatureVerificationId: row.signature_verification_id,
        originalReviewId: row.original_review_id,
        sourceRevision: row.source_revision,
        decision: row.decision,
        admittedAt: iso(row.admitted_at),
      })),
      truncated: rows.rows.length > 1000,
      originalDeviceIndependentAcceptance: "HOLD",
      ownerAcceptance: "HOLD",
      masterConnected: false,
    };
  });
}

export async function admitOriginalDeviceWitness({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  verificationId,
  decision,
  explanation,
}) {
  const grant = await authorize(actorUserId, campgroundId);
  const revision = productionRevision();
  const witness = validateOriginalDeviceWitness({
    verificationId,
    decision,
    explanation,
  });
  return scoped(actorUserId, revision, async (client) => {
    const verified = await client.query(
      [
        "select id,organization_id,campground_id,dispatch_id,original_review_id,",
        "source_revision,verified_by_user_id",
        "from public.service_fulfillment_device_signature_verifications",
        "where id=$1 and campground_id=$2 and organization_id=$3",
      ].join(" "),
      [witness.verificationId, campgroundId, grant.organizationId],
    );
    if (verified.rowCount !== 1)
      throw new Error("Source-bound original device verification missing.");
    const source = verified.rows[0];
    if (
      source.source_revision !== revision ||
      source.verified_by_user_id === actorUserId
    )
      throw new Error("Fresh separate original-device witness required.");
    const inserted = await client.query(
      [
        "insert into public.service_fulfillment_original_device_witness_admissions",
        "(organization_id,campground_id,dispatch_id,signature_verification_id,",
        "original_review_id,source_revision,decision,explanation,admitted_by_user_id)",
        "values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id",
      ].join(" "),
      [
        grant.organizationId,
        campgroundId,
        source.dispatch_id,
        source.id,
        source.original_review_id,
        revision,
        witness.decision,
        witness.explanation,
        actorUserId,
      ],
    );
    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: grant.organizationId,
      campgroundId,
      actionKey:
        "campground.fulfillment.original_device_witness_source_admitted",
      permissionKey: "staff.manage",
      subjectType: "service_fulfillment_original_device_witness_admissions",
      subjectId: inserted.rows[0].id,
      afterState: {
        sourceRevision: revision,
        signatureVerificationId: source.id,
        decision: witness.decision,
        originalDeviceAcceptance: "HOLD",
        masterConnected: false,
        ownerAcceptance: "HOLD",
      },
    });
    return {
      id: inserted.rows[0].id,
      decision: witness.decision,
      originalDeviceAcceptance: "HOLD",
    };
  });
}

/** All receipt/pin inputs are protected server configuration, never a
 * browser-supplied key. Missing/malformed configs remain HOLD. */
function protectedArray(name) {
  const value = process.env[name] ?? "";
  if (!value || value.length > 131072) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) && parsed.length <= 8 ? parsed : [];
  } catch {
    return [];
  }
}
export function readCrossMasterProtectedEvidence({ sourceRevision, asOf }) {
  return reconcileCrossMasterAcceptance({
    sourceRevision,
    receipts: protectedArray("ICAMP_MASTER_ACCEPTANCE_READBACK_JSON"),
    pins: protectedArray("ICAMP_MASTER_RECEIPT_PINS_JSON"),
    custodianEnrolled:
      process.env.ICAMP_MASTER_RECEIPT_CUSTODIAN_ENROLLED === "true",
    asOf,
  });
}
