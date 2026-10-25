export interface ReasonRow {
  reason_code: string;
  hold_count: number;
  next_review_at: string | null;
  review_disposition: string | null;
  latest_reviewed_at: string | null;
}
export interface PortfolioRow {
  id: string;
  buyer_display_name: string;
  version_code: string;
  recorded_at: string;
  latest_exception_event_id: string | null;
  latest_event_type: string | null;
  escalation_count: number;
  open_tasks: number;
  overdue_tasks: number;
  closed_tasks: number;
  reasons: ReasonRow[];
}
export function normalizeRecurrenceReview(
  input: Record<string, unknown>,
): Record<string, string | number>;
export function classifyPortfolio(
  row: PortfolioRow,
  now?: number,
): {
  status: string;
  openTasks: number;
  overdueTasks: number;
  recurrences: ReasonRow[];
  attention: boolean;
  staleReview: boolean;
};
export function summarizePortfolio(
  rows: PortfolioRow[],
  now?: number,
): {
  consents: number;
  activeHolds: number;
  openOwnerTasks: number;
  overdueOwnerTasks: number;
  recurringConsents: number;
  pendingRecurrenceReviews: number;
};
