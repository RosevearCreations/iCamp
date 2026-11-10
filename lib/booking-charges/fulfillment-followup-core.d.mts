export const SLA_FOLLOWUP_LABELS: Readonly<Record<string, string>>;
export const SLA_EXCEPTION_LABELS: Readonly<Record<string, string>>;
export function validateSlaFollowup(input: {
  dispatchId: string;
  previousReviewId?: string | null;
  reviewState: string;
  reviewNote: string;
}): {
  dispatchId: string;
  previousReviewId: string | null;
  reviewState: string;
  reviewNote: string;
};
export function needsSlaFollowup(
  classification: {
    acknowledgement: string;
    completion: string;
  } | null,
): boolean;
export function validateInboxPage(value?: string | number | null): number;
