import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildFinancialCloseReview,
  compareSettlementRows,
  localDay,
  parseSettlementCsv,
  validCloseDate,
} from "../lib/finance-close/core.mjs";
import { settlementExpectedRows } from "../lib/finance-close/postgres.mjs";

const file = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const source = () => ({
  campgroundId: "camp-one",
  campgroundName: "Test campground",
  organizationId: "org-one",
  timezone: "America/Toronto",
  localDate: "2026-11-03",
  generatedAt: "2026-11-03T18:00:00Z",
  sourceWindowStart: "2026-08-01T00:00:00Z",
  truncated: { payments: false, refunds: false, adjustments: false },
  payments: [
    {
      id: "payment-one",
      reservationId: "reservation-one",
      state: "captured",
      amountCents: 5000,
      currencyCode: "CAD",
      provider: "mock",
      providerReference: "ref-one",
      capturedAt: "2026-11-03T14:00:00Z",
      createdAt: "2026-11-03T13:00:00Z",
      receiptId: "receipt-one",
      receiptCents: 5000,
      receiptCurrency: "CAD",
      receiptIssuedAt: "2026-11-03T14:01:00Z",
    },
  ],
  refunds: [
    {
      id: "refund-one",
      reservationId: "reservation-one",
      originalPaymentId: "payment-one",
      originalProviderReference: "ref-one",
      originalProvider: "mock",
      amountCents: 1250,
      currencyCode: "CAD",
      state: "succeeded",
      approvalState: "approved",
      requestedByUserId: "maker",
      approvedByUserId: "checker",
      requestedAt: "2026-11-03T14:02:00Z",
      completedAt: "2026-11-03T14:05:00Z",
    },
  ],
  adjustments: [],
});

test("Build 196 uses the campground calendar, not UTC, and bounds close dates", () => {
  assert.equal(
    localDay("2026-11-04T02:30:00Z", "America/Toronto"),
    "2026-11-03",
  );
  assert.equal(
    localDay("2026-11-03T03:30:00Z", "America/Toronto"),
    "2026-11-02",
  );
  assert.equal(validCloseDate("2026-11-03", "2026-11-03"), "2026-11-03");
  assert.throws(() => validCloseDate("2026-11-04", "2026-11-03"), /31 days/);
  assert.throws(() => validCloseDate("2026-08-01", "2026-11-03"), /31 days/);
  assert.throws(() => validCloseDate("2026-02-30", "2026-11-03"), /calendar/);
});

test("Build 196 worksheet keeps captured and succeeded refunds distinct from receipts and gross adjustment evidence", () => {
  const data = source();
  data.adjustments.push({
    id: "adjustment-posted",
    reservationId: "reservation-one",
    actorUserId: "checker",
    adjustmentKind: "writeoff",
    financialEffect: "none",
    amountCents: 700,
    currencyCode: "CAD",
    reason: "independent record",
    evidence: {},
    occurredAt: "2026-11-03T15:00:00Z",
  });
  const report = buildFinancialCloseReview(data);
  assert.deepEqual(report.worksheet, [
    {
      currencyCode: "CAD",
      capturedCents: 5000,
      succeededRefundCents: 1250,
      netRecordedMovementCents: 3750,
      issuedReceiptCents: 5000,
      adjustmentEvidenceCents: 700,
    },
  ]);
  assert.equal(report.cases.length, 0);
  assert.match(report.disclaimer, /not a bank settlement/);
});

test("Build 196 highlights missing/mismatched receipts, refund exposure and evidence coverage", () => {
  const data = source();
  data.payments[0].receiptId = null;
  data.payments[0].providerReference = null;
  data.refunds[0].amountCents = 6000;
  data.refunds[0].state = "approved";
  data.truncated.refunds = true;
  const report = buildFinancialCloseReview(data);
  assert.equal(report.truncated, true);
  assert.ok(
    report.cases.some((row) => row.summary.includes("no linked receipt")),
  );
  assert.ok(
    report.cases.some(
      (row) => row.priority === "critical" && row.summary.includes("exceed"),
    ),
  );
  assert.ok(
    report.cases.some((row) => row.summary.includes("no provider reference")),
  );
});

test("Build 196 maker/checker approval markers remain zero-effect and do not enter recorded movement", () => {
  const data = source();
  data.adjustments.push({
    id: "proposal-id",
    reservationId: "reservation-one",
    actorUserId: "maker",
    adjustmentKind: "review_resolution",
    financialEffect: "none",
    amountCents: 0,
    currencyCode: "CAD",
    reason: "Proposed credit",
    evidence: {
      build196: {
        type: "proposal",
        requestedKind: "credit",
        requestedAmountCents: 3000,
      },
    },
    occurredAt: "2026-11-03T14:00:00Z",
  });
  let report = buildFinancialCloseReview(data);
  assert.equal(report.proposals[0].decision, null);
  assert.ok(report.cases.some((row) => row.type === "adjustment"));
  data.adjustments.push({
    id: "decision-id",
    reservationId: "reservation-one",
    actorUserId: "checker",
    adjustmentKind: "review_resolution",
    financialEffect: "none",
    amountCents: 0,
    currencyCode: "CAD",
    reason: "Approved",
    evidence: {
      build196: {
        type: "decision",
        proposalId: "proposal-id",
        decision: "approved",
      },
    },
    occurredAt: "2026-11-03T14:05:00Z",
  });
  report = buildFinancialCloseReview(data);
  assert.equal(report.proposals[0].decision, "approved");
  assert.equal(report.worksheet[0].adjustmentEvidenceCents, 0);
  assert.ok(!report.cases.some((row) => row.type === "adjustment"));
  data.adjustments.push({
    id: "posted-id",
    reservationId: "reservation-one",
    actorUserId: "maker",
    adjustmentKind: "credit",
    financialEffect: "customer_credit",
    amountCents: 3000,
    currencyCode: "CAD",
    reason: "approved credit",
    evidence: {
      build196: { type: "posted", approvedProposalId: "proposal-id" },
    },
    occurredAt: "2026-11-03T14:10:00Z",
  });
  assert.equal(
    buildFinancialCloseReview(data).worksheet[0].adjustmentEvidenceCents,
    3000,
  );
});

test("Build 196 settlement preview has strict provider+reference matching and never posts", () => {
  const data = source();
  const expected = settlementExpectedRows(data);
  assert.deepEqual(expected, [
    {
      provider: "mock",
      providerReference: "ref-one",
      currencyCode: "CAD",
      capturedCents: 5000,
      refundedCents: 1250,
    },
  ]);
  const rows = parseSettlementCsv(
    "provider,provider_reference,currency,captured_cents,refunded_cents\r\nmock,ref-one,CAD,5000,1250\r\nstripe,ref-two,CAD,1000,0\r\n",
  );
  const compared = compareSettlementRows(rows, expected);
  assert.deepEqual(
    compared.map((row) => row.status),
    ["matched", "unmatched"],
  );
  assert.throws(
    () =>
      parseSettlementCsv(
        "provider,provider_reference,currency,captured_cents,refunded_cents\nmock,one,CAD,10,0\nmock,one,CAD,10,0",
      ),
    /Duplicate/,
  );
  assert.throws(
    () =>
      parseSettlementCsv(
        "provider,provider_reference,currency,captured_cents,refunded_cents\nmock,ref,CAD,-50,0",
      ),
    /invalid/,
  );
});

test("Build 196 financial posting requires existing independent approval and prevents duplicate posting", () => {
  const code = file("../lib/refunds/postgres.mjs");
  assert.match(code, /independent Build 196 adjustment approval is required/);
  assert.match(code, /actor_user_id === proposal\.actor_user_id/);
  assert.match(code, /build196-post-\$\{approvedProposalId\}/);
  assert.match(
    code,
    /on conflict \(campground_id, idempotency_key\) do nothing/,
  );
  const reviewer = file("../lib/finance-close/postgres.mjs");
  assert.match(reviewer, /proposal\.actor_user_id === actorUserId/);
  assert.match(reviewer, /build196-decision-\$\{proposalId\}/);
  assert.match(reviewer, /appendAuditEvent/);
  assert.match(reviewer, /set local role icamp_app/);
});
