import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const SHA256270=/^[a-f0-9]{64}$/u;
export const REFERENCE270=/^[a-zA-Z0-9._:/-]{12,180}$/u;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/iu;
export function safePinnedHttps270(endpoint,hostPin){
 if(typeof endpoint!=="string"||typeof hostPin!=="string"||
   !/^[a-z0-9.-]{5,180}$/u.test(hostPin)||
   endpoint.length>400) throw Error("Original HTTPS target and independent host pin required");
 const url=new URL(endpoint);
 if(url.protocol!=="https:"||url.hostname!==hostPin||url.username||url.password||
   url.search||url.hash||url.port||url.hostname.endsWith(".localhost")||
   /^d+.d+.d+.d+$/u.test(url.hostname))
   throw Error("Unpinned remote endpoint rejected");
 return url;
}
export function buildSlaEnvelope270(input,now=new Date()){
 if(!UUID.test(input?.caseId)||!UUID.test(input?.assignedUserId)||
  !UUID.test(input?.outboxId)||
  !["critical","priority","routine"].includes(input?.severity)||
  !REFERENCE270.test(input?.idempotencyKey)||
  Number.isNaN(now.getTime())) throw Error("Original bounded SLA case references required");
 return {schema:"icamp.sla.delivery.v1",caseId:input.caseId,
  recipientUserId:input.assignedUserId,outboxId:input.outboxId,
  severity:input.severity,idempotencyKey:input.idempotencyKey,
  issuedAt:now.toISOString(),expiresAt:new Date(now.getTime()+60000).toISOString(),
  guestDataIncluded:false};
}
export function signSlaEnvelope270(payload,key){
 if(typeof key!=="string"||key.length<32)throw Error("Real provider enrollment secret required");
 return createHmac("sha256",key).update(JSON.stringify(payload)).digest("hex");
}
export function verifySlaEnvelope270(payload,signature,key){
 if(!/^[a-f0-9]{64}$/u.test(signature??"")||typeof key!=="string"||
   key.length<32)return false;
 const expected=createHmac("sha256",key).update(JSON.stringify(payload)).digest();
 return timingSafeEqual(expected,Buffer.from(signature,"hex"));
}
export function compareProviderSettlement270(local,remote){
 if(!local || !remote || typeof remote!=="object" ||
   local.providerPaymentReference!==remote.reference||
   !["captured","settled"].includes(remote.status)||
   !Number.isSafeInteger(remote.amountCents)||
   !/^[A-Z]{3}$/u.test(remote.currency??"")||
   !Number.isSafeInteger(local.amountCents)||
   remote.amountCents!==local.amountCents||
   remote.currency!==local.currency||
   local.paymentState!=="captured")
   return {status:"HOLD_PROVIDER_MISMATCH",matched:false};
 return {status:"PROVIDER_REPORTED_CAPTURE_MATCH_NEEDS_SETTLEMENT_WITNESS",
  matched:true};
}
export function ownerEnrollmentStatus270(input){
 const x=input??{};
 if(x.identifiedOriginalHost!==true)return "HOLD_UNVERIFIED_ORIGINAL_DATABASE";
 if(x.accountFound!==true)return "HOLD_NO_UNIQUE_ORIGINAL_IDENTITY";
 if(x.accountActive!==true)return "HOLD_ACCOUNT_DISABLED";
 if(x.credentialPresent!==true)return "HOLD_NO_PASSWORD_CREDENTIAL";
 if(x.recoveryEmailVerified!==true)return "HOLD_NO_VERIFIED_RECOVERY_EMAIL";
 if(x.platformGrantActive!==true)return "HOLD_PENDING_PLATFORM_GRANT";
 if(x.mfaVerified!==true)return "HOLD_NO_VERIFIED_MFA";
 if(x.independentOwnerBinding!==true)return "HOLD_NO_INDEPENDENT_OWNER_BINDING";
 return "ELIGIBLE_FOR_INDEPENDENT_OWNER_SIGNIN_CHECK";
}
export function restorationAcceptance270(input){
 const x=input??{};
 return x.originalHostPinned===true&&x.migrationsPresent===true&&
 x.originalBackupVerified===true&&x.isolatedRestoreVerified===true&&
 x.independentWitness===true&&x.tenantIsolationPassed===true&&
 x.liveReadbackPassed===true
 ? "ORIGINAL_RESTORE_EVIDENCE_COMPLETE_REQUIRES_EXTERNAL_OPERATIONAL_CHECK"
 : "HOLD_INDEPENDENT_RESTORATION";
}
export function digestEvidence270(value){
 if(typeof value!=="string"||!value||value.length>16384)
  throw Error("Valid nonsecret evidence input required");
 return createHash("sha256").update(value).digest("hex");
}
