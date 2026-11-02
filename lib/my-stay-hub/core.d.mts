import type { MyStayDetail } from "../my-stay/postgres.mjs";
import type {
  ArrivalPlan,
  StaffArrivalReview,
} from "../arrival-planner/core.mjs";
import type { GuestReservationReviewRequest } from "../reservation-decisions/postgres.mjs";
import type { CamperAssistanceRequest } from "../camper-assistance/postgres.mjs";
import type { GuestAssistanceUpdate } from "../camper-assistance-triage/postgres.mjs";

export interface StayHubEvent {
  id: string;
  title: string;
  detail: string;
  at: string | null;
  kind: "recorded" | "scheduled" | "needs_review";
  source: string;
}

export function buildStayHubSummary(input: {
  stay: MyStayDetail;
  arrival?: {
    plan: ArrivalPlan | null;
    review: StaffArrivalReview | null;
  } | null;
  assistance?: {
    requests: CamperAssistanceRequest[];
    updates: GuestAssistanceUpdate[];
  } | null;
  reviews?: GuestReservationReviewRequest[] | null;
  asOf: string;
}): {
  asOf: string;
  reservationVersion: number;
  events: StayHubEvent[];
  openCases: number | null;
  planCurrent: boolean;
  staffReviewCurrent: boolean;
  nextAction: { title: string; detail: string; href: string };
};
