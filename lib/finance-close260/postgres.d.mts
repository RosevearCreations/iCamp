import type { CloseReport260 } from "./core.mjs";
import type { FinanceSource } from "../finance-close/core.mjs";
export function recordOwnerFinanceApproval260(input: {
  actorUserId: string;
  campgroundId: string;
  report: CloseReport260;
  source: FinanceSource;
  reason: string;
  decision: string;
}): Promise<{ id: string; disposition: string }>;
export function closeOwnerFinance260PoolForTests(): Promise<void>;
