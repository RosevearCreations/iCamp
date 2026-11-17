import type {
  Reconciliation259,
  Invoice259,
  Schedule259,
} from "../finance-reconciliation259/core.mjs";
import type { FinanceSource, FinanceReview } from "../finance-close/core.mjs";
export interface Snapshot260 {
  source: FinanceSource;
  financeReview: FinanceReview;
  reconciliation: Reconciliation259;
  invoices: Invoice259[];
  schedules: Schedule259[];
  settlementExpected: Array<{
    provider: string;
    providerReference: string;
    currencyCode: string;
    capturedCents: number;
    refundedCents: number;
  }>;
}
export interface TaxInvoice260 {
  invoiceNumber: string;
  currencyCode: string;
  taxableBaseCents: number;
  hstCents: number;
  nonTaxableCents: number;
  securityDepositCents: number;
  totalPayableCents: number;
}
export function digest260(input: unknown): string;
export function parseTaxInvoiceCsv260(csv: string): TaxInvoice260[];
export function compareTaxInvoices260(
  imported: TaxInvoice260[],
  invoices: Invoice259[],
): Array<{ invoiceNumber: string; status: string }>;
export function verifyProviderPacket260(
  raw: string,
  options: {
    campgroundId: string;
    localDate: string;
    expected: Snapshot260["settlementExpected"];
    provider: string;
    keyId: string;
    publicKeyPem: string;
    now?: Date;
  },
): {
  signerKeyId: string;
  statementId: string;
  rowCount: number;
  payloadDigest: string;
  status: string;
};
export interface CloseReport260 {
  status: string;
  blockers: string[];
  invoiceCount: number;
  taxComparison: Array<{ invoiceNumber: string; status: string }>;
  accountingComparison: Array<{ currencyCode: string; status: string }>;
  settlement: null | {
    signerKeyId: string;
    statementId: string;
    rowCount: number;
    payloadDigest: string;
    status: string;
  };
  sourceDigest: string;
  taxDigest: string;
  accountingDigest: string;
  settlementDigest: string | null;
  closePackageDigest: string | null;
  disclaimer: string;
}
export function evaluateClose260(input: {
  snapshot: Snapshot260;
  signedProviderJson: string;
  taxInvoiceCsv: string;
  accountingCsv: string;
  signer: { provider: string; keyId: string; publicKeyPem: string };
  now?: Date;
}): CloseReport260;
export function validatedApproval260(
  decision: string,
  reason: string,
  report: CloseReport260,
): { note: string; closePackageDigest: string };
