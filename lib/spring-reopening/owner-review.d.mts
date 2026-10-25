export interface SpringOwnerReviewItem {
  accommodationId: string;
  code: string;
  approved: boolean;
  blockers: string[];
  reviewState: "requires_review" | "ready_for_owner_review";
}
export function reconcileSpringOwnerReview(input: {
  campgroundActive: boolean;
  accommodations: Array<{
    id: string;
    code: string;
    lifecycle_state: string;
  }>;
  assignments: Array<{
    id: string;
    accommodation_id: string;
    occupancy_state: string;
  }>;
  closureEvents: Array<{ id: string; assignment_id: string }>;
  inspections: Array<{
    id: string;
    accommodation_id: string;
    assignment_id: string | null;
    winter_close_event_id: string | null;
  }>;
  decisions: Array<{
    inspection_id: string;
    decision: string;
  }>;
  availability: {
    items: Array<{ accommodationId: string; blockers: string[] }>;
  } | null;
}): SpringOwnerReviewItem[];
