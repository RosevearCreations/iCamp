export interface SegmentMonth {
  month: string;
  kind: "campsite" | "rental_cottage" | "permanent_unit";
  siteNights: number;
  bookedNights: number;
  seasonalNights: number;
  reservationNights: number;
  bookedPercent: number;
}

export interface UtilizationSegment {
  kind: SegmentMonth["kind"];
  months: SegmentMonth[];
  siteNights: number;
  bookedNights: number;
  seasonalNights: number;
  reservationNights: number;
  bookedPercent: number;
}

export interface SegmentComparisonSummary {
  generatedAt: string;
  months: string[];
  segments: UtilizationSegment[];
}

export const SEGMENT_KINDS: SegmentMonth["kind"][];
export function summarizeSegmentComparisons(
  rows: Array<Omit<SegmentMonth, "bookedPercent">>,
  observedAt?: Date,
): SegmentComparisonSummary;
