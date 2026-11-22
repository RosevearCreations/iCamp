import {originalPool270} from "../build270/postgres.mjs";
import {originalAdmission271,originalSources271,
 originalOwnerCeremony271,originalReplayStatus271} from "../build271/postgres.mjs";
import {getPlatformOverview} from "../platform/postgres.mjs";
import {hasCampgroundPermission} from "../authz/postgres.mjs";
import {SHA272,UUID272,MASTER272,evaluateOwnerLogin272,
 evaluateIncident272,evaluateDryRun272} from "./core.mjs";
export async function originalAdmission272(){
 const prior=await originalAdmission271();
 const result={status:"HOLD_ORIGINAL_0247",adopted:false,hostPinned:Boolean(prior.base?.database?.runtimeTargetPinMatches)};
 if(!prior.adopted||!result.hostPinned)return result;
 try{
  const r=await originalPool270().query(
   "select to_regclass('icamp_private.owner_login_witness272') is not null as owner,"+
   "to_regclass('icamp_private.provider_booking_acceptance272') is not null as booking,"+
   "to_regclass('icamp_private.comms_incident_review272') is not null as comms,"+
   "to_regclass('icamp_private.restore_dryrun_review272') is not null as restore,"+
   "exists(select 1 from icamp_meta.schema_migrations where version='0247') as version");
  result.adopted=Object.values(r.rows[0]??{}).every(x=>x===true);
  result.status=result.adopted?"ORIGINAL_0247_PRESENT_FIELD_RECEIPTS_REQUIRED":"HOLD_0247_NOT_ADOPTED";
 }catch{result.status="HOLD_0247_QUERY_FAILED";}
 return result;
}
export async function inspectFieldAcceptance272(){
 const admission=await originalAdmission272();
 const result={status:admission.status,admission,
  owner:{status:"HOLD_ORIGINAL",witnessedSessions:0},
  booking:{status:"HOLD_ORIGINAL",reviewed:0},
  comms:{status:"HOLD_ORIGINAL",reviewed:0},
  restore:{status:"HOLD_ORIGINAL",reviewed:0},
  liveExternalRestorationVerified:false};
 if(!admission.adopted)return result;
 try{
  const [owner,cases,comms,restore,pair,ceremony,replay]=await Promise.all([
   originalPool270().query(
    "select count(*)::integer as n from icamp_private.owner_login_witness272 w "+
    "join icamp_private.auth_sessions s on s.id=w.session_id "+
    "where s.assurance_level='aal2' and s.revoked_at is null and s.expires_at>statement_timestamp()"),
   originalPool270().query(
    "select count(*)::integer as n from icamp_private.provider_booking_acceptance272"),
   originalPool270().query(
    "select count(*)::integer as n from icamp_private.comms_incident_review272"),
   originalPool270().query(
    "select count(*)::integer as n from icamp_private.restore_dryrun_review272"),
   originalSources271(),originalOwnerCeremony271(),originalReplayStatus271()
  ]);
  result.owner={status:evaluateOwnerLogin272({
    originalPinned:admission.hostPinned,
    accountActive:ceremony.owner?.accountActive,
    verifiedEmail:ceremony.owner?.recoveryEmailVerified,
    passwordExists:ceremony.owner?.credentialPresent,
    verifiedMfa:ceremony.owner?.mfaVerified,
    independentGrant:ceremony.owner?.independentOwnerBinding&&ceremony.owner?.platformGrantActive,
    actualAal2Session:owner.rows[0]?.n>0,
    independentWitness:owner.rows[0]?.n>0
  }),witnessedSessions:owner.rows[0]?.n??0};
  result.booking={status:cases.rows[0]?.n>0?
   "SOURCE_LINKED_BOOKING_REVIEWED_NOT_BANK_CERTIFIED":
   "HOLD_NO_ORIGINAL_PROVIDER_BOOKING_REVIEW",reviewed:cases.rows[0]?.n??0};
  const signedComms=pair.proofs?.some(x=>x.kind==="comms"&&x.status.startsWith("FRESH_"));
  result.comms={status:evaluateIncident272({
    sourcePaired:signedComms,durableAttemptAccepted:comms.rows[0]?.n>0,
    signedDeliveredReceipt:comms.rows[0]?.n>0,independentReviewer:comms.rows[0]?.n>0,
    originalRecipientAcknowledged:false
  }),reviewed:comms.rows[0]?.n??0};
  result.restore={status:evaluateDryRun272({
    originalBackupWitness:restore.rows[0]?.n>0,
    isolatedRestoreWitness:replay.status?.startsWith("REPLAY_"),
    allFourCanonicalFingerprints:replay.status?.startsWith("REPLAY_"),
    independentReviewer:restore.rows[0]?.n>0
  }),reviewed:restore.rows[0]?.n??0};
  result.status="ORIGINAL_0247_FIELD_EVIDENCE_REVIEWED";
 }catch{result.status="HOLD_ORIGINAL_ACCEPTANCE_QUERY";}
 return result;
}
async function withOriginalTransaction272(actor,fn){
 const client=await originalPool270().connect();
 try{
  await client.query("begin");
  await client.query("select set_config('icamp.user_id',$1,true)",[actor]);
  const res=await fn(client);
  await client.query("commit");
  return res;
 }catch(e){await client.query("rollback").catch(()=>{});throw e;}
 finally{client.release();}
}
function requireSha(value){if(!SHA272.test(value))throw Error("SHA256_REQUIRED")}
function requireUuid(value){if(!UUID272.test(value))throw Error("UUID_REQUIRED")}
async function requireOriginal272(){if(!(await originalAdmission272()).adopted)
 throw Error("ORIGINAL_HOST_OR_0247_UNVERIFIED")}
async function requireOperator272(userId){requireUuid(userId);
 if(!(await getPlatformOverview(userId,"aal2")))
 throw Error("INDEPENDENT_ORIGINAL_PLATFORM_OPERATOR_REQUIRED")}
export async function recordOwnerLogin272({reviewerId,sessionId,evidenceDigest}){
 requireUuid(sessionId);requireSha(evidenceDigest);
 await requireOriginal272();await requireOperator272(reviewerId);
 return withOriginalTransaction272(reviewerId,async(client)=>{
  const q=await client.query(
   "insert into icamp_private.owner_login_witness272 "+
   "(subject_user_id,session_id,reviewer_user_id,evidence_sha256) "+
   "select a.id,$1,$2,$3 from icamp_private.user_accounts a "+
   "where a.username_normalized='rosevear' "+
   "on conflict do nothing returning id",
   [sessionId,reviewerId,evidenceDigest]);
  if(q.rowCount!==1)throw Error("ORIGINAL_AAL2_SESSION_UNVERIFIED_OR_DUPLICATE");
  return {stored:true,accountChanged:false,credentialsChanged:false};
 });
}
export async function recordProviderBooking272(input){
 const {reviewerId,campgroundId,recoveryId,traceId,processorWitnessId,
  siteWitnessId,deliveryWitnessId,guestWitnessId,evidenceDigest}=input;
 for(const v of [reviewerId,campgroundId,recoveryId,traceId,processorWitnessId,
  siteWitnessId,deliveryWitnessId,guestWitnessId])requireUuid(v);
 requireSha(evidenceDigest);
 await requireOriginal272();
 if(!(await hasCampgroundPermission(reviewerId,campgroundId,"campground.operations.manage")))
  throw Error("ASSIGNED_CAMPGROUND_MANAGER_REQUIRED");
 return withOriginalTransaction272(reviewerId,async(client)=>{
  const q=await client.query(
   "insert into icamp_private.provider_booking_acceptance272 "+
   "(recovery_id,campground_id,trace_id,processor_witness_id,site_witness_id,"+
   "delivery_witness_id,guest_witness_id,reviewer_user_id,evidence_sha256) "+
   "values($1,$2,$3,$4,$5,$6,$7,$8,$9) on conflict do nothing returning id",
   [recoveryId,campgroundId,traceId,processorWitnessId,siteWitnessId,
    deliveryWitnessId,guestWitnessId,reviewerId,evidenceDigest]);
  if(q.rowCount!==1)throw Error("ORIGINAL_BOOKING_EVIDENCE_REJECTED_OR_REPLAYED");
  return {stored:true,charged:false,booked:false,guestMessaged:false};
 });
}
export async function recordCommsReview272(input){
 const {reviewerId,outboxId,attemptId,deliveredReceiptId,sourcePairId,masterKind,externalAckDigest}=input;
 for(const v of [reviewerId,outboxId,attemptId,deliveredReceiptId,sourcePairId])requireUuid(v);
 requireSha(externalAckDigest);
 if(!MASTER272.includes(masterKind))throw Error("SOURCE_MASTER_UNKNOWN");
 await requireOriginal272();await requireOperator272(reviewerId);
 return withOriginalTransaction272(reviewerId,async(client)=>{
  const q=await client.query(
   "insert into icamp_private.comms_incident_review272 "+
   "(outbox_id,attempt_id,delivered_receipt_id,source_pair_id,master_kind,"+
   "external_ack_sha256,reviewer_user_id) "+
   "values($1,$2,$3,$4,$5,$6,$7) on conflict do nothing returning id",
   [outboxId,attemptId,deliveredReceiptId,sourcePairId,masterKind,
    externalAckDigest,reviewerId]);
  if(q.rowCount!==1)throw Error("SIGNED_COMMS_EVIDENCE_REJECTED_OR_REPLAYED");
  return {stored:true,recipientAcknowledged:false,caseClosed:false};
 });
}
export async function recordRestoreDryRun272({reviewerId,backupDigest,evidenceDigest}){
 requireSha(backupDigest);requireSha(evidenceDigest);
 await requireOriginal272();await requireOperator272(reviewerId);
 return withOriginalTransaction272(reviewerId,async(client)=>{
  const q=await client.query(
   "insert into icamp_private.restore_dryrun_review272 "+
   "(backup_sha256,reviewer_user_id,evidence_sha256) "+
   "values($1,$2,$3) on conflict do nothing returning id",
   [backupDigest,reviewerId,evidenceDigest]);
  if(q.rowCount!==1)throw Error("ORIGINAL_RESTORE_CHAIN_REJECTED_OR_REPLAYED");
  return {stored:true,productionDataRestored:false,externalHostRestored:false};
 });
}
export async function tenantProviderStatus272({userId,campgroundId}){
 requireUuid(userId);requireUuid(campgroundId);
 if(!(await hasCampgroundPermission(userId,campgroundId,"campground.operations.manage")))
  throw Error("ASSIGNED_CAMPGROUND_MANAGER_REQUIRED");
 if(!(await originalAdmission272()).adopted)return {status:"HOLD_ORIGINAL_0247",reviewed:0};
 const r=await originalPool270().query(
  "select count(*)::integer as n from icamp_private.provider_booking_acceptance272 "+
   "where campground_id=$1",[campgroundId]);
 return {status:"SOURCE_LINKED_TENANT_PROOFS_NO_NEW_PAYMENTS",reviewed:r.rows[0]?.n??0};
}
