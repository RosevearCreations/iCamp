import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
 safePinnedHttps270,buildSlaEnvelope270,signSlaEnvelope270,
 verifySlaEnvelope270,compareProviderSettlement270,ownerEnrollmentStatus270,
 restorationAcceptance270,digestEvidence270,
} from "../lib/build270/core.mjs";
const id="11111111-1111-4111-8111-111111111111";
test("Comms endpoint must be separately pinned HTTPS, not private callback",()=>{
 assert.equal(safePinnedHttps270("https://comms.example.com/incident","comms.example.com").hostname,"comms.example.com");
 for(const endpoint of ["http://comms.example.com","https://attacker.example.com",
  "https://evil:pass@comms.example.com/path",
  "https://comms.example.com/?redirect=evil"])assert.throws(()=>
  safePinnedHttps270(endpoint,"comms.example.com"));
});
test("Single original SLA notice envelope is bounded and signed without guest data",()=>{
 const p=buildSlaEnvelope270({caseId:id,assignedUserId:id,outboxId:id,
  severity:"critical",idempotencyKey:"icamp-sla-notice-0001"},
  new Date("2026-11-21T17:00:00Z"));
 assert.equal(p.guestDataIncluded,false);
 assert.ok(!JSON.stringify(p).includes("@"));
 const key="private-only-unit-test-placeholder-not-real-secret";
 const sig=signSlaEnvelope270(p,key);
 assert.ok(verifySlaEnvelope270(p,sig,key));
 assert.equal(verifySlaEnvelope270({...p,severity:"routine"},sig,key),false);
});
test("Never certify a local captured row without independent provider match",()=>{
 const local={providerPaymentReference:"test-pay-001",amountCents:12000,
  currency:"CAD",paymentState:"captured"};
 assert.equal(compareProviderSettlement270(local,{}).matched,false);
 assert.equal(compareProviderSettlement270(local,{reference:"test-pay-001",
  amountCents:12001,currency:"CAD",status:"captured"}).matched,false);
 assert.equal(compareProviderSettlement270(local,{reference:"test-pay-001",
  amountCents:12000,currency:"CAD",status:"captured"}).matched,true);
});
test("Disabled no-email Rosevear cannot be reset into privileged access",()=>{
 const failed={identifiedOriginalHost:false,accountFound:true,
  accountActive:false,credentialPresent:false,recoveryEmailVerified:false,
  platformGrantActive:false,mfaVerified:false,independentOwnerBinding:false};
 assert.match(ownerEnrollmentStatus270(failed),/^HOLD/);
 assert.equal(ownerEnrollmentStatus270({...failed,identifiedOriginalHost:true}),"HOLD_ACCOUNT_DISABLED");
 assert.equal(ownerEnrollmentStatus270({...failed,identifiedOriginalHost:true,
  accountActive:true}),"HOLD_NO_PASSWORD_CREDENTIAL");
});
test("No synthetic restore acceptance or mailbox delivery",()=>{
 assert.match(restorationAcceptance270({originalHostPinned:true,
  migrationsPresent:true,originalBackupVerified:true}),/^HOLD/);
 assert.equal(digestEvidence270("synthetic evidence").length,64);
 const sql=readFileSync("database/migrations/0245_build270_source_custody.sql","utf8");
 for(const item of ["support_delivery_attempts270","provider_trace270",
  "original_restore_evidence270","force row level security","unique(outbox_id)"])
  assert.ok(sql.includes(item),item);
});
