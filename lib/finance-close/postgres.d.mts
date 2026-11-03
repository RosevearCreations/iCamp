import type { FinanceReview, FinanceSource, SettlementRow } from "./core.mjs";
export function getCampgroundFinanceCloseSource(input: {
  userId: string;
  campgroundId: string;
  localDate?: string;
}): Promise<{ source: FinanceSource; review: FinanceReview }>;
export function closeFinanceClosePoolForTests(): Promise<void>;
export function proposeManualAdjustment(input: {
  actorUserId: string;
  campgroundId: string;
  reservationId: string;
  kind: string;
  amountCents: number;
  currencyCode: string;
  reason: string;
  idempotencyKey?: string;
}): Promise<string>;
export function decideManualAdjustment(input: {
  actorUserId: string;
  campgroundId: string;
  proposalId: string;
  decision: string;
  reason: string;
}): Promise<string>;
export function settlementExpectedRows(source: FinanceSource): SettlementRow[];
