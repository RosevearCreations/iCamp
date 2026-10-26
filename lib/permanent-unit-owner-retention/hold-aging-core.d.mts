export const holdAgingFilters: string[];
export function normalizeHoldAgingFilter(value: unknown): string;
export function classifyHoldFollowup(
  plan: { next_due_at: Date | string },
  resolution: { resolution_kind: string } | null,
  now?: Date,
): string;
export function summarizeHoldAging(
  plans: Array<{
    id: string;
    exception_review_id: string;
    next_due_at: Date | string;
  }>,
  resolutions: Array<{ action_plan_id: string; resolution_kind: string }>,
  reviews: Array<{ id: string; acceptance_id: string }>,
  now?: Date,
): {
  rows: Array<{
    id: string;
    exception_review_id: string;
    next_due_at: Date | string;
    stage: string;
    resolution: { action_plan_id: string; resolution_kind: string } | null;
    acceptanceId: string | null;
  }>;
  counts: Record<string, number>;
  recurrence: Array<{
    acceptanceId: string;
    plans: number;
    continuedHolds: number;
    overdue: number;
  }>;
};
