export const oversightWindows: readonly number[];
export function normalizeOversightWindow(value: unknown): number;
export function normalizeOversightScope(
  source: unknown,
  target: unknown,
  allowedIds: string[],
): { source: string | null; target: string | null };
export function classifyExceptionOversight(
  row: {
    accepted?: boolean;
    outcomeKind?: string | null;
    outcomeReviewKind?: string | null;
    nextDueAt?: string | null;
    actionDueAt?: string | null;
  },
  now?: Date,
): "closed" | "returned" | "review_pending" | "overdue" | "escalated" | "open";
