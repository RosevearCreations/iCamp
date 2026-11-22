import assert from "node:assert/strict";
import test from "node:test";
import {createHmac} from "node:crypto";
import {readFileSync} from "node:fs";
import {normalizeSourceProof271,verifyOriginalHmac271,sourceEvidence271,
 closureEvidence271,replayEvidence271} from "../lib/build271/core.mjs";
const id="11111111-1111-4111-8111-111111111111";
const now=Date.parse("2026-11-21T19:15:00Z");
test("Original source proof rejects guest PII, stale and ambiguous IDs",()=>{
 const p={campgroundId:id,sourceKind:"traffic",sourceId:"rosevear_web1",
 nonce:"nonce_1234567890123456",observedAt:"2026-11-21T19:14:40Z",
 challenge:"chall_1234567890123456"};
 assert.equal(normalizeSourceProof271(p,now).sourceKind,"traffic");
 for(const bad of [{...p,email:"guest@test.invalid"},{...p,sourceId:"a"},
 {...p,sourceKind:"users"},{...p,observedAt:"2026-11-21T19:03:40Z"}])
  assert.throws(()=>normalizeSourceProof271(bad,now));
 const key="synthetic-test-key-that-is-not-enrolled-0123456";
 const body=JSON.stringify(p),sig=createHmac("sha256",key).update(body).digest("hex");
 assert.equal(verifyOriginalHmac271(body,sig,key),true);
 assert.equal(verifyOriginalHmac271(body+" ",sig,key),false);
});
test("Consent, tenant lifecycle, sample freshness remain independent",()=>{
 const input={campgroundState:"active",enrollmentState:"active",
 sourceKind:"traffic",lastProofAt:"2026-11-21T19:14:40Z",lastSampleAt:null};
 assert.equal(sourceEvidence271(input,now),"PROOF_PRESENT_NO_FRESH_TRAFFIC");
 assert.equal(sourceEvidence271({...input,enrollmentState:"revoked"},now),"CONSENT_NOT_ACTIVE");
 assert.equal(sourceEvidence271({...input,campgroundState:"inactive"},now),"SEASONAL_OR_INACTIVE_HOLD");
 assert.match(sourceEvidence271({...input,lastSampleAt:input.lastProofAt},now),
 /^FRESH_SIGNED_SOURCE_PROOF/);
});
test("Paid but no confirmation cannot certify without every original proof",()=>{
 const basis={sourcePinned:true,providerMatched:true,siteWitness:true,
 confirmationWitness:true,guestAck:true,independentTenantReviewer:true};
 assert.match(closureEvidence271({...basis,providerMatched:false}),/^HOLD/);
 assert.match(closureEvidence271({...basis,guestAck:false}),/^HOLD/);
 assert.match(closureEvidence271({...basis,independentTenantReviewer:false}),/^HOLD/);
 assert.match(closureEvidence271(basis),/^ELIGIBLE/);
});
test("Independent restored-source replay needs all four canonical digests",()=>{
 const a="a".repeat(64),fp="f".repeat(64);
 const kinds=["tenant_isolation","reservation_integrity","payment_ledger","service_health"];
 const rows=kinds.flatMap(kind=>[
  {backupDigest:a,kind,snapshot:"original",fingerprint:fp,actorId:"A"},
  {backupDigest:a,kind,snapshot:"isolated",fingerprint:fp,actorId:"B"},
  {backupDigest:a,kind,snapshot:"production_readback",fingerprint:fp,actorId:"A"},
 ]);
 assert.match(replayEvidence271(rows),/^REPLAY/);
 assert.match(replayEvidence271(rows.slice(0,9)),/^HOLD/);
 assert.match(replayEvidence271(rows.map(x=>({...x,actorId:"A"}))),/^HOLD/);
});
test("Build 271 schema fail-closes legacy closure and holds privileged enrollment",()=>{
 const s=readFileSync("database/migrations/0246_build271_owner_source_closure_replay.sql","utf8");
 for(const marker of ["owner_ceremony271","source_pair_proofs271",
 "certified_booking_closure271","restore_replay271","require_certified_closure271",
 "verified_by<>b.user_id","force row level security","guest_ack"])assert.ok(s.includes(marker),marker);
});
