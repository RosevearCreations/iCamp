import {safePinnedHttps270,buildSlaEnvelope270,signSlaEnvelope270,
 REFERENCE270} from "./core.mjs";
import {originalPool270,sourceReadiness270} from "./postgres.mjs";

// Each original notice has a unique durable outbound claim. An unknown network
// outcome stays uncertain and cannot be automatically sent twice.
export async function dispatchOneOriginalSla270(){
 const readiness=await sourceReadiness270();
 if(!readiness.adoption270||!readiness.commsOutboundReady)
  return {status:"HOLD_UNENROLLED_ORIGINAL_SOURCE",attempted:0,accepted:0};
 const sourceId=process.env.ICAMP_COMMS270_SOURCE_ID;
 const endpoint=safePinnedHttps270(process.env.ICAMP_COMMS270_SLA_ENDPOINT,
  process.env.ICAMP_COMMS270_HOST_PIN);
 const key=process.env.ICAMP_COMMS270_SIGNING_KEY;
 const client=await originalPool270().connect();
 let candidate;
 try{
  await client.query("begin");
  await client.query("set local statement_timeout='4000ms'");
  const x=await client.query(
   "select o.id,o.case_id,o.assigned_user_id,o.alert_tier from "+
   "icamp_private.support_sla_outbox268 o "+
   "join icamp_private.campground_support265 s on s.id=o.case_id "+
   "where o.delivery_state='queued' and s.status<>'resolved' "+
   "and not exists(select 1 from icamp_private.support_delivery_attempts270 a where a.outbox_id=o.id) "+
   "order by o.queued_at for update of o skip locked limit 1");
  if(x.rowCount!==1){
   await client.query("commit");
   return {status:"NO_UNSENT_ORIGINAL_SLA",attempted:0,accepted:0};
  }
  const c=x.rows[0];
  const idempotencyKey="icamp-original-sla:"+c.id;
  const insert=await client.query(
   "insert into icamp_private.support_delivery_attempts270 "+
   "(outbox_id,source_id,idempotency_reference) values($1,$2,$3) "+
   "returning id",[c.id,sourceId,idempotencyKey]);
  if(insert.rowCount!==1)throw Error("DURABLE_ATTEMPT_CLAIM_FAILED");
  const u=await client.query(
   "update icamp_private.support_sla_outbox268 "+
   "set delivery_state='attempted',attempted_at=statement_timestamp() "+
   "where id=$1 and delivery_state='queued' returning attempted_at",[c.id]);
  if(u.rowCount!==1)throw Error("ORIGINAL_NOTICE_RACE");
  candidate={...c,idempotencyKey,attemptId:insert.rows[0].id};
  await client.query("commit");
 }catch(e){
  await client.query("rollback").catch(()=>{});
  return {status:"HOLD_CLAIM_FAILED",attempted:0,accepted:0};
 }finally{client.release();}
 const payload=buildSlaEnvelope270({
  caseId:candidate.case_id,assignedUserId:candidate.assigned_user_id,
  outboxId:candidate.id,severity:candidate.alert_tier,
  idempotencyKey:candidate.idempotencyKey,
 });
 let accepted=false;
 let receipt=null;
 try{
  const response=await fetch(endpoint.toString(),{
   method:"POST",redirect:"error",signal:AbortSignal.timeout(5000),
   headers:{"content-type":"application/json",
    "x-icamp-source-id":sourceId,
    "x-icamp-hmac-sha256":signSlaEnvelope270(payload,key),
    "x-icamp-idempotency-key":candidate.idempotencyKey},
   body:JSON.stringify(payload),
  });
  if(response.ok&&Number(response.headers.get("content-length")??"0")<2048){
   const body=await response.text();
   if(body.length<2048){
    const data=JSON.parse(body);
    accepted=data?.accepted===true&&REFERENCE270.test(data?.receiptRef);
    receipt=accepted?data.receiptRef:null;
   }
  }
 }catch{}
 try{
  await originalPool270().query(
   "update icamp_private.support_delivery_attempts270 "+
   "set attempt_status=$1,completed_at=statement_timestamp(),"+
   "remote_receipt_reference=$2,row_version=row_version+1 "+
   "where id=$3 and attempt_status='prepared'",
   [accepted?"accepted":"uncertain",receipt,candidate.attemptId]);
 }catch{return {status:"HOLD_ATTEMPT_CUSTODY_UPDATE",attempted:1,accepted:0};}
 return {status:accepted?"PROVIDER_ACCEPTED_NOT_DELIVERED":"UNCERTAIN_NO_AUTOMATIC_RETRY",
  attempted:1,accepted:accepted?1:0};
}
