import {createHash,createHmac,timingSafeEqual} from "node:crypto";

const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/iu;
const NONCE=/^[A-Za-z0-9_-]{16,96}$/u;
const SOURCE=/^[a-z0-9_-]{8,64}$/u;
export const SHA271=/^[a-f0-9]{64}$/u;
export const STAGES271=Object.freeze(["contact_verified","credential_present",
 "mfa_verified","platform_binding_verified"]);
export const REPLAY_KINDS271=Object.freeze(["tenant_isolation","reservation_integrity",
 "payment_ledger","service_health"]);
export const SOURCE_KINDS271=Object.freeze(["traffic","comms","payments"]);
export const SNAPSHOTS271=Object.freeze(["original","isolated","production_readback"]);
export function normalizeSourceProof271(raw,now=Date.now()){
 const expected=["campgroundId","sourceKind","sourceId","nonce","observedAt","challenge"];
 if(!raw||typeof raw!=="object"||Array.isArray(raw)||
  Object.keys(raw).sort().join("|")!==expected.sort().join("|"))
  throw Error("Original source proof has unexpected identity fields");
 if(!UUID.test(raw.campgroundId)||!SOURCE_KINDS271.includes(raw.sourceKind)||
  !SOURCE.test(raw.sourceId)||!NONCE.test(raw.nonce)||
  typeof raw.challenge!=="string"||!NONCE.test(raw.challenge))
  throw Error("Invalid source identity or one-use proof fields");
 const time=Date.parse(raw.observedAt);
 if(typeof raw.observedAt!=="string"||!Number.isFinite(time)||
  time<now-60000||time>now+60000)
  throw Error("Original source proof outside freshness window");
 return {...raw,observedAt:new Date(time).toISOString(),
  challengeDigest:createHash("sha256").update(raw.challenge).digest("hex")};
}
export function verifyOriginalHmac271(body,signature,key){
 if(typeof body!=="string"||body.length>2048||
  typeof key!=="string"||key.length<32||
  typeof signature!=="string"||!SHA271.test(signature)) return false;
 const expected=createHmac("sha256",key).update(body).digest();
 return timingSafeEqual(expected,Buffer.from(signature,"hex"));
}
export function sourceEvidence271({campgroundState,enrollmentState,lastSampleAt,
 lastProofAt,sourceKind},now=Date.now()){
 if(campgroundState!=="active")return "SEASONAL_OR_INACTIVE_HOLD";
 if(sourceKind==="traffic"&&enrollmentState!=="active")return "CONSENT_NOT_ACTIVE";
 if(!lastProofAt)return "NO_SIGNED_ORIGINAL_PROOF";
 const p=Date.parse(lastProofAt);
 if(!Number.isFinite(p)||p>now+60000||now-p>15*60000)
  return "STALE_ORIGINAL_PROOF";
 if(sourceKind==="traffic"){
  const s=Date.parse(lastSampleAt??"");
  if(!Number.isFinite(s)||s>now+60000||now-s>15*60000)
   return "PROOF_PRESENT_NO_FRESH_TRAFFIC";
 }
 return "FRESH_SIGNED_SOURCE_PROOF_EXTERNAL_PROVIDER_CONFIRMATION_REQUIRED";
}
export function closureEvidence271(value){
 const x=value??{};
 if(x.sourcePinned!==true)return "HOLD_ORIGINAL_HOST_NOT_PINNED";
 if(x.providerMatched!==true)return "HOLD_PROVIDER_NOT_RECONCILED";
 if(x.siteWitness!==true)return "HOLD_SITE_ALLOCATION";
 if(x.confirmationWitness!==true)return "HOLD_GUEST_CONFIRMATION_DELIVERY";
 if(x.guestAck!==true)return "HOLD_GUEST_OUTCOME";
 if(x.independentTenantReviewer!==true)return "HOLD_INDEPENDENT_TENANT_REVIEW";
 return "ELIGIBLE_TO_REQUEST_CERTIFICATION_NOT_AUTOMATICALLY_CLOSED";
}
export function replayEvidence271(rows){
 const groups=new Map();
 for(const r of rows??[]){
  if(!SHA271.test(r.backupDigest??"")||
    !SHA271.test(r.fingerprint??"")||
    !REPLAY_KINDS271.includes(r.kind)||!SNAPSHOTS271.includes(r.snapshot))continue;
  const key=r.backupDigest+":"+r.kind;
  if(!groups.has(key))groups.set(key,[]);
  groups.get(key).push(r);
 }
 const byBackup=new Map();
 for(const [compound,items] of groups.entries()){
  const backup=compound.slice(0,64);
  const original=items.filter(r=>r.snapshot==="original");
  const isolated=items.filter(r=>r.snapshot==="isolated");
  const production=items.filter(r=>r.snapshot==="production_readback");
  const matching=original.some(a=>isolated.some(b=>
    b.fingerprint===a.fingerprint&&b.actorId!==a.actorId&&
    production.some(c=>c.fingerprint===a.fingerprint&&c.actorId!==b.actorId)));
  if(matching)byBackup.set(backup,(byBackup.get(backup)??0)+1);
 }
 return [...byBackup.values()].some(n=>n===4)
  ?"REPLAY_DIGEST_CHAIN_COMPLETE_EXTERNAL_RESTORE_UNVERIFIED"
  :"HOLD_ORIGINAL_ISOLATED_PRODUCTION_REPLAY";
}
