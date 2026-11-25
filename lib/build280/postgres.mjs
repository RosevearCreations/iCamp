import { originalPool270 } from "../build270/postgres.mjs";
import { originalAdmission279, sourceCorrelations279 } from "../build279/postgres.mjs";
import { getPlatformOverview } from "../platform/postgres.mjs";
import { UUID276 } from "../build276/core.mjs";
import {
 validateProviderKey280,validateProviderKeyReview280,
 verifyProviderClosure280,validateOwnerCompletion280,
 validateCertificate280,scopeDigest280,classifyCertificate280,
} from "./core.mjs";

export async function originalAdmission280(){
 const prior=await originalAdmission279();
 const result={adopted:false,host:prior.host,status:prior.status};
 if(!prior.adopted||!prior.host.pinned)return result;
 try{
  const r=await originalPool270().query(
   "select to_regclass('icamp_private.external_provider_key_proposal280') is not null as proposal,"+
   "to_regclass('icamp_private.external_provider_key_review280') is not null as independent_review,"+
   "to_regclass('icamp_private.external_provider_signed_closure280') is not null as signed_closure,"+
   "to_regclass('icamp_private.owner_recovery_witness280') is not null as owner,"+
   "to_regclass('icamp_private.isolated_restore_certificate280') is not null as certificate,"+
   "exists(select 1 from icamp_meta.schema_migrations where version='0253') as predecessor,"+
   "exists(select 1 from icamp_meta.schema_migrations where version='0254') as migration");
  result.adopted=Object.values(r.rows[0]??{}).every(x=>x===true);
  result.status=result.adopted?"ORIGINAL_0254_SCHEMA_PRESENT_LIVE_PROVIDER_SIGNER_REQUIRED":
   "HOLD_ORIGINAL_MIGRATION_0254";
 }catch{result.status="HOLD_ORIGINAL_0254_READBACK";}
 return result;
}
async function requireOriginalReviewer280(id){
 if(!UUID276.test(id)||!(await originalAdmission280()).adopted||
  (await getPlatformOverview(id,"aal2"))===null)
  throw Error("INDEPENDENT_ORIGINAL_AAL2_OPERATOR_REQUIRED");
}
async function withActor280(id,fn){
 const client=await originalPool270().connect();
 try{
  await client.query("begin");
  await client.query("select set_config('icamp.user_id',$1,true)",[id]);
  const result=await fn(client);await client.query("commit");return result;
 }catch(e){await client.query("rollback").catch(()=>{});throw e;}
 finally{client.release();}
}

export async function proposeExternalProviderKey280({actorId,...raw}){
 const k=validateProviderKey280(raw);
 await requireOriginalReviewer280(actorId);
 return withActor280(actorId,async client=>{
  const q=await client.query(
    "insert into icamp_private.external_provider_key_proposal280 "+
    "(provider_id,key_id,public_key_pem,key_fingerprint_sha256,"+
    "independent_source_evidence_sha256,proposed_by) "+
    "values($1,$2,$3,$4,$5,$6) on conflict do nothing returning id",
    [k.providerId,k.keyId,k.publicKeyPem,k.fingerprint,k.evidenceDigest,actorId]);
  if(q.rowCount!==1)throw Error("EXTERNAL_PUBLIC_KEY_PROPOSAL_REJECTED");
  return {status:"EXTERNAL_PUBLIC_KEY_PROPOSED_SECOND_INDEPENDENT_REVIEW_REQUIRED"};
 });
}
export async function reviewExternalProviderKey280({reviewerId,proposalId,evidenceDigest}){
 const v=validateProviderKeyReview280({proposalId,evidenceDigest});
 await requireOriginalReviewer280(reviewerId);
 const q=await originalPool270().query(
  "select provider_id,key_id,public_key_pem,key_fingerprint_sha256,"+
  "independent_source_evidence_sha256 from icamp_private.external_provider_key_proposal280 "+
  "where id=$1",[v.proposalId]);
 if(q.rowCount!==1)throw Error("UNKNOWN_EXTERNAL_PROVIDER_PIN");
 validateProviderKey280({providerId:q.rows[0].provider_id,keyId:q.rows[0].key_id,
  publicKeyPem:q.rows[0].public_key_pem,
  fingerprint:q.rows[0].key_fingerprint_sha256,
  evidenceDigest:q.rows[0].independent_source_evidence_sha256});
 return withActor280(reviewerId,async client=>{
  const r=await client.query(
    "insert into icamp_private.external_provider_key_review280 "+
    "(proposal_id,reviewed_by,verified_out_of_band_sha256) "+
    "values($1,$2,$3) on conflict do nothing returning id",
    [v.proposalId,reviewerId,v.evidenceDigest]);
  if(r.rowCount!==1)throw Error("INDEPENDENT_PROVIDER_KEY_REVIEW_REJECTED");
  return {status:"PROVIDER_PUBLIC_KEY_INDEPENDENTLY_REVIEWED_NO_SIGNATURE_YET"};
 });
}

const keyEvidenceQuery280=
 "select k.id as key_review_id,p.provider_id,p.key_id,p.public_key_pem,"+
 "p.key_fingerprint_sha256,p.independent_source_evidence_sha256,"+
 "i.id as isolated_evidence_id,i.original_backup_manifest_sha256,"+
 "i.tenant_isolation_sha256,i.reservation_integrity_sha256,"+
 "i.payment_ledger_sha256,i.service_health_sha256,"+
 "a.source_host_sha256,a.isolated_host_sha256,a.provider_id as original_provider_id "+
 "from icamp_private.external_provider_key_review280 k "+
 "join icamp_private.external_provider_key_proposal280 p on p.id=k.proposal_id "+
 "join icamp_private.isolated_restore_evidence279 i on true "+
 "join icamp_private.restore_service_readback278 s on s.id=i.service_readback_id "+
 "join icamp_private.external_restore_review277 e on e.id=s.external_review_id "+
 "join icamp_private.restore_closure_review276 c on c.id=e.closure_review_id "+
 "join icamp_private.restore_provider_attestation273 a on a.id=c.provider_attestation_id "+
 "where k.id=$1 and i.id=$2 and a.provider_id=p.provider_id "+
 "and a.source_host_sha256=e.source_host_sha256 "+
 "and a.isolated_host_sha256=e.isolated_host_sha256";

function verifiedClosure280(row,body,signature,now=Date.now()){
 const k=validateProviderKey280({
  providerId:row.provider_id,keyId:row.key_id,publicKeyPem:row.public_key_pem,
  fingerprint:row.key_fingerprint_sha256,
  evidenceDigest:row.independent_source_evidence_sha256});
 const original={providerId:row.original_provider_id,
  sourceHostSha256:row.source_host_sha256,
  isolatedHostSha256:row.isolated_host_sha256,
  backupManifestSha256:row.original_backup_manifest_sha256,
  scopeDigestSha256:scopeDigest280(row)};
 return verifyProviderClosure280({body,signature,providerKey:k,original,now});
}
export async function recordProviderSignedClosure280({
 reviewerId,keyReviewId,isolatedEvidenceId,body,signature,
}){
 if(!UUID276.test(keyReviewId)||!UUID276.test(isolatedEvidenceId))
  throw Error("INVALID_PROVIDER_REVIEW_REFERENCES");
 await requireOriginalReviewer280(reviewerId);
 const r=await originalPool270().query(keyEvidenceQuery280,[keyReviewId,isolatedEvidenceId]);
 if(r.rowCount!==1)throw Error("NO_ORIGINAL_PROVIDER_ISOLATED_PROOF");
 const proof=verifiedClosure280(r.rows[0],body,signature);
 return withActor280(reviewerId,async client=>{
  const saved=await client.query(
   "insert into icamp_private.external_provider_signed_closure280 "+
   "(key_review_id,isolated_evidence_id,provider_id,provider_event_id,nonce,"+
   "signed_body,signature_b64url,body_sha256,reviewed_by) "+
   "values($1,$2,$3,$4,$5,$6,$7,$8,$9) on conflict do nothing returning id",
   [keyReviewId,isolatedEvidenceId,proof.providerId,proof.providerEventId,
    proof.nonce,body,signature,proof.digest,reviewerId]);
  if(saved.rowCount!==1)throw Error("SIGNED_PROVIDER_CLOSURE_REPLAY_OR_REVIEW_DENIED");
  return {status:"ORIGINAL_EXTERNAL_ED25519_CLOSURE_VERIFIED_INDEPENDENT_CERTIFICATE_REQUIRED"};
 });
}

export async function witnessOwnerRecovery280({reviewerId,ownerAuditId,evidenceDigest}){
 const v=validateOwnerCompletion280({ownerAuditId,evidenceDigest});
 await requireOriginalReviewer280(reviewerId);
 return withActor280(reviewerId,async client=>{
  const q=await client.query(
   "insert into icamp_private.owner_recovery_witness280 "+
   "(owner_audit_id,witness_user_id,original_recovery_evidence_sha256) "+
   "values($1,$2,$3) on conflict do nothing returning id",
   [v.ownerAuditId,reviewerId,v.evidenceDigest]);
  if(q.rowCount!==1)throw Error("ORIGINAL_ROSEVEAR_RECOVERY_WITNESS_DENIED");
  return {status:"ORIGINAL_ROSEVEAR_RECOVERY_WITNESS_RECORDED_ACTIVE_SESSION_REQUIRED"};
 });
}

async function verifiedSignedClosures280(){
 const q=await originalPool270().query(
  "select c.id as provider_closure_id,c.isolated_evidence_id,"+
  "c.key_review_id,c.signed_body,c.signature_b64url,c.body_sha256,c.recorded_at "+
  "from icamp_private.external_provider_signed_closure280 c "+
  "where c.recorded_at>=statement_timestamp()-interval '7 days' "+
  "order by c.recorded_at desc limit 30");
 const found=[];
 for(const record of q.rows){
  try{
   const k=await originalPool270().query(keyEvidenceQuery280,
    [record.key_review_id,record.isolated_evidence_id]);
   if(k.rowCount!==1)continue;
   const signed=verifiedClosure280(k.rows[0],record.signed_body,
    record.signature_b64url,Date.parse(record.recorded_at));
   if(signed.digest===record.body_sha256)
    found.push({id:record.provider_closure_id,providerId:signed.providerId,
      originalSignatureVerified:true});
  }catch{}
 }
 return found;
}

export async function recordIsolatedAcceptanceCertificate280({
 reviewerId,providerClosureId,ownerWitnessId,evidenceDigest,
}){
 const v=validateCertificate280({providerClosureId,ownerWitnessId,evidenceDigest});
 await requireOriginalReviewer280(reviewerId);
 const [signed,peers,owner]=await Promise.all([
  verifiedSignedClosures280(),sourceCorrelations279(),
  originalPool270().query(
   "select w.id from icamp_private.owner_recovery_witness280 w "+
   "join icamp_private.owner_recovery_access_audit279 a on a.id=w.owner_audit_id "+
   "join icamp_private.owner_mfa_readback278 m on m.id=a.mfa_readback_id "+
   "join icamp_private.auth_sessions s on s.id=m.session_id "+
   "where w.id=$1 and s.assurance_level='aal2' and s.revoked_at is null "+
   "and s.expires_at>statement_timestamp() and "+
   "s.reauthenticated_at>statement_timestamp()-interval '15 minutes'",
   [v.ownerWitnessId])]);
 if(!signed.some(x=>x.id===v.providerClosureId)||peers.verifiedCount!==7||
  owner.rowCount!==1)throw Error("ORIGINAL_CERTIFICATE_GATES_NOT_MET");
 return withActor280(reviewerId,async client=>{
  const q=await client.query(
   "insert into icamp_private.isolated_restore_certificate280 "+
   "(provider_closure_id,owner_witness_id,certificate_evidence_sha256,certified_by) "+
   "values($1,$2,$3,$4) on conflict do nothing returning id",
   [v.providerClosureId,v.ownerWitnessId,v.evidenceDigest,reviewerId]);
  if(q.rowCount!==1)throw Error("INDEPENDENT_ISOLATED_CERTIFICATE_REJECTED");
  return {status:"ISOLATED_REVIEW_CERTIFICATE_STORED_NO_PRODUCTION_RESTORE"};
 });
}

export async function acceptanceSummary280(){
 const admission=await originalAdmission280();
 const empty={admission,status:admission.status,keyProposals:[],
  providerClosures:[],ownerCandidates:[],ownerWitnesses:[],
  certificates:[],sourceCount:0,closure:classifyCertificate280({
   admission,providerSigned:false,ownerWitness:false,sources:0,certificateStored:false})};
 if(!admission.adopted)return empty;
 try{
  const [keys,owners,witnesses,certs,peers,verified]=await Promise.all([
   originalPool270().query(
    "select p.id,p.provider_id,p.key_id,p.key_fingerprint_sha256,"+
    "k.id as review_id from icamp_private.external_provider_key_proposal280 p "+
    "left join icamp_private.external_provider_key_review280 k on k.proposal_id=p.id "+
    "order by p.proposed_at desc limit 40"),
   originalPool270().query(
    "select a.id,a.auditor_user_id,a.reviewed_at from "+
    "icamp_private.owner_recovery_access_audit279 a "+
    "join icamp_private.owner_mfa_readback278 m on m.id=a.mfa_readback_id "+
    "join icamp_private.auth_sessions s on s.id=m.session_id "+
    "where s.assurance_level='aal2' and s.revoked_at is null "+
    "and s.expires_at>statement_timestamp() "+
    "and s.reauthenticated_at>statement_timestamp()-interval '15 minutes' "+
    "order by a.reviewed_at desc limit 25"),
   originalPool270().query(
    "select w.id,w.witnessed_at from icamp_private.owner_recovery_witness280 w "+
    "join icamp_private.owner_recovery_access_audit279 a on a.id=w.owner_audit_id "+
    "join icamp_private.owner_mfa_readback278 m on m.id=a.mfa_readback_id "+
    "join icamp_private.auth_sessions s on s.id=m.session_id "+
    "where s.assurance_level='aal2' and s.revoked_at is null "+
    "and s.expires_at>statement_timestamp() and "+
    "s.reauthenticated_at>statement_timestamp()-interval '15 minutes' "+
    "order by w.witnessed_at desc limit 20"),
   originalPool270().query(
    "select id,provider_closure_id,owner_witness_id,created_at "+
    "from icamp_private.isolated_restore_certificate280 "+
    "order by created_at desc limit 20"),
   sourceCorrelations279(),verifiedSignedClosures280(),
  ]);
  const ownerPresent=witnesses.rowCount>0;
  const providerPresent=verified.length>0;
  const status=classifyCertificate280({admission,providerSigned:providerPresent,
   ownerWitness:ownerPresent,sources:peers.verifiedCount,
   certificateStored:certs.rowCount>0});
  return {admission,status:status.status,keyProposals:keys.rows.map(x=>({
   id:x.id,providerId:x.provider_id,keyId:x.key_id,fingerprint:x.key_fingerprint_sha256,
   reviewed:Boolean(x.review_id),reviewId:x.review_id})),
   providerClosures:verified,ownerCandidates:owners.rows.map(x=>({id:x.id})),
   ownerWitnesses:witnesses.rows.map(x=>({id:x.id})),
   certificates:certs.rows.map(x=>({id:x.id,
    providerClosureId:x.provider_closure_id,ownerWitnessId:x.owner_witness_id})),
   sourceCount:peers.verifiedCount,closure:status};
 }catch{return {...empty,status:"HOLD_ORIGINAL_PROVIDER_CLOSURE_READBACK"};}
}
