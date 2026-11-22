import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {evaluateOwnerLogin272,evaluateField272,evaluateIncident272,evaluateDryRun272,SHA272} from "../lib/build272/core.mjs";
test("Owner sign-in is not a credential-only or self-certified ceremony",()=>{
 const all={originalPinned:true,accountActive:true,verifiedEmail:true,passwordExists:true,
 verifiedMfa:true,independentGrant:true,actualAal2Session:true,independentWitness:true};
 assert.match(evaluateOwnerLogin272(all),/^ORIGINAL/);
 for(const key of Object.keys(all))assert.match(evaluateOwnerLogin272({...all,[key]:false}),/^HOLD/);
});
test("Original processor, site, guest receipt and distinct manager required",()=>{
 const all={originalPinned:true,migration:true,providerPair:true,providerMatch:true,
 processorSettlementWitness:true,siteWitness:true,confirmationWitness:true,
 guestAcknowledged:true,independentReview:true};
 assert.match(evaluateField272(all),/^ELIGIBLE/);
 for(const key of Object.keys(all))assert.match(evaluateField272({...all,[key]:false}),/^HOLD/);
});
test("API acceptance not equal to Comms recipient acknowledgement",()=>{
 const all={sourcePaired:true,durableAttemptAccepted:true,signedDeliveredReceipt:true,
 independentReviewer:true,originalRecipientAcknowledged:true};
 assert.equal(evaluateIncident272({...all,originalRecipientAcknowledged:false}),"HOLD_RECIPIENT_ACK");
 assert.match(evaluateIncident272(all),/^ORIGINAL/);
});
test("Restore digest receipt cannot independently certify original host",()=>{
 const all={originalBackupWitness:true,isolatedRestoreWitness:true,
 allFourCanonicalFingerprints:true,independentReviewer:true};
 assert.match(evaluateDryRun272(all),/EXTERNAL_HOST_CERTIFICATION_SEPARATE$/);
 assert.match(evaluateDryRun272({...all,allFourCanonicalFingerprints:false}),/^HOLD/);
 assert.equal(SHA272.test("a".repeat(64)),true);
});
test("Original source constraints enforce four isolated immutable ledgers",()=>{
 const sql=readFileSync("database/migrations/0247_build272_live_field_acceptance.sql","utf8");
 for(const x of ["owner_login_witness272","provider_booking_acceptance272",
  "comms_incident_review272","restore_dryrun_review272","actual active original MFA session",
  "factor_state='verified'","attempt_status='accepted'","event_kind='delivered'",
  "source_fingerprint_sha256","force row level security"])
  assert.ok(sql.includes(x),x);
});
