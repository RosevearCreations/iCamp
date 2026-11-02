import type { PortfolioRow } from "./core.mjs";
export interface FinancePortfolio {
  campground: {
    id: string;
    organization_id: string;
    name: string;
    server_now: string;
  };
  rows: PortfolioRow[];
  displayLimited: boolean;
}
export function getFinancePortfolio(
  actorUserId: string,
  campgroundId: string,
): Promise<FinancePortfolio>;
export function recordRecurrenceReview(
  input: Record<string, unknown>,
): Promise<string>;
