import {originalPool270} from "../build270/postgres.mjs";
import {originalAdmission272} from "../build272/postgres.mjs";
import {getPlatformOverview} from "../platform/postgres.mjs";
import {parseOriginalConsumer273,parseOriginalRestore273,
 verifySignedBody273,UUID273,SHA273} from "./protocol.mjs";
export async function originalAdmission273(){
 const previous=await originalAdmission272();
 const x={status:"HOLD_ORIGINAL_0248_OR_PIN",adopted:false,hostPinned:previous.hostPinned};
 if(!previous.adopted||!previous.hostPinned)return x;
 try{
  const r=await originalPool270().query(
   "select to_regclass('icamp_private.source_enrollment_review273') is not null as enrollment,"+
   "to_regclass('icamp_private.consumer_ack273') is not null as consumer,"+
   "to_regclass('icamp_private.incident_ack_closure273') is not null as incident,"+
   "to_regclass('icamp_private.restore_provider_attestation273') is not null as restore,"+
   "exists(select 1 from icamp_meta.schema_migrations where version='0248') as migration");
  x.adopted=Object.values(r.rows[0]??{}).every(v=>v===true);
  x.status=x.adopted?"ORIGINAL_0248_SCHEMA_READY_SOURCE_SIGNERS_REQUIRED":
   "HOLD_MIGRATION_0248_NOT_ADOPTED";
 }catch{x.status="HOLD_ORIGINAL_0248_QUERY";}
 return x;
}
export async function sourceSummary273(){
 const source=await originalAdmission273();
 const result={status:source.status,hostPinned:source.hostPinned,
  adopted:source.adopted,enrolled:0,consumerAck:0,
  incidentClosed:0,providerRestore:0,
  commsSignerConfigured:Boolean((process.env.ICAMP_COMMS271_PROOF_HMAC_SECRET??"").length>=32),
  bookingSignerConfigured:Boolean((process.env.ICAMP_PAYMENTS271_PROOF_HMAC_SECRET??"").length>=32),
  restoreSignerConfigured:Boolean((process.env.ICAMP_RESTORE273_PROVIDER_HMAC_SECRET??"").length>=32)};
 if(!source.adopted)return result;
 try{
  const q=await originalPool270().query(
   "select (select count(*)::integer from icamp_private.source_enrollment_review273) as enrolled,"+
   "(select count(*)::integer from icamp_private.consumer_ack273) as consumer,"+
   "(select count(*)::integer from icamp_private.incident_ack_closure273) as incident,"+
   "(select count(*)::integer from icamp_private.restore_provider_attestation273) as restore");
  result.enrolled=q.rows[0]?.enrolled??0;
  result.consumerAck=q.rows[0]?.consumer??0;
  result.incidentClosed=q.rows[0]?.incident??0;
  result.providerRestore=q.rows[0]?.restore??0;
  result.status="ORIGINAL_SOURCE_EVIDENCE_COUNTS_NOT_EXTERNAL_CERTIFICATION";
 }catch{result.status="HOLD_ORIGINAL_SOURCE_COUNTERS";}
 return result;
}
async function withUser273(userId,callback){
 const client=await originalPool270().connect();
 try{
  await client.query("begin");
  await client.query("select set_config('icamp.user_id',$1,true)",[userId]);
  const x=await callback(client);
  await client.query("commit");return x;
 }catch(e){await client.query("rollback").catch(()=>{});throw e;}
 finally{client.release();}
}
async function requireOriginalOperator273(userId){
 if(!UUID273.test(userId)||(await getPlatformOverview(userId,"aal2"))===null)
  throw Error("Verified original owner MFA reviewer required");
 if(!(await originalAdmission273()).adopted)
  throw Error("Original 0248 production schema not verified");
}
export async function recordSourceEnrollment273({reviewerId,sourcePairId,evidenceDigest}){
 if(!UUID273.test(sourcePairId)||!SHA273.test(evidenceDigest))
  throw Error("Signed original pairing receipt and digest required");
 await requireOriginalOperator273(reviewerId);
 return withUser273(reviewerId,async(client)=>{
  const q=await client.query(
   "insert into icamp_private.source_enrollment_review273 "+
   "(source_pair_id,reviewer_user_id,approval_sha256) values($1,$2,$3) "+
   "on conflict do nothing returning id",[sourcePairId,reviewerId,evidenceDigest]);
  if(q.rowCount!==1)throw Error("Independent original pairing review absent or duplicate");
  return {recorded:true,sourceCredentialsChanged:false};
 });
}
export async function acceptOriginalConsumer273(body,signature){
 if(typeof body!=="string"||body.length>3500)throw Error("RECEIPT_TOO_LARGE");
 const value=parseOriginalConsumer273(body);
 const signer=value.kind==="booking"?
  process.env.ICAMP_PAYMENTS271_PROOF_HMAC_SECRET:
  process.env.ICAMP_COMMS271_PROOF_HMAC_SECRET;
 if(!verifySignedBody273(body,signature,signer))
  throw Error("ORIGINAL_CONSUMER_SIGNER_MISMATCH");
 if(!(await originalAdmission273()).adopted)
  throw Error("ORIGINAL_HOST_NOT_ADOPTED");
 const r=await originalPool270().query(
  "insert into icamp_private.consumer_ack273 "+
  "(campground_id,source_pair_id,event_kind,subject_id,source_id,provider_event_id,nonce,evidence_sha256,observed_at) "+
  "values($1,$2,$3,$4,$5,$6,$7,$8,$9) on conflict do nothing returning id",
  [value.campgroundId,value.sourcePairId,value.kind,value.subjectId,
   value.sourceId,value.providerEventId,value.nonce,value.evidenceSha256,value.observedAt]);
 if(r.rowCount!==1)throw Error("ORIGINAL_RECEIPT_REPLAY_OR_SCOPE_FAILURE");
 return {accepted:true,status:"SIGNED_CONSUMER_ACK_RECORDED_NOT_AUTOMATIC_INCIDENT_CLOSURE"};
}
export async function recordSignedIncidentClosure273({reviewerId,outboxId,consumerAckId,evidenceDigest}){
 if(!UUID273.test(outboxId)||!UUID273.test(consumerAckId)||
  !SHA273.test(evidenceDigest))throw Error("Original incident ACK evidence invalid");
 await requireOriginalOperator273(reviewerId);
 return withUser273(reviewerId,async(client)=>{
  const q=await client.query(
   "insert into icamp_private.incident_ack_closure273 "+
   "(outbox_id,consumer_ack_id,reviewer_user_id,external_case_digest_sha256) "+
   "values($1,$2,$3,$4) on conflict do nothing returning id",
   [outboxId,consumerAckId,reviewerId,evidenceDigest]);
  if(q.rowCount!==1)throw Error("Resolved original case or independently signed ACK missing");
  return {recorded:true,tenantCaseStateChanged:false};
 });
}
export async function acceptRestoreProvider273(body,signature){
 if(typeof body!=="string"||body.length>3500)throw Error("ATTESTATION_TOO_LARGE");
 const value=parseOriginalRestore273(body);
 if(!verifySignedBody273(body,signature,process.env.ICAMP_RESTORE273_PROVIDER_HMAC_SECRET))
  throw Error("UNENROLLED_ORIGINAL_RESTORE_ATTESTER");
 if(!(await originalAdmission273()).adopted)
  throw Error("ORIGINAL_DATABASE_NOT_INDEPENDENTLY_ADOPTED");
 if(value.providerId!==process.env.ICAMP_RESTORE273_PROVIDER_ID)
  throw Error("UNRECOGNIZED_RESTORE_PROVIDER_ID");
 const q=await originalPool270().query(
  "insert into icamp_private.restore_provider_attestation273 "+
  "(restore_review_id,provider_id,provider_event_id,nonce,attestation_sha256,"+
  "source_host_sha256,isolated_host_sha256,observed_at) "+
  "values($1,$2,$3,$4,$5,$6,$7,$8) on conflict do nothing returning id",
  [value.restoreReviewId,value.providerId,value.providerEventId,
   value.nonce,value.attestationSha256,value.sourceHostSha256,
   value.isolatedHostSha256,value.observedAt]);
 if(q.rowCount!==1)throw Error("RESTORE_PROVIDER_RECEIPT_REPLAY_OR_UNWITNESSED");
 return {accepted:true,status:"SIGNED_PROVIDER_ATTESTATION_STORED_INDEPENDENT_HOST_CHECK_STILL_REQUIRED"};
}
