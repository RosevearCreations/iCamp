import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  buildReconciliation259,
  compareAccountingRows259,
  parseAccountingCsv259,
} from "../lib/finance-reconciliation259/core.mjs";

function source() {
  return {
    campgroundId: "camp-a",
    campgroundName: "Camp A",
    organizationId: "org-a",
    generatedAt: "2026-11-16T15:00:00Z",
    localDate: "2026-11-16",
    timezone: "America/Toronto",
    sourceWindowStart: "2026-08-08",
    truncated: { payments: false, refunds: false, adjustments: false },
    payments: [
      {
        id: "payment-one",
        reservationId: "res-one",
        state: "captured",
        amountCents: 5000,
        currencyCode: "CAD",
        provider: "mock",
        providerReference: "pay-one",
        capturedAt: "2026-11-16T14:00:00Z",
        createdAt: "2026-11-16T14:00:00Z",
        receiptId: "receipt-one",
        receiptCents: 5000,
        receiptCurrency: "CAD",
        receiptIssuedAt: "2026-11-16T14:00:00Z",
      },
    ],
    refunds: [],
    adjustments: [],
  };
}
const invoice = {
  id: "invoice-one",
  reservationId: "res-one",
  invoiceNumber: "INV-12345678",
  currencyCode: "CAD",
  reservationAmountCents: 6000,
  securityDepositCents: 1000,
  totalPayableCents: 7000,
  issuedAt: "2026-11-16T14:00:00Z",
};
const schedule = {
  id: "schedule-one",
  reservationId: "res-one",
  currencyCode: "CAD",
  bookingDepositCents: 3000,
  totalPayableCents: 7000,
};

test("Build 259 distinguishes internal source consistency from verified settlement and book close", () => {
  const result = buildReconciliation259({
    source: source(),
    invoices: [invoice],
    schedules: [schedule],
  });
  assert.equal(result.internalReviewStatus, "SOURCE_CHECKS_CLEAR");
  assert.match(result.providerSettlementStatus, /^HOLD_/u);
  assert.match(result.accountingCloseStatus, /^HOLD_/u);
  assert.equal(result.deposits[0].state, "covered_in_window_not_allocated");
  assert.deepEqual(result.accountingExpected, [
    {
      currencyCode: "CAD",
      netRecordedCents: 5000,
      invoicesIssuedCents: 7000,
      succeededRefundsCents: 0,
    },
  ]);
});

test("Build 259 detects invoice mismatch and incomplete evidence without guessing balances", () => {
  const mismatch = { ...invoice, totalPayableCents: 8000 };
  const result = buildReconciliation259({
    source: source(),
    invoices: [mismatch],
    schedules: [schedule],
    invoiceRowsTruncated: true,
  });
  assert.equal(result.internalReviewStatus, "HOLD_INCOMPLETE_SOURCE");
  assert.ok(
    result.findings.some(
      (item) => item.kind === "invoice" && item.priority === "critical",
    ),
  );
});

test("Build 259 flags missing invoices, deposit evidence gaps and captured overage", () => {
  const missing = buildReconciliation259({
    source: source(),
    invoices: [],
    schedules: [schedule],
  });
  assert.equal(missing.internalReviewStatus, "REVIEW_EXCEPTIONS");
  assert.ok(missing.findings.some((item) => item.kind === "invoice"));
  const low = buildReconciliation259({
    source: source(),
    invoices: [invoice],
    schedules: [{ ...schedule, bookingDepositCents: 6000 }],
  });
  assert.equal(low.deposits[0].state, "requires_review");
  const high = buildReconciliation259({
    source: source(),
    invoices: [invoice],
    schedules: [{ ...schedule, totalPayableCents: 4000 }],
  });
  assert.ok(
    high.findings.some((item) => /duplicate capture/u.test(item.detail)),
  );
});

test("Build 259 accounting import compares all currencies and rejects duplicate/malformed input", () => {
  const expected = [
    {
      currencyCode: "CAD",
      netRecordedCents: 5000,
      invoicesIssuedCents: 7000,
      succeededRefundsCents: 0,
    },
  ];
  const csv =
    "currency,net_recorded_cents,invoices_issued_cents,succeeded_refunds_cents\nCAD,5000,7000,0";
  assert.equal(
    compareAccountingRows259(parseAccountingCsv259(csv), expected)[0].status,
    "matched",
  );
  assert.equal(
    compareAccountingRows259(
      parseAccountingCsv259(csv.replace("5000", "4999")),
      expected,
    )[0].status,
    "variance",
  );
  assert.equal(compareAccountingRows259([], expected)[0].status, "missing");
  assert.throws(
    () => parseAccountingCsv259(csv + "\nCAD,5000,7000,0"),
    /Duplicate/u,
  );
  assert.throws(
    () => parseAccountingCsv259(csv.replace("5000", "=5000")),
    /Invalid/u,
  );
});

test("Build 259 evidence readers stay campground-scoped, under RLS and non-posting", () => {
  const pg = readFileSync(
    new URL("../lib/finance-reconciliation259/postgres.mjs", import.meta.url),
    "utf8",
  );
  const ui = readFileSync(
    new URL(
      "../app/workspaces/management/command/finance-reconciliation/page.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(pg, /set local role icamp_app/u);
  assert.match(pg, /i\.campground_id=\$1/u);
  assert.match(pg, /where campground_id=\$1/u);
  assert.match(pg, /getCampgroundFinanceCloseSource/u);
  assert.doesNotMatch(pg, /insert into|update public|delete from/u);
  assert.match(ui, /requireStaff/u);
  assert.match(ui, /HOLD|providerSettlementStatus/u);
});
