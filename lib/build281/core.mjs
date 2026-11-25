import {createPublicKey,verify} from "node:crypto";
import {UUID276,SHA276} from "../build276/core.mjs";
import {validateProviderKey280,digest280} from "../build280/core.mjs";

export const EXTERNAL_FINAL_ACK_KIND281="icamp-external-restore-final-ack-v1";
const providerId=/^[a-z0-9_-]{8,64}$/u;
const keyId=/^[a-z0-9_-]{8,80}$/u;
const eventId=/^[A-Za-z0-9_-]{16,160}$/u;
const nonce=/^[A-Za-z0-9_-]{16,96}$/u;
const sig=/^[A-Za-z0-9_-]{86}$/u;
const keys=Object.freeze([
 "certificateId","isolatedHostSha256","keyId","kind","nonce",
 "observedAt","originalClosureDigest","originalClosureId","providerEventId",
 "providerId","sourceHostSha256",
].sort());
export function validateCustodyReview281(input){
 if(!UUID276.test(input?.providerClosureId??"")||!SHA276.test(input?.evidenceDigest??""))
  throw Error("INVALID_ORIGINAL_PROVIDER_CUSTODY_REVIEW");
 return input;
}
export function validateMfaContinuity281(input){
 if(!UUID276.test(input?.originalWitnessId??"")||
   !UUID276.test(input?.sessionId??"")||!SHA276.test(input?.evidenceDigest??""))
  throw Error("INVALID_ORIGINAL_ROSEVEAR_MFA_CONTINUITY");
 return input;
}
export function validateFinalAck281(input){
 if(!UUID276.test(input?.certificateId??"")||
    !UUID276.test(input?.custodyReviewId??"")||
    !UUID276.test(input?.ownerContinuityId??"")||
    typeof input?.body!=="string"||input.body.length>3200||
    typeof input?.signature!=="string"||!sig.test(input.signature))
  throw Error("INVALID_ORIGINAL_EXTERNAL_PROVIDER_ACK");
 return input;
}
export function validateMonitorSample281(input){
 if(!UUID276.test(input?.ackId??"")||!SHA276.test(input?.evidenceDigest??""))
  throw Error("INVALID_EXTERNAL_RESTORE_MONITOR_SAMPLE");
 return input;
}
export function verifyExternalProviderAck281({body,signature,providerKey,original,now=Date.now()}){
 if(typeof body!=="string"||body.length<120||body.length>3200||
   typeof signature!=="string"||!sig.test(signature))
  throw Error("MALFORMED_ORIGINAL_EXTERNAL_ACK");
 let receipt;
 try{receipt=JSON.parse(body);}catch{throw Error("INVALID_ORIGINAL_EXTERNAL_ACK_JSON");}
 if(!receipt||typeof receipt!=="object"||Array.isArray(receipt)||
   Object.keys(receipt).sort().join("|")!==keys.join("|")||
   receipt.kind!==EXTERNAL_FINAL_ACK_KIND281||
   !providerId.test(receipt.providerId??"")||!keyId.test(receipt.keyId??"")||
   !eventId.test(receipt.providerEventId??"")||!nonce.test(receipt.nonce??"")||
   !UUID276.test(receipt.originalClosureId??"")||
   !UUID276.test(receipt.certificateId??"")||
   ![receipt.originalClosureDigest,receipt.sourceHostSha256,
     receipt.isolatedHostSha256].every(x=>SHA276.test(x??""))||
   receipt.sourceHostSha256===receipt.isolatedHostSha256)
  throw Error("UNVERIFIED_ORIGINAL_EXTERNAL_ACK_FIELDS");
 const observed=Date.parse(receipt.observedAt??"");
 if(!Number.isFinite(observed)||observed<now-300000||observed>now+30000)
  throw Error("STALE_OR_FUTURE_EXTERNAL_PROVIDER_ACK");
 if(receipt.providerId!==providerKey?.providerId||
   receipt.keyId!==providerKey?.keyId||
   receipt.providerId!==original?.providerId||
   receipt.originalClosureId!==original?.originalClosureId||
   receipt.certificateId!==original?.certificateId||
   receipt.originalClosureDigest!==original?.originalClosureDigest||
   receipt.sourceHostSha256!==original?.sourceHostSha256||
   receipt.isolatedHostSha256!==original?.isolatedHostSha256)
  throw Error("EXTERNAL_ACK_ORIGINAL_CUSTODY_OR_HOST_MISMATCH");
 const normalized=validateProviderKey280(providerKey);
 let ok=false;
 try{
  const key=createPublicKey(normalized.publicKeyPem);
  ok=key.asymmetricKeyType==="ed25519"&&
   Buffer.from(signature,"base64url").length===64&&
   verify(null,Buffer.from(body,"utf8"),key,Buffer.from(signature,"base64url"));
 }catch{}
 if(!ok)throw Error("EXTERNAL_PROVIDER_ACK_SIGNATURE_INVALID");
 return {...receipt,digest:digest280(body)};
}
export function classifyLiveMonitor281({admission,providerCustody,ownerContinuity,
 providerAck,sourceCount,certificatePresent,sampledAt,now=Date.now()}){
 const fresh=Number.isFinite(Date.parse(sampledAt??""))&&
  Date.parse(sampledAt)<=now+30000&&now-Date.parse(sampledAt)<=300000;
 const live=Boolean(admission?.adopted===true&&admission?.host?.pinned===true&&
  providerCustody===true&&ownerContinuity===true&&providerAck===true&&
  sourceCount===7&&certificatePresent===true&&fresh);
 return {status:live?"ORIGINAL_SIGNED_EXTERNAL_ACK_AND_MFA_CURRENT_RECHECK_REQUIRED":
  "HOLD_ORIGINAL_PROVIDER_OR_MFA_OR_RESTORE_MONITORING",
  signedProviderCurrent:providerAck===true,ownerMfaCurrent:ownerContinuity===true,
  sourcesCurrent:sourceCount===7,certificateEvidencePresent:certificatePresent===true,
  independentReviewLive:live,externalProviderFinalAcknowledgmentVerified:live,
  productionRestored:false};
}
