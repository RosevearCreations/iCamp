import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  normalizeManualReceipt,
  normalizeApplicantResponse,
  normalizeExceptionEvent,
} from "../lib/permanent-unit-receipts/core.mjs";
const id = () => randomUUID();
test("manual receipt pins sign-off, channel and externally attested time", () => {
  const v = {
    id: id(),
    consentId: id(),
    signoffId: id(),
    channel: "in_person",
    deliveredAt: "2026-10-24T12:00:00Z",
    evidenceReference: "SYNTH-HANDOFF-096",
    recipientVerificationReference: "SYNTH-RECIPIENT-096",
    note: "Synthetic manual office handoff only",
  };
  assert.equal(normalizeManualReceipt(v).channel, "in_person");
  assert.throws(
    () => normalizeManualReceipt({ ...v, channel: "sms" }),
    /approved consent/u,
  );
  assert.throws(
    () => normalizeManualReceipt({ ...v, evidenceReference: "" }),
    /Restricted delivery evidence/u,
  );
});
test("applicant response is explicitly limited to receipt, dispute or no response", () => {
  const v = {
    id: id(),
    receiptId: id(),
    response: "receipt_confirmed",
    responseAt: "2026-10-24T12:30:00Z",
    evidenceReference: "SYNTH-RESPONSE-096",
    note: "Synthetic response independently documented",
  };
  assert.equal(normalizeApplicantResponse(v).response, "receipt_confirmed");
  assert.throws(
    () => normalizeApplicantResponse({ ...v, response: "contract_signed" }),
    /receipt confirmation/u,
  );
});
test("exception entries cannot authorize transfers or loan actions", () => {
  const v = {
    id: id(),
    consentId: id(),
    eventType: "hold",
    reasonCode: "delivery_failure",
    evidenceReference: "SYNTH-EXCEPTION-096",
    note: "Synthetic disputed handoff evidence",
  };
  assert.equal(normalizeExceptionEvent(v).eventType, "hold");
  assert.throws(
    () => normalizeExceptionEvent({ ...v, eventType: "release_loan" }),
    /hold or clear/u,
  );
});
test("SQL protects immutable RLS and independent actor boundaries", () => {
  const sql = readFileSync(
    new URL(
      "../database/migrations/0128_permanent_unit_manual_delivery_evidence.sql",
      import.meta.url,
    ),
    "utf8",
  );
  for (const token of [
    "force row level security",
    "winterization_append_only",
    "delivery_exception_is_held",
    "ready_for_manual_handoff",
    "different staff member",
    "receipt_confirmed",
    "pg_advisory_xact_lock",
  ])
    assert.ok(sql.includes(token), token);
});
