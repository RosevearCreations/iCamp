import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign, createHash } from "node:crypto";
import {
 validateCorrelation279,validateRecoveryAudit279,validateRestoreFinalization279,
 verifyOriginalCorrelation279,summarizeCorrelation279,summarizeRecoveryAudit279,
 summarizeIsolatedFinalization279,classifyClosure279,
} from "../lib/build279/core.mjs";
const {publicKey,privateKey}=generateKeyPairSync("ed25519");
const pem=publicKey.export({type:"spki",format:"pem"});
const pins={icamp:{keyId:"original_icamp_peer279",commitSha:"f".repeat(40),publicKeyPem:pem}};
const now=Date.parse("2026-11-24T18:00:00Z");
const observed=new Date(now-40000).toISOString();
const signed=(challengeId,nonce)=>JSON.stringify({
 source:"icamp",keyId:pins.icamp.keyId,commitSha:pins.icamp.commitSha,
 challengeId,nonce,observedAt:observed,
});
const fieldBody=signed("actual_issued_challenge279","field_response_nonce279");
const providerBody=signed("separate_provider_challenge279","provider_receipt_nonce279");
const digest=s=>createHash("sha256").update(s).digest("hex");
const signature=s=>sign(null,Buffer.from(s),privateKey).toString("base64url");
const row={
 source_id:"icamp",key_id:pins.icamp.keyId,commit_sha:pins.icamp.commitSha,
 challenge_id:"actual_issued_challenge279",request_nonce:"original_request_nonce279",
 issued_at:new Date(now-80000).toISOString(),
 expires_at:new Date(now+10000).toISOString(),
 field_accepted_at:new Date(now-30000).toISOString(),
 field_reviewed_at:new Date(now-25000).toISOString(),
 correlated_at:new Date(now-20000).toISOString(),
 field_body:fieldBody,field_signature:signature(fieldBody),field_sha256:digest(fieldBody),
 provider_body:providerBody,provider_signature:signature(providerBody),
 provider_sha256:digest(providerBody),
 provider_received_at:new Date(now-20000).toISOString(),
 field_review_id:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
 signed_receipt_id:"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
};
test("independent source correlation requires two original valid signatures and distinct nonces",()=>{
 assert.equal(verifyOriginalCorrelation279(row,pins,now).source,"icamp");
 assert.equal(summarizeCorrelation279([row],pins,now).verifiedCount,1);
 assert.equal(summarizeCorrelation279([row],pins,now).sources.length,7);
 assert.equal(summarizeCorrelation279([row],pins,now).status,"HOLD_SEVEN_ORIGINAL_CORRELATED_PROVIDER_RECEIPTS");
 assert.throws(()=>verifyOriginalCorrelation279({...row,provider_sha256:"0".repeat(64)},pins,now));
 assert.throws(()=>verifyOriginalCorrelation279({...row,provider_signature:row.field_signature},pins,now));
 assert.throws(()=>verifyOriginalCorrelation279({...row,field_accepted_at:new Date(now-500000).toISOString()},pins,now));
 assert.throws(()=>verifyOriginalCorrelation279(row,{},now));
});
test("external form validation does not invent evidence",()=>{
 const a="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",b="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",h="a".repeat(64);
 assert.equal(validateCorrelation279({fieldReviewId:a,providerReceiptId:b,evidenceDigest:h}).fieldReviewId,a);
 assert.throws(()=>validateCorrelation279({fieldReviewId:"none",providerReceiptId:b,evidenceDigest:h}));
 assert.throws(()=>validateRecoveryAudit279({mfaReadbackId:a,evidenceDigest:"short"}));
 assert.throws(()=>validateRestoreFinalization279({serviceReadbackId:a,backupDigest:h,tenantDigest:h,
  reservationDigest:h,paymentDigest:h,healthDigest:"bad",comparisonDigest:h}));
});
test("original access audit only survives in same current witnessed Rosevear session",()=>{
 const o={status:"ORIGINAL_OWNER_MFA_COMPLETION_WITNESSED_CURRENT_SESSION"};
 const s={user:{username:"Rosevear",id:"owner"},sessionId:"session",assuranceLevel:"aal2"};
 assert.equal(summarizeRecoveryAudit279(o,s,{ownerId:"owner",sessionId:"session"}).status,
  "ORIGINAL_RECOVERY_ACCESS_AUDIT_RECORDED_CURRENT_MFA_SESSION");
 assert.equal(summarizeRecoveryAudit279(o,{...s,assuranceLevel:"aal1"},{ownerId:"owner",sessionId:"session"}).status,
  "HOLD_ORIGINAL_RECOVERY_ACCESS_AUDIT");
 assert.equal(summarizeRecoveryAudit279(o,s,{ownerId:"owner",sessionId:"old"}).status,
  "HOLD_ORIGINAL_RECOVERY_ACCESS_AUDIT");
});
test("four-scope evidence may be recorded but never claims production restore/provider certification",()=>{
 const r=summarizeIsolatedFinalization279([{finalized:true}]);
 const x=classifyClosure279({admission:{adopted:true,host:{pinned:true}},
  peers:{verifiedCount:7},
  owner:{status:"ORIGINAL_RECOVERY_ACCESS_AUDIT_RECORDED_CURRENT_MFA_SESSION"},
  restore:r});
 assert.equal(x.providerCertified,false);assert.equal(x.productionRestored,false);
 assert.equal(classifyClosure279({admission:{adopted:false,host:{pinned:true}},
  peers:{verifiedCount:7},owner:{status:"ORIGINAL_RECOVERY_ACCESS_AUDIT_RECORDED_CURRENT_MFA_SESSION"},
  restore:r}).status,"HOLD_ORIGINAL_PROVIDER_RECOVERY_FINAL_ACCEPTANCE");
});
