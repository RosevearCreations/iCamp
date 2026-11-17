import type {
  FinanceReview,
  FinanceSource,
  SettlementRow,
} from "../finance-close/core.mjs";
import type { Reconciliation259, Invoice259, Schedule259 } from "./core.mjs";

export function closeReconciliationPoolForTests(): Promise<void>;
export function getCampgroundReconciliation259(input: {
  userId: string;
  campgroundId: string;
  localDate?: string;
}): Promise<{
  source: FinanceSource;
  financeReview: FinanceReview;
  reconciliation: Reconciliation259;
  invoices: Invoice259[];
  schedules: Schedule259[];
  settlementExpected: SettlementRow[];
}>;
