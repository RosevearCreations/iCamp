import pg from "pg";
import { getCampgroundAuthorization } from "../authz/postgres.mjs";
import { appendAuditEvent } from "../audit/postgres.mjs";
import { listAttestationCalibrationEvidence } from "./fulfillment-attestation-postgres.mjs";
import { buildOwnerAcceptanceEvidenceExport } from "./fulfillment-attestation-core.mjs";
import { listWitnessAuditEvidence } from "./fulfillment-witness-postgres.mjs";
import { evaluateForecastCheckpoint } from "./fulfillment-witness-core.mjs";
import { listShiftRecoveryEvidence } from "./fulfillment-shift-postgres.mjs";
import { listVerificationContinuityEvidence } from "./fulfillment-verification-postgres.mjs";
import {
  listOriginalDeviceWitnessAdmissions,
  readCrossMasterProtectedEvidence,
} from "./fulfillment-build249-postgres.mjs";
import { revalidateOwnerDossierSource } from "./fulfillment-build249-core.mjs";
import {
  evaluateBuild250OwnerGate,
  sha256,
  validateBuild250OwnerDecision,
  verifySourceHealthyCeremony,
} from "./fulfillment-build250-core.mjs";

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/iu;
const REV = /^[a-f0-9]{40}$/u;
let pool;
function database() {
  if (!pool) {
    if (!process.env.DATABASE_URL?.trim())
      throw new Error("Owner ceremony requires a private database connection.");
    pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      max: 4,
      connectionTimeoutMillis: 5000,
    });
  }
  return pool;
}
async function authorizeOwner(userId, campgroundId) {
  if (!UUID.test(String(campgroundId ?? "")))
    throw new Error("Current campground required.");
  const grant = await getCampgroundAuthorization(userId, campgroundId);
  if (
    !grant?.roleCodes.includes("owner_admin") ||
    !["staff.manage", "reservation.modify"].every((name) =>
      grant.permissions.includes(name),
    )
  )
    throw new Error("Current Owner / Administrator authority required.");
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
const safeProtectedObject = (name) => {
  const raw = process.env[name] ?? "";
  if (!raw || raw.length > 8192) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : null;
  } catch {
    return null;
  }
};
const currentRevision = () => {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA ?? "";
  return REV.test(sha) ? sha : null;
};
const iso = (time) =>
  time instanceof Date ? time.toISOString() : new Date(time).toISOString();

export async function assessOwnerSupervisedCeremony({ userId, campgroundId }) {
  await authorizeOwner(userId, campgroundId);
  const [source, witness, shift, continuity, originalWitness] =
    await Promise.all([
      listAttestationCalibrationEvidence({ userId, campgroundId }),
      listWitnessAuditEvidence({ userId, campgroundId }),
      listShiftRecoveryEvidence({ userId, campgroundId }),
      listVerificationContinuityEvidence({ userId, campgroundId, owner: true }),
      listOriginalDeviceWitnessAdmissions({ userId, campgroundId }),
    ]);
  const asOf = new Date().toISOString();
  const sourceRevision = currentRevision();
  const truncated =
    source.truncated ||
    witness.truncated ||
    shift.truncated ||
    continuity.truncated ||
    originalWitness.truncated;
  const evaluations = witness.checkpoints.map((checkpoint) =>
    evaluateForecastCheckpoint({
      checkpoint,
      reviews: shift.reviews,
      handoffs: shift.handoffs,
      asOf,
      truncated,
    }),
  );
  const evidence = buildOwnerAcceptanceEvidenceExport({
    campgroundId,
    sourceRevision,
    generatedAt: asOf,
    witnessEvents: witness.witnesses,
    originalDeviceReviews: source.originalDeviceReviews,
    checkpoints: witness.checkpoints,
    evaluations,
    calibrations: source.calibrations,
    ownerAudits: witness.ownerAudits,
    truncated,
  });
  const dossier = revalidateOwnerDossierSource({
    campgroundId,
    snapshots: continuity.dossierSnapshots,
    windowTruncated: continuity.dossierWindowTruncated,
    currentRevision: sourceRevision,
    currentEvidence: evidence,
  });
  const masters = readCrossMasterProtectedEvidence({
    sourceRevision,
    asOf,
  });
  const sourceReceipt = safeProtectedObject("ICAMP_SOURCE_HEALTH_RECEIPT_JSON");
  const latest = continuity.dossierSnapshots[0];
  const sourceHealthy = verifySourceHealthyCeremony({
    campgroundId,
    sourceRevision,
    dossierDigestSha256: latest?.digestSha256,
    receipt: sourceReceipt,
    trust: safeProtectedObject("ICAMP_SOURCE_HEALTH_PIN_JSON"),
    custodianEnrolled:
      process.env.ICAMP_SOURCE_HEALTH_CUSTODIAN_ENROLLED === "true",
    asOf,
  });
  const gate = evaluateBuild250OwnerGate({
    campgroundId,
    sourceRevision,
    dossierIntegrity: dossier,
    dossierSnapshots: continuity.dossierSnapshots,
    signedSourceHealthy: sourceHealthy,
    crossMasterEvidence: masters,
    originalDeviceWitnesses: originalWitness.witnesses,
    verifiedSourcePackets: continuity.verifiedSourcePackets,
    asOf,
  });
  return {
    sourceRevision,
    dossier,
    sourceHealthy,
    masters,
    gate,
    // Evidence hashes only: do not expose original signatures or the enrolled pins.
    masterEvidenceDigestSha256: masters.allIndependentlySigned
      ? sha256(process.env.ICAMP_MASTER_ACCEPTANCE_READBACK_JSON ?? "")
      : null,
    sourceReceiptDigestSha256: sourceHealthy.receiptDigestSha256 ?? null,
  };
}

export async function listOwnerSupervisedDecisions({ userId, campgroundId }) {
  const grant = await authorizeOwner(userId, campgroundId);
  return scoped(userId, null, async (client) => {
    const result = await client.query(
      [
        "select id,source_revision,dossier_snapshot_id,decision,recorded_at",
        "from public.service_fulfillment_owner_ceremony_reviews",
        "where organization_id=$1 and campground_id=$2",
        "order by recorded_at desc,id desc limit 101",
      ].join(" "),
      [grant.organizationId, campgroundId],
    );
    return {
      decisions: result.rows.slice(0, 100).map((row) => ({
        id: row.id,
        sourceRevision: row.source_revision,
        dossierSnapshotId: row.dossier_snapshot_id,
        decision: row.decision,
        recordedAt: iso(row.recorded_at),
      })),
      truncated: result.rows.length > 100,
      ownerProductionAcceptance: "HOLD",
      masterConnected: false,
    };
  });
}

export async function recordOwnerSupervisedDecision({
  actorUserId,
  actorSessionId = null,
  campgroundId,
  decision,
  explanation,
}) {
  const grant = await authorizeOwner(actorUserId, campgroundId);
  const revision = currentRevision();
  if (!revision) throw new Error("Exact deployment SHA required.");
  const proof = await assessOwnerSupervisedCeremony({
    userId: actorUserId,
    campgroundId,
  });
  const parsed = validateBuild250OwnerDecision({
    decision,
    explanation,
    eligible: proof.gate.supervisedReviewEligible,
  });
  return scoped(actorUserId, revision, async (client) => {
    const request = parsed.decision === "request_supervised_review";
    const details = request
      ? [
          proof.gate.dossierSnapshotId,
          proof.gate.verifiedPacketId,
          proof.gate.witnessId,
          proof.sourceHealthy.sourceNonceDigestSha256,
          proof.masterEvidenceDigestSha256,
          proof.gate.dossierDigestSha256,
        ]
      : [null, null, null, null, null, null];
    const saved = await client.query(
      [
        "insert into public.service_fulfillment_owner_ceremony_reviews",
        "(organization_id,campground_id,source_revision,dossier_snapshot_id,",
        "signature_verification_id,original_witness_id,",
        "source_health_nonce_digest_sha256,three_master_evidence_digest_sha256,",
        "dossier_digest_sha256,decision,explanation,reviewed_by_user_id)",
        "values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning id",
      ].join(" "),
      [
        grant.organizationId,
        campgroundId,
        revision,
        ...details,
        parsed.decision,
        parsed.explanation,
        actorUserId,
      ],
    );
    await client.query("reset role");
    await appendAuditEvent(client, {
      actorUserId,
      actorSessionId,
      organizationId: grant.organizationId,
      campgroundId,
      actionKey: "campground.fulfillment.owner_supervised_ceremony_decision",
      permissionKey: "staff.manage",
      subjectType: "service_fulfillment_owner_ceremony_reviews",
      subjectId: saved.rows[0].id,
      afterState: {
        sourceRevision: revision,
        decision: parsed.decision,
        reviewerEvidenceEligible: request,
        sourceHealthy: proof.sourceHealthy.status,
        threeMasterEvidence: proof.masters.decision,
        ownerProductionAcceptance: "HOLD",
        masterConnected: false,
      },
    });
    return {
      id: saved.rows[0].id,
      decision: parsed.decision,
      ownerProductionAcceptance: "HOLD",
      masterConnected: false,
    };
  });
}
