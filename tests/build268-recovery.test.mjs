import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  classifyMissingConfirmation268, nextSupportSlaTier268,
  CAMP_ROSEVEAR_REHEARSAL268,
} from "../lib/campground-support268/core.mjs";

test("Camp Rosevear paid-no-confirmation scenario does not assume provider settlement", () => {
  assert.equal(CAMP_ROSEVEAR_REHEARSAL268.environment, "rehearsal-only");
  assert.equal(classifyMissingConfirmation268(CAMP_ROSEVEAR_REHEARSAL268),
    "PROVIDER_RECONCILIATION_REQUIRED");
  const reconciled = { ...CAMP_ROSEVEAR_REHEARSAL268, providerReconciled: true };
  assert.equal(classifyMissingConfirmation268(reconciled), "CONFIRMATION_MISSING");
  assert.equal(classifyMissingConfirmation268({...reconciled, holdExpired:true}),
    "HOLD_OR_SITE_REVIEW");
  assert.equal(classifyMissingConfirmation268({
    ...reconciled, reservationStatus:"confirmed", confirmationExists:true,
  }), "DELIVERY_RETRY_REQUIRED");
  assert.equal(classifyMissingConfirmation268({
    ...reconciled, reservationStatus:"confirmed", confirmationExists:true,
    deliveryState:"delivered",
  }), "RECEIPT_MISSING");
  assert.equal(classifyMissingConfirmation268({
    ...reconciled, reservationStatus:"confirmed", confirmationExists:true,
    deliveryState:"delivered", receiptExists:true,
  }), "RECOVERED");
});
test("Insufficient/invalid evidence cannot close a paid guest complaint",()=>{
  assert.equal(classifyMissingConfirmation268({originalReservation:true,bookingDueCents:100,capturedCents:50}),
    "PAYMENT_SHORTFALL");
  assert.equal(classifyMissingConfirmation268({originalReservation:false,bookingDueCents:0,capturedCents:0}),
    "SOURCE_MISSING");
  assert.equal(classifyMissingConfirmation268({...CAMP_ROSEVEAR_REHEARSAL268,providerReconciled:true,siteConflict:true}),
    "HOLD_OR_SITE_REVIEW");
});
test("SLA only queues overdue unreviewed assigned cases; no fabricated notifications",()=>{
  const now=new Date("2026-11-20T12:00:00Z");
  const e={createdAt:"2026-11-20T10:00:00Z",severity:"critical",status:"open",
    assignedUserId:"11111111-1111-4111-8111-111111111111"};
  assert.equal(nextSupportSlaTier268(e,now),"critical");
  assert.equal(nextSupportSlaTier268({...e,reviewedAt:"2026-11-20T10:30:00Z"},now),null);
  assert.equal(nextSupportSlaTier268({...e,assignedUserId:null},now),null);
  assert.equal(nextSupportSlaTier268({...e,status:"resolved"},now),null);
});
test("Database acceptance has idempotent private support/booking event evidence",()=>{
 const sql=readFileSync("database/migrations/0243_build268_recovery_outbox.sql","utf8");
 for(const part of ["support_sla_outbox268","booking_recovery268","unique(case_id,alert_tier)",
  "force row level security","guard_booking_recovery268","guest_followup_at"])
   assert.ok(sql.includes(part),part);
});
