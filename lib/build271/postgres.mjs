import pg from "pg";
import {createHash} from "node:crypto";
import {sourceReadiness270,inspectOwnerEnrollment270,originalPool270} from "../build270/postgres.mjs";
import {hasCampgroundPermission} from "../authz/postgres.mjs";
import {getPlatformOverview} from "../platform/postgres.mjs";
import {normalizeSourceProof271,verifyOriginalHmac271,sourceEvidence271,
 replayEvidence271,SHA271,STAGES271,REPLAY_KINDS271,SNAPSHOTS271} from "./core.mjs";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const {Pool}=pg;
export async function originalAdmission271(){
 const base=await sourceReadiness270();
 const result={status:"HOLD_ORIGINAL_0246_OR_PIN",adopted:false,base};
 if(!base.adoption270||!base.database.runtimeTargetPinMatches)return result;
 try{
  const q=await originalPool270().query(
   "select to_regclass('icamp_private.owner_ceremony271') is not null as owner,"+
   "to_regclass('icamp_private.source_pair_proofs271') is not null as sources,"+
   "to_regclass('icamp_private.certified_booking_closure271') is not null as closures,"+
   "to_regclass('icamp_private.restore_replay271') is not null as replay,"+
   "exists(select 1 from icamp_meta.schema_migrations where version='0246') as version");
  result.adopted=Object.values(q.rows[0]??{}).every(x=>x===true);
  result.status=result.adopted?"ORIGINAL_0246_FOUND_EXTERNAL_ACCEPTANCE_HOLD":"HOLD_MIGRATION_0246";
 }catch{result.status="HOLD_ORIGINAL_HISTORY_QUERY";}
 return result;
}
function proofKey(kind){
 if(kind==="traffic")return {
  key:process.env.ICAMP_TELEMETRY269_HMAC_SECRET,
  source:process.env.ICAMP_TELEMETRY269_PILOT_SOURCE_ID,
  camp:process.env.ICAMP_TELEMETRY269_PILOT_CAMPGROUND_ID,
  permitted:true};
 if(kind==="comms")return {
  key:process.env.ICAMP_COMMS271_PROOF_HMAC_SECRET,
  source:process.env.ICAMP_COMMS270_SOURCE_ID,
  camp:process.env.ICAMP_COMMS271_PILOT_CAMPGROUND_ID,
  permitted:Boolean(process.env.ICAMP_COMMS270_SIGNING_KEY)};
 if(kind==="payments")return {
  key:process.env.ICAMP_PAYMENTS271_PROOF_HMAC_SECRET,
  source:process.env.ICAMP_PAYMENTS271_SOURCE_ID,
  camp:process.env.ICAMP_PAYMENTS271_PILOT_CAMPGROUND_ID,
  permitted:process.env.ICAMP_PAYMENTS270_READ_MODE==="test"};
 return null;
}
export async function acceptOriginalProof271(body,signature){
 if(typeof body!=="string"||body.length>2048)
  throw Error("SIGNED_SOURCE_REQUEST_OVERSIZE");
 const p=normalizeSourceProof271(JSON.parse(body));
 const configured=proofKey(p.sourceKind);
 if(!configured||configured.permitted!==true||!configured.source||
  !configured.camp||p.campgroundId!==configured.camp||
  p.sourceId!==configured.source||
  !verifyOriginalHmac271(body,signature,configured.key))
  throw Error("UNENROLLED_SOURCE_OR_SIGNATURE");
 const ready=await originalAdmission271();
 if(!ready.adopted)throw Error("ORIGINAL_DATABASE_NOT_INDEPENDENTLY_PINNED");
 const r=await originalPool270().query(
  "insert into icamp_private.source_pair_proofs271 "+
  "(campground_id,source_kind,source_id,nonce,challenge_sha256,observed_at) "+
  "values($1,$2,$3,$4,$5,$6) on conflict do nothing returning id",
  [p.campgroundId,p.sourceKind,p.sourceId,p.nonce,p.challengeDigest,p.observedAt]);
 if(r.rowCount!==1)throw Error("REPLAYED_ORIGINAL_SOURCE_NONCE");
 return {accepted:true,status:"ORIGINAL_SIGNED_CHALLENGE_STORED_EXTERNAL_PROVIDER_UNVERIFIED"};
}
export async function originalSources271(){
 const admitted=await originalAdmission271();
 if(!admitted.adopted)return {status:admitted.status,proofs:[],campground:"UNKNOWN"};
 try{
  const r=await originalPool270().query(
   "select c.id,c.lifecycle_state,e.state as enrollment_state,e.source_id as enrolled_source "+
   "from public.campgrounds c "+
   "left join icamp_private.telemetry_enrollment267 e on e.campground_id=c.id "+
   "where lower(c.name)='camp rosevear' limit 2");
  if(r.rowCount!==1)return {status:"HOLD_NO_UNIQUE_CAMP_ROSEVEAR",proofs:[],campground:"UNKNOWN"};
  const c=r.rows[0];
  const [last,samples]=await Promise.all([
   originalPool270().query(
    "select source_kind,source_id,max(received_at) as latest "+
    "from icamp_private.source_pair_proofs271 where campground_id=$1 "+
    "group by source_kind,source_id",[c.id]),
   originalPool270().query(
    "select max(received_at) as latest from icamp_private.traffic_stage269 "+
    "where campground_id=$1 and source_id=$2",[c.id,c.enrolled_source??""]),
  ]);
  const proofs=["traffic","comms","payments"].map(kind=>{
   const config=proofKey(kind);
   const scope=last.rows.find(x=>x.source_kind===kind&&x.source_id===config?.source);
   const status=sourceEvidence271({
    campgroundState:c.lifecycle_state,enrollmentState:c.enrollment_state,
    sourceKind:kind,lastProofAt:scope?.latest??null,
    lastSampleAt:kind==="traffic"?samples.rows[0]?.latest:null,
   });
   return {kind,status,paired:Boolean(scope),sourceConfigured:Boolean(config?.source&&config?.camp),sampleFresh:kind==="traffic"&&status.startsWith("FRESH_")};
  });
  return {status:"ORIGINAL_SOURCE_PROOF_DIAGNOSTICS_NOT_PROVIDER_CERTIFICATION",
   campground:c.lifecycle_state,proofs};
 }catch{return {status:"HOLD_ORIGINAL_TENANT_PROOF_QUERY",proofs:[],campground:"UNKNOWN"};}
}
export async function originalOwnerCeremony271(){
 const ready=await originalAdmission271();
 const owner=await inspectOwnerEnrollment270();
 if(!ready.adopted)return {status:ready.status,owner,stages:[]};
 try{
  const r=await originalPool270().query(
   "select c.event_kind,count(distinct c.reviewer_user_id)::integer as reviewers "+
   "from icamp_private.owner_ceremony271 c "+
   "join icamp_private.user_accounts a on a.id=c.subject_user_id "+
   "where a.username_normalized='rosevear' group by c.event_kind");
  const stages=STAGES271.map(kind=>({kind,
   witnessed:r.rows.some(x=>x.event_kind===kind&&x.reviewers>=1)}));
  const complete=stages.every(x=>x.witnessed)&&
   owner.status==="ELIGIBLE_FOR_INDEPENDENT_OWNER_SIGNIN_CHECK";
  return {status:complete?"ORIGINAL_STAGES_PRESENT_LOGIN_STILL_REQUIRES_LIVE_MFA":
   "HOLD_INDEPENDENT_OWNER_CEREMONY",owner,stages};
 }catch{return {status:"HOLD_OWNER_CEREMONY_QUERY",owner,stages:[]};}
}
export async function recordOwnerCeremony271({actorUserId,stage,evidenceDigest}){
 if(!UUID.test(actorUserId)||!STAGES271.includes(stage)||!SHA271.test(evidenceDigest))
  throw Error("Verified owner witness and SHA-256 required");
 const ready=await originalAdmission271();
 if(!ready.adopted||!(await getPlatformOverview(actorUserId,"aal2")))
  throw Error("Independent original platform operator required");
 const client=await originalPool270().connect();
 try{
  await client.query("begin");
  await client.query("select set_config('icamp.user_id',$1,true)",[actorUserId]);
  const q=await client.query(
   "insert into icamp_private.owner_ceremony271 "+
   "(subject_user_id,reviewer_user_id,event_kind,evidence_sha256) "+
   "select id,$1,$2,$3 from icamp_private.user_accounts "+
   "where username_normalized='rosevear' and id<>$1 "+
   "on conflict do nothing returning id",
   [actorUserId,stage,evidenceDigest]);
  if(q.rowCount!==1)throw Error("Original independent ceremony evidence rejected");
  await client.query("commit");
  return {stored:true,privilegesModified:false};
 }catch(e){await client.query("rollback").catch(()=>{});throw e;}
 finally{client.release();}
}
export async function certifyBooking271({reviewerId,campgroundId,recoveryId,evidenceDigest}){
 if(![reviewerId,campgroundId,recoveryId].every(x=>UUID.test(x))||
  !SHA271.test(evidenceDigest)||
  !(await hasCampgroundPermission(reviewerId,campgroundId,"campground.operations.manage")))
  throw Error("Independent active campground reviewer required");
 const ready=await originalAdmission271();
 if(!ready.adopted)throw Error("Original source not admitted");
 const client=await originalPool270().connect();
 try{
  await client.query("begin");
  await client.query("select set_config('icamp.user_id',$1,true)",[reviewerId]);
  const x=await client.query(
   "insert into icamp_private.certified_booking_closure271 "+
   "(recovery_id,campground_id,requested_by_user_id,reviewed_by_user_id,evidence_sha256) "+
   "select r.id,r.campground_id,r.local_owner_user_id,$1,$2 "+
   "from icamp_private.booking_recovery268 r where r.id=$3 and r.campground_id=$4 "+
   "on conflict do nothing returning id",
   [reviewerId,evidenceDigest,recoveryId,campgroundId]);
  if(x.rowCount!==1)throw Error("Independent source certification missing or already used");
  await client.query("commit");
  return {certified:true,booked:false,refunded:false};
 }catch(e){await client.query("rollback").catch(()=>{});throw e;}
 finally{client.release();}
}
export async function bookingCertifications271({userId,campgroundId}){
 if(![userId,campgroundId].every(x=>UUID.test(x))||
  !(await hasCampgroundPermission(userId,campgroundId,"campground.operations.manage")))
  throw Error("Tenant authorization required");
 if(!(await originalAdmission271()).adopted)return {status:"HOLD_ORIGINAL_0246",cases:[]};
 const r=await originalPool270().query(
  "select recovery_id,verified_at from icamp_private.certified_booking_closure271 "+
  "where campground_id=$1 order by verified_at desc limit 100",[campgroundId]);
 return {status:"ORIGINAL_CERTIFIED_CLOSURE_RECEIPTS",
  cases:r.rows.map(x=>({recoveryId:x.recovery_id,
   certifiedAt:x.verified_at?.toISOString()??null}))};
}
export async function recordRestoreReplay271({actorUserId,backupDigest,snapshot,kind,fingerprint}){
 if(!UUID.test(actorUserId)||![backupDigest,fingerprint].every(x=>SHA271.test(x))||
   !REPLAY_KINDS271.includes(kind)||!SNAPSHOTS271.includes(snapshot))
  throw Error("Original replay snapshot and digest required");
 if(!(await originalAdmission271()).adopted||
  !(await getPlatformOverview(actorUserId,"aal2")))
  throw Error("Original verified independent platform operator required");
 const client=await originalPool270().connect();
 try{
  await client.query("begin");
  await client.query("select set_config('icamp.user_id',$1,true)",[actorUserId]);
  const q=await client.query(
   "insert into icamp_private.restore_replay271 "+
   "(original_backup_sha256,snapshot_kind,evidence_kind,actor_user_id,source_fingerprint_sha256) "+
   "values($1,$2,$3,$4,$5) on conflict do nothing returning id",
   [backupDigest,snapshot,kind,actorUserId,fingerprint]);
  if(q.rowCount!==1)throw Error("Replay already recorded or original witness absent");
  await client.query("commit");
  return {stored:true,actualHostRestoreVerified:false};
 }catch(e){await client.query("rollback").catch(()=>{});throw e;}
 finally{client.release();}
}
export async function originalReplayStatus271(){
 if(!(await originalAdmission271()).adopted)return {status:"HOLD_ORIGINAL_0246",receipts:null};
 try{
  const q=await originalPool270().query(
   "select original_backup_sha256,snapshot_kind,evidence_kind,actor_user_id,source_fingerprint_sha256 "+
   "from icamp_private.restore_replay271 order by observed_at desc limit 200");
  const chain=replayEvidence271(q.rows.map(x=>({
   backupDigest:x.original_backup_sha256,snapshot:x.snapshot_kind,
   kind:x.evidence_kind,actorId:x.actor_user_id,fingerprint:x.source_fingerprint_sha256,
  })));
  return {status:chain,receipts:q.rowCount,actualHostRestoreVerified:false};
 }catch{return {status:"HOLD_REPLAY_SOURCE_QUERY",receipts:null};}
}
