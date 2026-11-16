import type { FinanceSource } from "../finance-close/core.mjs";

export interface Invoice259 {
  id: string;
  reservationId: string;
  invoiceNumber: string;
  currencyCode: string;
  reservationAmountCents: number;
  securityDepositCents: number;
  totalPayableCents: number;
  issuedAt: string;
}
export interface Schedule259 {
  id: string;
  reservationId: string;
  currencyCode: string;
  bookingDepositCents: number;
  totalPayableCents: number;
}
export interface AccountingRow259 {
  currencyCode: string;
  netRecordedCents: number;
  invoicesIssuedCents: number;
  succeededRefundsCents: number;
}
export interface Reconciliation259 {
  generatedAt: string;
  localDate: string;
  timezone: string;
  incomplete: boolean;
  internalReviewStatus: string;
  providerSettlementStatus: string;
  accountingCloseStatus: string;
  findings: Array<{
    kind: string;
    priority: string;
    reservationId: string;
    sourceId: string;
    detail: string;
  }>;
  deposits: Array<{
    reservationId: string;
    depositDueCents: number | null;
    capturedInWindowCents: number;
    state: string;
  }>;
  accountingExpected: AccountingRow259[];
  sourceCounts: {
    payments: number;
    refunds: number;
    invoices: number;
    schedules: number;
  };
  disclaimer: string;
}
export function buildReconciliation259(input: {
  source: FinanceSource;
  invoices?: Invoice259[];
  schedules?: Schedule259[];
  invoiceRowsTruncated?: boolean;
  scheduleRowsTruncated?: boolean;
}): Reconciliation259;
export function parseAccountingCsv259(csv: string): AccountingRow259[];
export function compareAccountingRows259(
  imported: AccountingRow259[],
  expected: AccountingRow259[],
): Array<AccountingRow259 & { status: string }>;
