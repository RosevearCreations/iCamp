import { originalPool270 } from "../build270/postgres.mjs";
import { originalAdmission278, ownerReadback278 } from "../build278/postgres.mjs";
import { ownerAdoptedPins277 } from "../build277/postgres.mjs";
import { getPlatformOverview } from "../platform/postgres.mjs";
import { UUID276 } from "../build276/core.mjs";
import {
  validateCorrelation279, validateRecoveryAudit279, validateRestoreFinalization279,
  verifyOriginalCorrelation279, summarizeCorrelation279,
  summarizeRecoveryAudit279, summarizeIsolatedFinalization279,classifyClosure279,
} from "./core.mjs";

export async function originalAdmission279() {
  const old=await originalAdmission278();
  const status={adopted:false,host:old.host,status:old.status};
  if(!old.adopted||!old.host.pinned)return status;
  try{
    const q=await originalPool270().query(
      "select to_regclass('icamp_private.provider_receipt_correlation279') is not null as source,"+
      "to_regclass('icamp_private.owner_recovery_access_audit279') is not null as owner,"+
      "to_regclass('icamp_private.isolated_restore_evidence279') is not null as restore,"+
      "exists(select 1 from icamp_meta.schema_migrations where version='0252') as predecessor,"+
      "exists(select 1 from icamp_meta.schema_migrations where version='0253') as migration");
    status.adopted=Object.values(q.rows[0]??{}).every(x=>x===true);
    status.status=status.adopted?"ORIGINAL_0253_SCHEMA_PRESENT_EXTERNAL_PROOFS_REQUIRED":
      "HOLD_ORIGINAL_MIGRATION_0253";
  }catch{status.status="HOLD_ORIGINAL_0253_READBACK";}
  return status;
}
async function requireOriginalReviewer279(actorId) {
  if(!UUID276.test(actorId)||!(await originalAdmission279()).adopted||
    (await getPlatformOverview(actorId,"aal2"))===null)
    throw Error("ORIGINAL_AAL2_INDEPENDENT_AUDITOR_REQUIRED");
}
async function withActor279(actorId,fn) {
  const client=await originalPool270().connect();
  try{
    await client.query("begin");
    await client.query("select set_config('icamp.user_id',$1,true)",[actorId]);
    const result=await fn(client);
    await client.query("commit");
    return result;
  }catch(e){await client.query("rollback").catch(()=>{});throw e;}
  finally{client.release();}
}

const pairSelect279=
  "select c.source_id,c.key_id,c.commit_sha,c.challenge_id,c.request_nonce,"+
  "c.issued_at,c.expires_at,r.accepted_at as field_accepted_at,"+
  "f.observed_at as field_reviewed_at,f.id as field_review_id,"+
  "r.signed_body as field_body,r.signature_b64url as field_signature,"+
  "r.body_sha256 as field_sha256,h.id as signed_receipt_id,"+
  "h.received_at as provider_received_at,h.signed_body as provider_body,"+
  "h.signature_b64url as provider_signature,h.body_sha256 as provider_sha256,"+
  "x.reviewed_at as correlated_at "+
  "from icamp_private.peer_field_review278 f "+
  "join icamp_private.peer_challenge_response277 r on r.id=f.challenge_response_id "+
  "join icamp_private.peer_challenge277 c on c.id=r.challenge_id "+
  "join icamp_private.signed_source_handshake275 h on h.source_id=c.source_id "+
  "left join icamp_private.provider_receipt_correlation279 x "+
  "on x.field_review_id=f.id and x.signed_receipt_id=h.id ";

export async function recordProviderCorrelation279({
  reviewerId,fieldReviewId,providerReceiptId,evidenceDigest,
}){
  const v=validateCorrelation279({fieldReviewId,providerReceiptId,evidenceDigest});
  await requireOriginalReviewer279(reviewerId);
  const q=await originalPool270().query(pairSelect279+
    "where f.id=$1 and h.id=$2",[v.fieldReviewId,v.providerReceiptId]);
  if(q.rowCount!==1)throw Error("ORIGINAL_PAIR_NOT_FOUND");
  const pins=await ownerAdoptedPins277();
  verifyOriginalCorrelation279(q.rows[0],pins);
  return withActor279(reviewerId,async client=>{
    const r=await client.query(
      "insert into icamp_private.provider_receipt_correlation279 "+
      "(field_review_id,signed_receipt_id,reviewer_user_id,independent_provider_evidence_sha256) "+
      "values($1,$2,$3,$4) on conflict do nothing returning id",
      [v.fieldReviewId,v.providerReceiptId,reviewerId,v.evidenceDigest]);
    if(r.rowCount!==1)throw Error("ORIGINAL_PROVIDER_CORRELATION_REVIEW_DENIED");
    return {stored:true,status:"CORRELATED_TWO_SIGNED_RECEIPTS_INDEPENDENT_PROVIDER_CUSTODY_PENDING"};
  });
}

export async function recordOwnerRecoveryAudit279({
  auditorId,mfaReadbackId,evidenceDigest,
}){
  const v=validateRecoveryAudit279({mfaReadbackId,evidenceDigest});
  await requireOriginalReviewer279(auditorId);
  return withActor279(auditorId,async client=>{
    const r=await client.query(
      "insert into icamp_private.owner_recovery_access_audit279 "+
      "(mfa_readback_id,auditor_user_id,original_access_evidence_sha256) "+
      "values($1,$2,$3) on conflict do nothing returning id",
      [v.mfaReadbackId,auditorId,v.evidenceDigest]);
    if(r.rowCount!==1)throw Error("ORIGINAL_OWNER_RECOVERY_AUDIT_REJECTED");
    return {stored:true,status:"INDEPENDENT_OWNER_ACCESS_AUDIT_STORED_CURRENT_MFA_REQUIRED"};
  });
}

export async function recordIsolatedRestoreFinalization279({
  reviewerId,...raw
}){
  const v=validateRestoreFinalization279(raw);
  await requireOriginalReviewer279(reviewerId);
  return withActor279(reviewerId,async client=>{
    const r=await client.query(
      "insert into icamp_private.isolated_restore_evidence279 "+
      "(service_readback_id,final_reviewer_user_id,original_backup_manifest_sha256,"+
      "tenant_isolation_sha256,reservation_integrity_sha256,payment_ledger_sha256,"+
      "service_health_sha256,independent_comparison_sha256) "+
      "values($1,$2,$3,$4,$5,$6,$7,$8) on conflict do nothing returning id",
      [v.serviceReadbackId,reviewerId,v.backupDigest,v.tenantDigest,
       v.reservationDigest,v.paymentDigest,v.healthDigest,v.comparisonDigest]);
    if(r.rowCount!==1)throw Error("ISOLATED_RESTORE_FINALIZATION_REJECTED");
    return {stored:true,status:"FOUR_SCOPE_ISOLATED_EVIDENCE_REVIEW_STORED_NOT_PROVIDER_CERTIFIED",
      productionRestored:false};
  });
}

export async function sourceCorrelations279(){
  const admission=await originalAdmission279();
  const empty=summarizeCorrelation279([],{});
  if(!admission.adopted)return {...empty,admission,status:admission.status,fieldCandidates:[],providerCandidates:[]};
  try{
    const [pairs,fields,providers,pins]=await Promise.all([
      originalPool270().query(
        "select distinct on(c.source_id) c.source_id,c.key_id,c.commit_sha,"+
        "c.challenge_id,c.request_nonce,c.issued_at,c.expires_at,"+
        "r.accepted_at as field_accepted_at,f.observed_at as field_reviewed_at,"+
        "f.id as field_review_id,r.signed_body as field_body,"+
        "r.signature_b64url as field_signature,r.body_sha256 as field_sha256,"+
        "h.id as signed_receipt_id,h.received_at as provider_received_at,"+
        "h.signed_body as provider_body,h.signature_b64url as provider_signature,"+
        "h.body_sha256 as provider_sha256,x.reviewed_at as correlated_at "+
        "from icamp_private.provider_receipt_correlation279 x "+
        "join icamp_private.peer_field_review278 f on f.id=x.field_review_id "+
        "join icamp_private.peer_challenge_response277 r on r.id=f.challenge_response_id "+
        "join icamp_private.peer_challenge277 c on c.id=r.challenge_id "+
        "join icamp_private.signed_source_handshake275 h on h.id=x.signed_receipt_id "+
        "where x.reviewed_at>=statement_timestamp()-interval '5 minutes' "+
        "order by c.source_id,x.reviewed_at desc"),
      originalPool270().query(
        "select f.id,c.source_id,f.observed_at from icamp_private.peer_field_review278 f "+
        "join icamp_private.peer_challenge_response277 r on r.id=f.challenge_response_id "+
        "join icamp_private.peer_challenge277 c on c.id=r.challenge_id "+
        "where r.accepted_at>=statement_timestamp()-interval '5 minutes' "+
        "order by f.observed_at desc limit 28"),
      originalPool270().query(
        "select id,source_id,key_id,commit_sha,received_at "+
        "from icamp_private.signed_source_handshake275 "+
        "where received_at>=statement_timestamp()-interval '5 minutes' "+
        "order by received_at desc limit 28"),
      ownerAdoptedPins277(),
    ]);
    return {...summarizeCorrelation279(pairs.rows,pins),admission,
      fieldCandidates:fields.rows.map(x=>({id:x.id,source:x.source_id})),
      providerCandidates:providers.rows.map(x=>({
        id:x.id,source:x.source_id,keyId:x.key_id,commitSha:x.commit_sha}))};
  }catch{
    return {...empty,admission,status:"HOLD_ORIGINAL_RECEIPT_CORRELATION_READBACK",
      fieldCandidates:[],providerCandidates:[]};
  }
}

export async function recoveryAccessAudit279(session){
  const admission=await originalAdmission279();
  const owner=await ownerReadback278(session);
  const base={status:admission.status,owner,mfaCandidates:[]};
  if(!admission.adopted)return base;
  try{
    const q=await originalPool270().query(
      "select m.id as mfa_readback_id,m.owner_user_id,m.session_id,"+
      "a.id is not null as independently_audited "+
      "from icamp_private.owner_mfa_readback278 m "+
      "left join icamp_private.owner_recovery_access_audit279 a on a.mfa_readback_id=m.id "+
      "join icamp_private.auth_sessions s on s.id=m.session_id "+
      "where s.revoked_at is null and s.expires_at>statement_timestamp() "+
      "order by m.reviewed_at desc limit 30");
    const matching=q.rows.find(x=>x.owner_user_id===session.user.id &&
      x.session_id===session.sessionId && x.independently_audited);
    return {...summarizeRecoveryAudit279(owner,session,matching?{
      sessionId:matching.session_id,ownerId:matching.owner_user_id}:null),owner,
      mfaCandidates:q.rows.map(x=>({id:x.mfa_readback_id,
        audited:x.independently_audited,
        originalRosevear:x.owner_user_id===session.user.id&&
          session.user.username?.toLowerCase()==="rosevear"}))};
  }catch{return base;}
}

export async function isolatedFinalization279(){
  const admission=await originalAdmission279();
  const empty=summarizeIsolatedFinalization279([]);
  if(!admission.adopted)return {...empty,admission,status:admission.status,serviceCandidates:[]};
  try{
    const q=await originalPool270().query(
      "select s.id,s.reviewed_at,f.id is not null as finalized "+
      "from icamp_private.restore_service_readback278 s "+
      "left join icamp_private.isolated_restore_evidence279 f on f.service_readback_id=s.id "+
      "order by s.reviewed_at desc limit 35");
    return {...summarizeIsolatedFinalization279(q.rows),admission,
      serviceCandidates:q.rows.map(x=>({id:x.id,finalized:x.finalized}))};
  }catch{return {...empty,admission,status:"HOLD_ORIGINAL_ISOLATED_EVIDENCE_READBACK",
    serviceCandidates:[]};}
}

export async function acceptanceSummary279(session){
  const [admission,peers,owner,restore]=await Promise.all([
    originalAdmission279(),sourceCorrelations279(),
    recoveryAccessAudit279(session),isolatedFinalization279()]);
  return {admission,peers,owner,restore,
    closure:classifyClosure279({admission,peers,owner,restore})};
}
