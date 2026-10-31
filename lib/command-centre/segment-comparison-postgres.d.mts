import type { SegmentComparisonSummary } from "./segment-comparison-core.mjs";

export function getCampgroundSegmentComparison(input: {
  userId: string;
  campgroundId: string;
}): Promise<SegmentComparisonSummary>;
