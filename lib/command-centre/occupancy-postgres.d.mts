import type { OccupancySummary } from "./occupancy-core.mjs";

export function getCampgroundOccupancySummary(input: {
  userId: string;
  campgroundId: string;
}): Promise<OccupancySummary>;

export function closeOccupancyPoolForTests(): Promise<void>;
