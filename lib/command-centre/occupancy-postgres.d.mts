import type { OccupancySummary } from "./occupancy-core.mjs";
import type { SeasonalTrendsSummary } from "./seasonal-trends-core.mjs";

export function getCampgroundOccupancySummary(input: {
  userId: string;
  campgroundId: string;
}): Promise<OccupancySummary>;

export function getCampgroundSeasonalTrends(input: {
  userId: string;
  campgroundId: string;
}): Promise<SeasonalTrendsSummary>;

export function closeOccupancyPoolForTests(): Promise<void>;
