import type { ForwardSource } from "./forward-occupancy-core.mjs";
export function getCampgroundForwardOccupancySource(input: {
  userId: string;
  campgroundId: string;
}): Promise<ForwardSource>;
export function closeForwardOccupancyPoolForTests(): Promise<void>;
