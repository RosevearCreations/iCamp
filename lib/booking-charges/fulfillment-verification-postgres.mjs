import pg from "pg";
import { appendAuditEvent } from "../audit/postgres.mjs";
import { getCampgroundAuthorization } from "../authz/postgres.mjs";
import {
  verifyOriginalDevicePacket,
  validateCalibrationClosure,
  buildDossierContinuity,
} from "./fulfillment-verification-core.mjs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const REV = /^[a-f0-9]{40}$/u;
let pool;
function database() {
  if (!pool) {
    if (!process.env.DATABASE_URL?.trim())
      throw new Error("DATABASE_URL required for private verification ledger.");
    pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      max: 4,
      connectionTimeoutMillis: 5000,
    });
  }
  return pool;
}
async function authorize(userId,campgroundId,owner=false) {
  if (!UUID.test(String(campgroundId))) throw new Error("Campground source scope required.");
  const grant = await getCampgroundAuthorization(userId,campgroundId);
  if (!grant ||
      !["staff.manage","reservation.modify"].every((p)=>grant.permissions.includes(p)) ||
      (owner && !grant.roleCodes.includes("owner_admin")))
    throw new Error(owner ? "Active campground Owner / Administrator required." :
      "Current campground supervisor required.");
  return grant;
}
async function scoped(userId,work,revision=null) {
  const client=await database().connect();
  try {
    await client.query("begin");
    await client.query("set local role icamp_app");
    await client.query("select set_config('icamp.user_id',$1,true)",[userId]);
    if (revision)
      await client.query("select set_config('icamp.source_revision',$1,true)",[revision]);
    const result=await work(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(()=>undefined);
    throw error;
  } finally { client.release(); }
}
const deployedRevision=()=>{
  const sha=process.env.VERCEL_GIT_COMMIT_SHA ?? "";
  if(!REV.test(sha)) throw new Error("Exact deployed Git source revision unavailable.");
  return sha;
};
const iso=(d)=>d instanceof Date?d.toISOString():new Date(d).toISOString();

export function devicePinStatus() {
  const enrolled=process.env.ICAMP_DEVICE_VERIFIER_CUSTODIAN_ENROLLED==="true";
  const complete=Boolean(
    process.env.ICAMP_DEVICE_VERIFIER_KEY_ID &&
    process.env.ICAMP_DEVICE_VERIFIER_SPKI_BASE64 &&
    process.env.ICAMP_DEVICE_VERIFIER_PIN_SHA256
  );
  return enrolled && complete
    ? "PIN_CONFIGURED_REQUIRES_INDEPENDENT_SOURCE_WITNESS"
    : "HOLD_INDEPENDENT_DEVICE_PIN_NOT_ENROLLED";
}
function trustedPin() {
  if(devicePinStatus()==="HOLD_INDEPENDENT_DEVICE_PIN_NOT_ENROLLED")
    return null;
  return {
    keyId:process.env.ICAMP_DEVICE_VERIFIER_KEY_ID,
    publicKeySpkiBase64:process.env.ICAMP_DEVICE_VERIFIER_SPKI_BASE64,
    independentlyAuthenticatedSpkiFingerprint:
      process.env.ICAMP_DEVICE_VERIFIER_PIN_SHA256,
  };
}

export async function listVerificationContinuityEvidence({
  userId,campgroundId,owner=false
}) {
  await authorize(userId,campgroundId,owner);
  return scoped(userId,async(client)=>{
    const verified=await client.query(
      `select id,dispatch_id,original_review_id,signer_key_id,
              signer_pin_sha256,source_revision,decision,verified_at
       from public.service_fulfillment_device_signature_verifications
       where campground_id=$1 order by verified_at desc,id desc limit 1001`,
      [campgroundId],
    );
    let closures=[],snapshots=[],truncated=verified.rows.length>1000;
    if(owner){
      const [c,s]=await Promise.all([
        client.query(
          `select id,checkpoint_id,latest_followup_id,previous_closure_id,
                  decision,reviewed_at
           from public.service_fulfillment_calibration_closure_events
           where campground_id=$1 order by reviewed_at desc,id desc limit 1001`,
          [campgroundId],
        ),
        client.query(
          `select id,previous_snapshot_id,source_revision,dossier_digest_sha256,
                  previous_digest_sha256,evidence_schema,completeness,
                  witness_count,device_review_count,forecast_count,audited_count,
                  recorded_at
           from public.service_fulfillment_owner_dossier_snapshots
           where campground_id=$1 order by recorded_at desc,id desc limit 101`,
          [campgroundId],
        ),
      ]);
      closures=c.rows.slice(0,1000).map(row=>({
        id:row.id,checkpointId:row.checkpoint_id,
        latestFollowupId:row.latest_followup_id,
        previousClosureId:row.previous_closure_id,decision:row.decision,
        reviewedAt:iso(row.reviewed_at),
      }));
      snapshots=s.rows.slice(0,100).map(row=>({
        id:row.id,previousSnapshotId:row.previous_snapshot_id,
        sourceRevision:row.source_revision,digestSha256:row.dossier_digest_sha256,
        previousDigestSha256:row.previous_digest_sha256,evidenceSchema:row.evidence_schema,
        completeness:row.completeness,witnessCount:row.witness_count,
        deviceReviewCount:row.device_review_count,forecastCount:row.forecast_count,
        auditedCount:row.audited_count,recordedAt:iso(row.recorded_at),
      }));
      truncated=truncated||c.rows.length>1000||s.rows.length>100;
    }
    return {
      verifiedSourcePackets:verified.rows.slice(0,1000).map(row=>({
        id:row.id,dispatchId:row.dispatch_id,originalReviewId:row.original_review_id,
        signerKeyId:row.signer_key_id,signerFingerprint:row.signer_pin_sha256,
        sourceRevision:row.source_revision,decision:row.decision,
        verifiedAt:iso(row.verified_at),
      })),
      calibrationClosures:closures,dossierSnapshots:snapshots,truncated,
      originalDeviceIndependentAcceptance:"HOLD",
      masterConnected:"HOLD",
      ownerProductionAcceptance:"HOLD",
      pinStatus:devicePinStatus(),
    };
  });
}

export async function recordDeviceSignatureVerification({
  actorUserId,actorSessionId=null,campgroundId,packet
}) {
  const grant=await authorize(actorUserId,campgroundId);
  const sourceRevision=deployedRevision();
  if(!trustedPin())
    throw new Error("Independent original-device verifier pin not installed.");
  return scoped(actorUserId,async(client)=>{
    const row=await client.query(
      `select id,organization_id,dispatch_id,field_report_id,witness_id,
              digest_sha256,reviewed_by_user_id
       from public.service_fulfillment_original_device_review_events
       where campground_id=$1 and dispatch_id=$2
       order by reviewed_at desc,id desc limit 1`,
      [campgroundId,packet?.dispatchId],
    );
    if(row.rowCount!==1 || row.rows[0].organization_id!==grant.organizationId)
      throw new Error("Latest original device review missing.");
    const review=row.rows[0];
    const expected={
      campgroundId,
      dispatchId:review.dispatch_id,
      fieldReportId:review.field_report_id,
      originalReviewId:review.id,
      sourceRevision,
      evidenceDigestSha256:review.digest_sha256,
    };
    const verified=verifyOriginalDevicePacket({
      packet,expected,trust:trustedPin(),asOf:new Date().toISOString(),
    });
    if(!verified.accepted)
      throw new Error("Device packet verification HOLD: "+verified.status);
    const saved=await client.query(
      `insert into public.service_fulfillment_device_signature_verifications
       (organization_id,campground_id,dispatch_id,original_review_id,
        signer_key_id,signer_pin_sha256,source_revision,nonce_digest_sha256,
        signed_message_sha256,verified_by_user_id)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning id`,
      [grant.organizationId,campgroundId,review.dispatch_id,review.id,
        verified.keyId,verified.fingerprint,sourceRevision,
        verified.nonceDigestSha256,verified.messageDigestSha256,actorUserId],
    );
    await client.query("reset role");
    await appendAuditEvent(client,{
      actorUserId,actorSessionId,organizationId:grant.organizationId,campgroundId,
      actionKey:"campground.fulfillment.device_signature_source_verified",
      permissionKey:"staff.manage",
      subjectType:"service_fulfillment_device_signature_verifications",
      subjectId:saved.rows[0].id,
      afterState:{
        dispatchId:review.dispatch_id,originalReviewId:review.id,
        sourceRevision,signatureValid:true,
        independentDeviceAcceptance:"HOLD",
        masterConnected:"HOLD",
      },
    });
    return {id:saved.rows[0].id,status:verified.status};
  },sourceRevision);
}

export async function recordOwnerCalibrationClosure({
  actorUserId,actorSessionId=null,campgroundId,...input
}) {
  const grant=await authorize(actorUserId,campgroundId,true);
  const review=validateCalibrationClosure(input);
  return scoped(actorUserId,async(client)=>{
    const saved=await client.query(
      `insert into public.service_fulfillment_calibration_closure_events
       (organization_id,campground_id,checkpoint_id,latest_followup_id,
        previous_closure_id,decision,explanation,reviewed_by_user_id)
       values ($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
      [grant.organizationId,campgroundId,review.checkpointId,review.followupId,
        review.previousClosureId,review.decision,review.explanation,actorUserId],
    );
    await client.query("reset role");
    await appendAuditEvent(client,{
      actorUserId,actorSessionId,organizationId:grant.organizationId,campgroundId,
      actionKey:"campground.fulfillment.calibration_source_closure",
      permissionKey:"staff.manage",
      subjectType:"service_fulfillment_calibration_closure_events",
      subjectId:saved.rows[0].id,
      afterState:{
        checkpointId:review.checkpointId,followupId:review.followupId,
        decision:review.decision,forecastCertified:false,ownerAcceptance:"HOLD",
      },
    });
    return {id:saved.rows[0].id};
  });
}

export async function captureOwnerDossierContinuity({
  actorUserId,actorSessionId=null,campgroundId,evidenceSummary
}) {
  const grant=await authorize(actorUserId,campgroundId,true);
  const sourceRevision=deployedRevision();
  return scoped(actorUserId,async(client)=>{
    const prior=await client.query(
      `select id,dossier_digest_sha256 from public.service_fulfillment_owner_dossier_snapshots
       where campground_id=$1 order by recorded_at desc,id desc limit 1`,
      [campgroundId],
    );
    const previousSnapshot=prior.rowCount
      ? {id:prior.rows[0].id,digestSha256:prior.rows[0].dossier_digest_sha256}
      : null;
    const entry=buildDossierContinuity({
      campgroundId,sourceRevision,evidenceSummary,previousSnapshot,
    });
    const saved=await client.query(
      `insert into public.service_fulfillment_owner_dossier_snapshots
       (organization_id,campground_id,previous_snapshot_id,source_revision,
        dossier_digest_sha256,previous_digest_sha256,evidence_schema,completeness,
        witness_count,device_review_count,forecast_count,audited_count,
        recorded_by_user_id)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) returning id`,
      [grant.organizationId,campgroundId,entry.previousId,sourceRevision,
        entry.digestSha256,entry.previousDigest,entry.evidenceSchema,
        entry.completeness,entry.witnessCount,entry.deviceReviewCount,
        entry.forecastCount,entry.auditedCount,actorUserId],
    );
    await client.query("reset role");
    await appendAuditEvent(client,{
      actorUserId,actorSessionId,organizationId:grant.organizationId,campgroundId,
      actionKey:"campground.fulfillment.owner_dossier_continuity",
      permissionKey:"staff.manage",
      subjectType:"service_fulfillment_owner_dossier_snapshots",
      subjectId:saved.rows[0].id,
      afterState:{
        sourceRevision,previousSnapshotId:entry.previousId,
        evidenceHashSha256:entry.digestSha256,
        trustStatus:"UNSIGNED_HOLD",ownerAcceptance:"HOLD",
      },
    });
    return {id:saved.rows[0].id,digestSha256:entry.digestSha256};
  },sourceRevision);
}
