import type { OwnerCampgroundReport } from "./core.mjs";
export interface OwnerFinanceReport {
  generatedAt: string;
  days: 7 | 30 | 90;
  campgrounds: OwnerCampgroundReport[];
  limited: boolean;
}
export function getOwnerFinanceReport(
  actorUserId: string,
  window?: unknown,
): Promise<OwnerFinanceReport>;
