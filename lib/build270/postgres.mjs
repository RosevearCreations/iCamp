import pg from "pg";
import { createHash } from "node:crypto";
import { safePinnedHttps270,compareProviderSettlement270,
 ownerEnrollmentStatus270,restorationAcceptance270,REFERENCE270,
} from "./core.mjs";
import { inspectOriginalRuntime268 } from "../campground-support268/postgres.mjs";
import { hasCampgroundPermission } from "../authz/postgres.mjs";
const {Pool}=pg;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/iu;
let pool;
export function originalPool270(){
 const connectionString=process.env.DATABASE_URL?.trim();
 if(!connectionString)throw Error("ORIGINAL_DATABASE_UNAVAILABLE");
 if(!pool)pool=new Pool({connectionString,max:3,connectionTimeoutMillis:3500,idleTimeoutMillis:10000});
 return pool;
}
export async function sourceReadiness270(){
 const base=await inspectOriginalRuntime268();
 const response={status:"HOLD_ORIGINAL_0245",database:base,
  adoption270:false,trafficPaired:Boolean(process.env.ICAMP_TELEMETRY269_HMAC_SECRET &&
   process.env.ICAMP_TELEMETRY269_PILOT_CAMPGROUND_ID &&
   process.env.ICAMP_TELEMETRY269_PILOT_SOURCE_ID),
  commsOutboundReady:false,providerReadOnlyReady:false};
 try{
  safePinnedHttps270(process.env.ICAMP_COMMS270_SLA_ENDPOINT??"",
   process.env.ICAMP_COMMS270_HOST_PIN??"");
  response.commsOutboundReady=(process.env.ICAMP_COMMS270_SIGNING_KEY?.length??0)>=32 &&
   /^[a-z0-9_-]{8,64}$/u.test(process.env.ICAMP_COMMS270_SOURCE_ID??"");
 }catch{}
 try{
  safePinnedHttps270(process.env.ICAMP_PAYMENTS270_READ_ENDPOINT??"",
   process.env.ICAMP_PAYMENTS270_HOST_PIN??"");
  response.providerReadOnlyReady=process.env.ICAMP_PAYMENTS270_READ_MODE==="test" &&
   (process.env.ICAMP_PAYMENTS270_READ_API_KEY?.length??0)>=32;
 }catch{}
 if(!base.runtimeTargetPinMatches||!base.migration0243)return response;
 try{
  const q=await originalPool270().query(
   "select to_regclass('icamp_private.support_delivery_attempts270') is not null as attempts,"+
   "to_regclass('icamp_private.provider_trace270') is not null as payments,"+
   "to_regclass('icamp_private.original_restore_evidence270') is not null as restore,"+
   "exists(select 1 from icamp_meta.schema_migrations where version='0244') as predecessor,"+
   "exists(select 1 from icamp_meta.schema_migrations where version='0245') as migration");
  response.adoption270=Object.values(q.rows[0]??{}).every(x=>x===true);
  response.status=response.adoption270?"ORIGINAL_0245_SCHEMA_PRESENT_EXTERNAL_WITNESS_HOLD":"HOLD_MIGRATION_0245";
 }catch{response.status="HOLD_ORIGINAL_DATABASE_QUERY";}
 return response;
}
export async function inspectOwnerEnrollment270(){
 const original=await sourceReadiness270();
 const result={status:"HOLD_UNVERIFIED_ORIGINAL_DATABASE",identifiedOriginalHost:
   original.database.runtimeTargetPinMatches&&original.adoption270,
   accountFound:false,accountActive:false,credentialPresent:false,
   recoveryEmailVerified:false,platformGrantActive:false,mfaVerified:false,
   independentOwnerBinding:false,canResetWithEmail:false};
 if(!result.identifiedOriginalHost)return result;
 try{
  const r=await originalPool270().query(
   "select a.account_state,a.email_normalized,a.email_verified_at,"+
   "exists(select 1 from icamp_private.password_credentials c where c.user_id=a.id) as credential,"+
   "exists(select 1 from icamp_private.platform_operator_grants g where g.user_id=a.id"+
   " and g.grant_state='active') as grant_active,"+
   "exists(select 1 from icamp_private.mfa_factors f where f.user_id=a.id"+
   " and f.factor_state='verified') as mfa,"+
   "exists(select 1 from icamp_private.platform_master_owner_bindings b where b.user_id=a.id"+
   " and b.binding_state='verified' and b.verified_by is not null and b.verified_by<>b.user_id) as independent "+
   "from icamp_private.user_accounts a where a.username_normalized=$1 limit 2",
   ["rosevear"]);
  if(r.rowCount!==1)return {...result,status:"HOLD_NO_UNIQUE_ORIGINAL_IDENTITY"};
  const a=r.rows[0];
  result.accountFound=true;result.accountActive=a.account_state==="active";
  result.credentialPresent=a.credential;
  result.recoveryEmailVerified=Boolean(a.email_verified_at)&&
    typeof a.email_normalized==="string"&&!a.email_normalized.endsWith(".invalid");
  result.platformGrantActive=a.grant_active;result.mfaVerified=a.mfa;
  result.independentOwnerBinding=a.independent;
  result.canResetWithEmail=result.accountActive&&result.recoveryEmailVerified;
  result.status=ownerEnrollmentStatus270(result);
  return result;
 }catch{return {...result,status:"HOLD_ORIGINAL_OWNER_AUTH_QUERY"};}
}
export async function compareOriginalPayment270({userId,campgroundId,recoveryId,paymentId}){
 if(![userId,campgroundId,recoveryId,paymentId].every(x=>UUID.test(x))||
  !(await hasCampgroundPermission(userId,campgroundId,"campground.operations.manage")))
   throw Error("ACTIVE_TENANT_MANAGER_REQUIRED");
 const readiness=await sourceReadiness270();
 if(!readiness.adoption270||!readiness.providerReadOnlyReady)
  return {status:"HOLD_PROVIDER_OR_DB_SOURCE",matched:false};
 const local=await originalPool270().query(
  "select p.provider_payment_reference,p.amount_cents,p.currency_code,p.payment_state "+
  "from icamp_private.booking_recovery268 r "+
  "join public.reservation_payments p on p.reservation_id=r.reservation_id "+
  "and p.campground_id=r.campground_id and p.organization_id=r.organization_id "+
  "where r.id=$1 and r.campground_id=$2 and p.id=$3 limit 2",
  [recoveryId,campgroundId,paymentId]);
 if(local.rowCount!==1||!REFERENCE270.test(local.rows[0].provider_payment_reference??""))
  return {status:"HOLD_UNMATCHED_ORIGINAL_PAYMENT",matched:false};
 const p=local.rows[0];
 const endpoint=safePinnedHttps270(process.env.ICAMP_PAYMENTS270_READ_ENDPOINT,
  process.env.ICAMP_PAYMENTS270_HOST_PIN);
 const url=new URL(endpoint.toString().replace(/\/$/u,"")+"/payments/"+
  encodeURIComponent(p.provider_payment_reference));
 let check={status:"HOLD_PROVIDER_MISMATCH",matched:false};
 let responseDigest="0".repeat(64);
 try{
  const response=await fetch(url,{method:"GET",redirect:"error",
   signal:AbortSignal.timeout(4000),
   headers:{authorization:"Bearer "+process.env.ICAMP_PAYMENTS270_READ_API_KEY,
    accept:"application/json"}});
  if(!response.ok)throw Error("READ_PROVIDER_NOT_AVAILABLE");
  const txt=await response.text();if(txt.length>8192)throw Error("OVERSIZE_PROVIDER_RESPONSE");
  const original=JSON.parse(txt);
  responseDigest=createHash("sha256").update(txt).digest("hex");
  check=compareProviderSettlement270({
   providerPaymentReference:p.provider_payment_reference,
   amountCents:p.amount_cents,currency:p.currency_code,paymentState:p.payment_state,
  },original);
 }catch{return {status:"HOLD_PROVIDER_UNAVAILABLE",matched:false};}
 const client=await originalPool270().connect();
 try{
  await client.query("begin");
  await client.query("select set_config('icamp.user_id',$1,true)",[userId]);
  await client.query(
   "insert into icamp_private.provider_trace270 "+
   "(recovery_id,campground_id,actor_user_id,payment_id,result,provider_response_sha256) "+
   "values($1,$2,$3,$4,$5,$6) on conflict do nothing",
   [recoveryId,campgroundId,userId,paymentId,
    check.matched?"provider_match":"provider_mismatch",responseDigest]);
  await client.query("commit");
 }catch(e){await client.query("rollback").catch(()=>{});
  return {status:"HOLD_PRIVATE_EVIDENCE_NOT_SAVED",matched:false};}
 finally{client.release();}
 return check;
}
export async function originalRestoreCertification270(){
 const ready=await sourceReadiness270();
 if(!ready.adoption270)return {status:"HOLD_ORIGINAL_0245",externalHostRestorationVerified:false};
 try{
  const r=await originalPool270().query(
   "select w.original_backup_digest_sha256 as digest,"+
   " count(distinct w.actor_user_id) filter(where w.witness_kind in ('isolated_restore','independent_review')) as reviewers,"+
   " count(distinct e.validation_kind) as validations "+
   "from icamp_private.pilot_restore_witness269 w "+
   "left join icamp_private.original_restore_evidence270 e "+
   "on e.backup_digest_sha256=w.original_backup_digest_sha256 "+
   "group by w.original_backup_digest_sha256 "+
   "having count(*) filter(where w.witness_kind='original_backup')>0 "+
   "and count(*) filter(where w.witness_kind='isolated_restore')>0 "+
   "and count(*) filter(where w.witness_kind='independent_review')>0");
  const has=r.rows.some(x=>Number(x.reviewers)>=2&&Number(x.validations)>=4);
  return {status:restorationAcceptance270({
   originalHostPinned:ready.database.runtimeTargetPinMatches,
   migrationsPresent:ready.adoption270,originalBackupVerified:has,
   isolatedRestoreVerified:has,independentWitness:has,
   tenantIsolationPassed:has,liveReadbackPassed:has,
  }),originalEvidenceChains:r.rowCount,externalHostRestorationVerified:false};
 }catch{return {status:"HOLD_ORIGINAL_RESTORE_QUERY",externalHostRestorationVerified:false};}
}
