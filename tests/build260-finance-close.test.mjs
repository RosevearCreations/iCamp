import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { readFileSync } from "node:fs";

import {
  compareTaxInvoices260,
  parseTaxInvoiceCsv260,
  verifyProviderPacket260,
  evaluateClose260,
  validatedApproval260,
} from "../lib/finance-close260/core.mjs";

const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const pem = publicKey.export({ type: "spki", format: "pem" });
const invoice = {
  id: "a", reservationId: "r", invoiceNumber: "INV-12345678",
  currencyCode: "CAD", reservationAmountCents: 11300,
  securityDepositCents: 1000, totalPayableCents: 12300,
  issuedAt: "2026-11-16T12:00:00.000Z",
};
const tax = [
  "invoice_number,currency,taxable_base_cents,hst_cents,non_taxable_cents,security_deposit_cents,total_payable_cents",
  "INV-12345678,CAD,10000,1300,0,1000,12300",
].join("\n");
const accounting = "currency,net_recorded_cents,invoices_issued_cents,succeeded_refunds_cents\nCAD,5000,12300,0";
const rows = [{
  provider: "external_test", providerReference: "pi_1", currencyCode: "CAD",
  capturedCents: 5000, refundedCents: 0,
}];
function signed(overrides = {}) {
  const payload = {
    schema: "icamp.provider-settlement.v1", campgroundId: "camp-a",
    localDate: "2026-11-16", provider: "external_test",
    keyId: "provider-key-1", statementId: "stmt_1",
    issuedAt: "2026-11-17T12:00:00.000Z", rows,
    ...overrides,
  };
  return JSON.stringify({
    payload,
    signatureBase64: sign(null, Buffer.from(JSON.stringify(payload)), privateKey).toString("base64"),
  });
}
const opts = {
  campgroundId: "camp-a", localDate: "2026-11-16",
  expected: rows, provider: "external_test", keyId: "provider-key-1",
  publicKeyPem: pem, now: new Date("2026-11-17T15:00:00Z"),
};
function snapshot() {
  const source = {
    campgroundId: "camp-a", localDate: "2026-11-16",
    timezone: "America/Toronto", generatedAt: "2026-11-17T12:00:00Z",
    truncated: {payments: false, refunds: false, adjustments: false},
    payments: [], refunds: [], adjustments: [],
  };
  return {
    source, financeReview: {worksheet:[],cases:[],truncated:false},
    reconciliation: {
      incomplete:false,internalReviewStatus:"SOURCE_CHECKS_CLEAR",findings:[],
      accountingExpected:[{currencyCode:"CAD",netRecordedCents:5000,invoicesIssuedCents:12300,succeededRefundsCents:0}],
    },
    invoices:[invoice], schedules:[], settlementExpected:rows,
  };
}
test("Build 260 HST arithmetic is sourced explicitly, not assumed from total", () => {
  const data = parseTaxInvoiceCsv260(tax);
  assert.equal(data[0].hstCents,1300);
  assert.equal(compareTaxInvoices260(data,[invoice])[0].status,"matched");
  assert.throws(()=>parseTaxInvoiceCsv260(tax.replace("1300,0","1200,0")),/do not total/u);
  assert.equal(compareTaxInvoices260(data,[{...invoice,totalPayableCents:15000}])[0].status,"variance");
  assert.equal(compareTaxInvoices260([], [invoice])[0].status,"missing");
});
test("Build 260 enrolled-signer verification checks identity, signature, every source row",()=>{
  assert.equal(verifyProviderPacket260(signed(),opts).status,"ENROLLED_SIGNER_MATCHED_NOT_BANK_PROOF");
  assert.throws(()=>verifyProviderPacket260(signed({campgroundId:"another"}),opts),/scope|identity/u);
  assert.throws(()=>verifyProviderPacket260(signed({rows:[]}),opts),/rows/u);
  assert.throws(()=>verifyProviderPacket260(signed(),{...opts,provider:"mock"}),/HOLD/u);
  assert.throws(()=>verifyProviderPacket260(signed({statementId:"tampered"}).replace('"tampered"','"edited"'),opts),/signature/u);
  assert.throws(()=>verifyProviderPacket260(signed(),{...opts,expected:[{...rows[0],capturedCents:6000}]}),/differs/u);
});
test("Build 260 ready owner decision only after independent inputs match",()=>{
  const report=evaluateClose260({
    snapshot:snapshot(),signedProviderJson:signed(),taxInvoiceCsv:tax,
    accountingCsv:accounting,
    signer:{provider:"external_test",keyId:"provider-key-1",publicKeyPem:pem},
    now:opts.now,
  });
  assert.equal(report.status,"READY_FOR_OWNER_NONPOSTING_DECISION");
  assert.match(report.closePackageDigest,/^[a-f0-9]{64}$/u);
  assert.ok(validatedApproval260("approve","Independent owner reviewed source and accountant export.",report).note);
  assert.throws(()=>validatedApproval260("approve","too short",report),/20/);
  const blocked=evaluateClose260({
    snapshot:snapshot(),signedProviderJson:signed(),taxInvoiceCsv:tax,
    accountingCsv:accounting.replace("5000","4000"),
    signer:{provider:"external_test",keyId:"provider-key-1",publicKeyPem:pem},
    now:opts.now,
  });
  assert.equal(blocked.status,"HOLD");
  assert.throws(()=>validatedApproval260("approve","Owner approved all of the facts from source.",blocked),/HOLD/u);
});
test("Build 260 database is tenant RLS, immutable and owner guarded",()=>{
  const sql=readFileSync(new URL("../database/migrations/0238_build260_owner_financial_close.sql",import.meta.url),"utf8");
  assert.match(sql,/force row level security/iu);
  assert.match(sql,/has_current_campground_owner_admin/iu);
  assert.match(sql,/finance\.manage/iu);
  assert.match(sql,/unique\s*\(campground_id,local_day\)/iu);
  assert.doesNotMatch(sql,/grant\s+update|grant\s+delete/iu);
});
