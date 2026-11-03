export interface FinancePayment {
  id: string;
  reservationId: string;
  state: string;
  amountCents: number;
  currencyCode: string;
  provider: string;
  providerReference: string | null;
  capturedAt: string | null;
  createdAt: string | null;
  receiptId: string | null;
  receiptCents: number | null;
  receiptCurrency: string | null;
  receiptIssuedAt: string | null;
}
export interface FinanceRefund {
  id: string;
  reservationId: string;
  originalPaymentId: string;
  originalProviderReference: string | null;
  originalProvider: string | null;
  amountCents: number;
  currencyCode: string;
  state: string;
  approvalState: string;
  requestedByUserId: string;
  approvedByUserId: string | null;
  requestedAt: string | null;
  completedAt: string | null;
}
export interface FinanceAdjustment {
  id: string;
  reservationId: string;
  actorUserId: string;
  adjustmentKind: string;
  financialEffect: string;
  amountCents: number;
  currencyCode: string;
  reason: string;
  evidence: Record<string, unknown>;
  occurredAt: string | null;
}
export interface FinanceSource {
  campgroundId: string;
  campgroundName: string;
  organizationId: string;
  generatedAt: string;
  localDate: string;
  timezone: string;
  sourceWindowStart: string;
  truncated: Record<string, boolean>;
  payments: FinancePayment[];
  refunds: FinanceRefund[];
  adjustments: FinanceAdjustment[];
}
export interface FinanceReview {
  generatedAt: string;
  localDate: string;
  timezone: string;
  cases: Array<{
    type: string;
    priority: string;
    reservationId: string;
    sourceId: string;
    summary: string;
    evidencePath: string;
  }>;
  worksheet: Array<{
    currencyCode: string;
    capturedCents: number;
    succeededRefundCents: number;
    netRecordedMovementCents: number;
    issuedReceiptCents: number;
    adjustmentEvidenceCents: number;
  }>;
  proposals: Array<{
    id: string;
    reservationId: string;
    actorUserId: string;
    requestedKind: string;
    requestedAmountCents: number;
    currencyCode: string;
    reason: string;
    decision: string | null;
    decidedByUserId: string | null;
  }>;
  sourceCounts: { payments: number; refunds: number; adjustments: number };
  truncated: boolean;
  disclaimer: string;
}
export interface SettlementRow {
  provider: string;
  providerReference: string;
  currencyCode: string;
  capturedCents: number;
  refundedCents: number;
}
export function localDay(
  timestamp: string | null,
  timezone: string,
): string | null;
export function validCloseDate(value: string, today: string): string;
export function adjustmentEvidence(
  row: FinanceAdjustment,
): Record<string, unknown> | null;
export function buildFinancialCloseReview(source: FinanceSource): FinanceReview;
export function parseSettlementCsv(text: string): SettlementRow[];
export function compareSettlementRows(
  rows: SettlementRow[],
  expected: SettlementRow[],
): Array<SettlementRow & { status: string; details: string }>;
