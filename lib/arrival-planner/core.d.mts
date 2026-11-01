export interface ArrivalPlanInput {
  state: "draft" | "submitted";
  expectedArrivalTime: string | null;
  arrivalMode: string;
  expectedVehicleCount: number | null;
  expectedVisitorCount: number | null;
  documentPreparation: string;
  rulesReviewed: boolean;
  assistanceRequested: boolean;
  assistanceNote: string | null;
}

export function normalizeArrivalPlan(
  input: Record<string, unknown>,
): ArrivalPlanInput;
export function normalizeStaffArrivalReview(input: Record<string, unknown>): {
  outcome: "reviewed" | "follow_up_needed";
  note: string | null;
};

export interface ArrivalPlan extends ArrivalPlanInput {
  id: string;
  reservationId: string;
  campgroundId: string;
  userAccountId: string;
  sourceReservationVersion: number;
  rowVersion: number;
  submittedAt: string | null;
  updatedAt: string;
}

export interface StaffArrivalReview {
  id: string;
  outcome: "reviewed" | "follow_up_needed";
  note: string | null;
  reviewedPlanVersion: number;
  reviewedReservationVersion: number;
  reviewedAt: string;
}

export function arrivalReadiness(input: {
  stay: {
    reservation: {
      status: string;
      departureDate: string;
      campgroundLocalDate: string;
      rowVersion: number;
    };
    contact: { name: string; email: string | null } | null;
    rules: { currentCheckInTime: string | null };
    documents: { confirmationNumber: string | null };
    party: { vehicles: number; visitors: number };
    payment: { outstandingCents: number; financialReviewRequired: boolean };
  };
  plan: ArrivalPlan | null;
  review: StaffArrivalReview | null;
}): {
  open: boolean;
  tasks: { id: string; label: string; complete: boolean; detail: string }[];
  completed: number;
  differences: string[];
  reviewCurrent: boolean;
  staffReviewOutcome: string | null;
  checkInAuthorized: false;
};
